"""Core streaming pipeline orchestrator.

Coordinates page analysis, routing, extraction, and ordered streaming.
Uses a producer/consumer pattern with:
  - Reorder buffer (asyncio.Future per page slot) for strict ordering
  - Inflight semaphore for bounded memory on large documents
  - Event signaling instead of busy-wait for zero-CPU-waste coordination

Nothing blocks the main asyncio loop:
  - pdfplumber analysis   -> ThreadPoolExecutor
  - OCR (tesseract)       -> ProcessPoolExecutor
  - LLM routing calls     -> aiohttp (native async)
  - Redis cache           -> redis.asyncio (native async)
  - Reorder buffer        -> asyncio.Future + Event
"""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ProcessPoolExecutor
from typing import AsyncGenerator

import aiohttp

from src.analyzer import analyze_pages
from src.cache import RedisCache
from src.config import Settings
from src.extractors import extract_native, extract_ocr
from src.models import PageAnalysis, PageResult
from src.router import route_page

logger = logging.getLogger(__name__)


async def parse_pdf(
    pdf_path: str,
    settings: Settings,
    cache: RedisCache | None = None,
) -> AsyncGenerator[PageResult, None]:
    """Stream PageResults in strict page order from a PDF file.

    Architecture:
        LAUNCHER task   -- iterates pages, acquires inflight permit, creates
                           Future, spawns processing task, signals consumer
        PROCESSOR tasks -- one per page, runs routing + extraction, resolves Future
        CONSUMER loop   -- awaits Futures in order 1, 2, 3..., releases inflight
                           permit after yielding each result

    Backpressure: inflight semaphore limits concurrent pages in the pipeline.
    For a 1000-page PDF with max_inflight=20, only 20 pages exist in memory.
    The launcher blocks when the buffer is full, creating natural backpressure
    all the way back to the analyzer.
    """
    loop = asyncio.get_running_loop()

    # --- Bounded resource pools ---
    process_pool = ProcessPoolExecutor(max_workers=settings.ocr_workers)
    ocr_semaphore = asyncio.Semaphore(settings.ocr_workers)
    llm_semaphore = asyncio.Semaphore(settings.llm_concurrency)
    inflight = asyncio.Semaphore(settings.max_inflight_pages)

    # --- Reorder buffer ---
    page_futures: dict[int, asyncio.Future[PageResult]] = {}

    # --- Coordination signals ---
    total_pages: asyncio.Future[int] = loop.create_future()
    launcher_error: asyncio.Future[Exception] = loop.create_future()
    page_registered = asyncio.Event()  # wakes consumer when a new page is registered

    # ------------------------------------------------------------------
    # PROCESSOR: one per page, resolves the page's Future
    # ------------------------------------------------------------------

    async def process_page(
        analysis: PageAnalysis,
        session: aiohttp.ClientSession | None,
    ) -> None:
        fut = page_futures[analysis.page_number]
        try:
            # --- Routing (with cache check) ---
            cached_decision = None
            if cache is not None:
                cached_decision = await cache.get_routing(analysis)

            if cached_decision is not None:
                decision = cached_decision
                logger.debug("Cache hit for routing page %d", analysis.page_number)
            else:
                async with llm_semaphore:
                    decision = await route_page(analysis, settings, session)
                if cache is not None:
                    await cache.set_routing(analysis, decision)

            # --- Extraction ---
            thumb = analysis.thumbnail_b64

            if decision == "native":
                result = extract_native(analysis)
            else:
                # Check OCR cache
                if cache is not None and analysis.page_image_bytes is not None:
                    cached_result = await cache.get_ocr_result(analysis.page_image_bytes)
                    if cached_result is not None:
                        logger.debug("Cache hit for OCR page %d", analysis.page_number)
                        fut.set_result(PageResult(
                            page_number=analysis.page_number,
                            text=cached_result.text,
                            source=cached_result.source,
                            confidence=cached_result.confidence,
                            image=thumb,
                        ))
                        return

                if analysis.page_image_bytes is None:
                    logger.warning(
                        "Page %d routed to OCR but no image available, falling back to native",
                        analysis.page_number,
                    )
                    result = PageResult(
                        page_number=analysis.page_number,
                        text=analysis.text,
                        source="native",
                        confidence=None,
                        error="Routed to OCR but image unavailable; used native text",
                        image=thumb,
                    )
                else:
                    async with ocr_semaphore:
                        result = await loop.run_in_executor(
                            process_pool,
                            extract_ocr,
                            analysis.page_image_bytes,
                            analysis.page_number,
                        )
                    if cache is not None:
                        await cache.set_ocr_result(analysis.page_image_bytes, result)
                    # Attach thumbnail (extract_ocr can't access it in ProcessPool)
                    result = PageResult(
                        page_number=result.page_number,
                        text=result.text,
                        source=result.source,
                        confidence=result.confidence,
                        error=result.error,
                        image=thumb,
                    )

            fut.set_result(result)

        except Exception as exc:
            logger.error(
                "Failed processing page %d: %s",
                analysis.page_number,
                exc,
                exc_info=True,
            )
            error_result = PageResult(
                page_number=analysis.page_number,
                text="",
                source="native",
                error=str(exc),
            )
            if not fut.done():
                fut.set_result(error_result)

    # ------------------------------------------------------------------
    # LAUNCHER: iterate pages, create Futures, spawn processors
    # ------------------------------------------------------------------

    async def launch_pages(session: aiohttp.ClientSession | None) -> None:
        try:
            count = 0
            async for analysis in analyze_pages(pdf_path, settings):
                # Backpressure: block if too many pages in-flight
                await inflight.acquire()

                count += 1
                page_futures[analysis.page_number] = loop.create_future()

                # Wake consumer so it can see the new Future
                page_registered.set()

                asyncio.create_task(
                    process_page(analysis, session),
                    name=f"process-page-{analysis.page_number}",
                )

            total_pages.set_result(count)
            # Final wake in case consumer is waiting
            page_registered.set()

        except Exception as exc:
            logger.error("Launcher failed: %s", exc, exc_info=True)
            if not total_pages.done():
                total_pages.set_result(0)
            launcher_error.set_result(exc)
            page_registered.set()  # wake consumer so it can see the error

    # ------------------------------------------------------------------
    # CONSUMER: yield in strict page order
    # ------------------------------------------------------------------

    session: aiohttp.ClientSession | None = None
    if settings.openrouter_api_key:
        session = aiohttp.ClientSession()

    try:
        asyncio.create_task(launch_pages(session), name="launcher")

        page_num = 1
        while True:
            # Wait for this page's Future to be registered (event-based, no busy-wait)
            while page_num not in page_futures:
                # Check error first to avoid silent partial results
                if launcher_error.done():
                    raise launcher_error.result()
                if total_pages.done() and page_num > total_pages.result():
                    return
                page_registered.clear()
                await page_registered.wait()

            # Await the result with per-page timeout
            try:
                result = await asyncio.wait_for(
                    page_futures[page_num],
                    timeout=settings.page_timeout_seconds,
                )
            except asyncio.TimeoutError:
                result = PageResult(
                    page_number=page_num,
                    text="",
                    source="native",
                    error=f"Page {page_num} timed out after {settings.page_timeout_seconds}s",
                )

            yield result

            # Release inflight permit + free memory
            inflight.release()
            del page_futures[page_num]
            page_num += 1

            if total_pages.done() and page_num > total_pages.result():
                return

    finally:
        process_pool.shutdown(wait=False)
        if session is not None:
            await session.close()
