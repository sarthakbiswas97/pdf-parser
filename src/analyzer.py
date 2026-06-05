"""Two-stage page analyzer with pre-screen routing.

Stage 1 (cheap):  extract text, compute coverage + text quality from metadata.
Stage 2 (conditional): render page to image ONLY if pre-screen says OCR or ambiguous.

Runs pdfplumber operations in a ThreadPoolExecutor so the asyncio loop
is never blocked. The heuristic router is called inline as a pre-screen
(it's a pure function with zero IO cost).
"""

from __future__ import annotations

import asyncio
import base64
import io
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import AsyncIterator

import pdfplumber
from PIL import Image

from src.config import Settings
from src.models import PageAnalysis
from src.router import heuristic_route

logger = logging.getLogger(__name__)

_MAX_IMAGE_DIM = 2000
_PRINTABLE_EXTRAS = frozenset(".,;:!?()'-/\"@#$%&*+=[]{}|\\<>~`\n\t\r")


def _calc_image_coverage(page: pdfplumber.page.Page) -> float:
    """Fraction of page area covered by raster images (0.0 - 1.0).

    Uses bounding box arithmetic on metadata already loaded by pdfplumber.
    O(n) where n = images per page (typically 0-5). Negligible cost.
    """
    page_area = page.width * page.height
    if page_area == 0:
        return 0.0

    image_area = 0.0
    for img in page.images:
        w = max(0.0, float(img["x1"]) - float(img["x0"]))
        h = max(0.0, float(img["bottom"]) - float(img["top"]))
        image_area += w * h

    return min(image_area / page_area, 1.0)


def _calc_text_quality(text: str) -> float:
    """Ratio of clean printable characters to total length.

    Returns 0.0-1.0. Low values (<0.3) indicate garbled text from
    invisible OCR layers or corrupt PDF text streams.
    """
    if not text:
        return 0.0
    clean = sum(
        1 for c in text
        if c.isalnum() or c.isspace() or c in _PRINTABLE_EXTRAS
    )
    return clean / len(text)


def _render_page_image(page: pdfplumber.page.Page) -> bytes:
    """Render a PDF page to PNG bytes at full resolution for OCR."""
    pil_image = page.to_image(resolution=200).original

    if max(pil_image.size) > _MAX_IMAGE_DIM:
        pil_image.thumbnail((_MAX_IMAGE_DIM, _MAX_IMAGE_DIM), Image.LANCZOS)

    buf = io.BytesIO()
    pil_image.save(buf, format="PNG")
    return buf.getvalue()


def _render_thumbnail(page: pdfplumber.page.Page) -> str:
    """Render a small JPEG thumbnail for frontend display. Returns base64 string."""
    pil_image = page.to_image(resolution=72).original
    pil_image.thumbnail((400, 400), Image.LANCZOS)

    buf = io.BytesIO()
    pil_image.save(buf, format="JPEG", quality=60)
    return base64.b64encode(buf.getvalue()).decode()


def _analyze_single_page(
    page: pdfplumber.page.Page,
    page_number: int,
    settings: Settings,
) -> PageAnalysis:
    """Two-stage analysis of one page. Called inside ThreadPoolExecutor.

    Stage 1: extract text + compute cheap metadata (coverage, quality).
    Pre-screen: call heuristic_route to decide if image rendering is needed.
    Stage 2: render page image only if pre-screen says OCR or ambiguous.
    """
    # --- Stage 1: cheap metadata extraction ---
    text = page.extract_text() or ""
    text_char_count = len(text.strip())
    image_count = len(page.images)
    image_coverage = _calc_image_coverage(page)
    text_quality = _calc_text_quality(text)

    # --- Thumbnail: always render a small preview for display ---
    thumbnail_b64 = _render_thumbnail(page)

    # --- Pre-screen: heuristic decides if we need the full-res render ---
    preliminary = PageAnalysis(
        page_number=page_number,
        text=text,
        text_char_count=text_char_count,
        image_count=image_count,
        image_coverage_pct=image_coverage,
        text_quality=text_quality,
        page_image_bytes=None,
        thumbnail_b64=thumbnail_b64,
    )
    pre_decision = heuristic_route(preliminary, settings)

    # --- Stage 2: conditional full-res render for OCR ---
    needs_render = pre_decision != "native"
    page_image_bytes = _render_page_image(page) if needs_render else None

    if needs_render:
        logger.debug(
            "Page %d: rendered full image (pre-screen=%s, chars=%d, coverage=%.0f%%)",
            page_number,
            pre_decision,
            text_char_count,
            image_coverage * 100,
        )

    return PageAnalysis(
        page_number=page_number,
        text=text,
        text_char_count=text_char_count,
        image_count=image_count,
        image_coverage_pct=image_coverage,
        text_quality=text_quality,
        page_image_bytes=page_image_bytes,
        thumbnail_b64=thumbnail_b64,
    )


async def analyze_pages(
    pdf_path: str,
    settings: Settings,
) -> AsyncIterator[PageAnalysis]:
    """Async iterator yielding PageAnalysis for each page in document order.

    pdfplumber work runs in a thread pool so it never blocks the event loop.
    """
    loop = asyncio.get_running_loop()

    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        logger.info("Opened PDF: %s (%d pages)", pdf_path, total)

        with ThreadPoolExecutor(
            max_workers=settings.ocr_workers,
            thread_name_prefix="analyzer",
        ) as pool:
            for idx, page in enumerate(pdf.pages):
                page_number = idx + 1
                analysis = await loop.run_in_executor(
                    pool,
                    _analyze_single_page,
                    page,
                    page_number,
                    settings,
                )
                yield analysis
