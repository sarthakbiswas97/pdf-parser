"""Integration tests for the full streaming pipeline."""

from __future__ import annotations

import pytest

from src.config import Settings
from src.pipeline import parse_pdf


@pytest.fixture
def settings() -> Settings:
    """Settings with no external deps for CI."""
    return Settings(
        openrouter_api_key="",
        openrouter_model="test",
        llm_base_url="https://test.example.com/v1/chat/completions",
        redis_url="",
        ocr_workers=2,
        llm_concurrency=2,
        text_char_threshold=50,
        image_coverage_threshold=0.8,
        page_timeout_seconds=30.0,
        max_inflight_pages=20,
    )


class TestPipeline:
    @pytest.mark.asyncio
    async def test_streams_all_pages_in_order(
        self, sample_pdf_path: str, settings: Settings
    ) -> None:
        """Every page is yielded exactly once, in strict order."""
        results = []
        async for result in parse_pdf(sample_pdf_path, settings, cache=None):
            results.append(result)

        assert len(results) == 10
        for i, result in enumerate(results):
            assert result.page_number == i + 1, (
                f"Expected page {i + 1}, got {result.page_number}"
            )

    @pytest.mark.asyncio
    async def test_text_pages_use_native(
        self, sample_pdf_path: str, settings: Settings
    ) -> None:
        """Odd pages (native text) should be extracted via native path."""
        results = []
        async for result in parse_pdf(sample_pdf_path, settings, cache=None):
            results.append(result)

        for result in results:
            if result.page_number % 2 == 1:
                assert result.source == "native", (
                    f"Page {result.page_number} should be native, got {result.source}"
                )
                assert len(result.text) > 0

    @pytest.mark.asyncio
    async def test_image_pages_use_ocr(
        self, sample_pdf_path: str, settings: Settings
    ) -> None:
        """Even pages (images) should be extracted via OCR path."""
        results = []
        async for result in parse_pdf(sample_pdf_path, settings, cache=None):
            results.append(result)

        for result in results:
            if result.page_number % 2 == 0:
                assert result.source == "ocr", (
                    f"Page {result.page_number} should be ocr, got {result.source}"
                )

    @pytest.mark.asyncio
    async def test_unified_output_structure(
        self, sample_pdf_path: str, settings: Settings
    ) -> None:
        """Every result has the required fields regardless of source."""
        async for result in parse_pdf(sample_pdf_path, settings, cache=None):
            assert result.page_number > 0
            assert isinstance(result.text, str)
            assert result.source in ("native", "ocr")

            from src.models import PageResult

            roundtripped = PageResult.from_json(result.to_json())
            assert roundtripped.page_number == result.page_number
            assert roundtripped.source == result.source

    @pytest.mark.asyncio
    async def test_no_errors_on_clean_pdf(
        self, sample_pdf_path: str, settings: Settings
    ) -> None:
        """No page should error on the well-formed test PDF."""
        async for result in parse_pdf(sample_pdf_path, settings, cache=None):
            assert result.error is None, (
                f"Page {result.page_number} errored: {result.error}"
            )

    @pytest.mark.asyncio
    async def test_inflight_bounds_respected(
        self, sample_pdf_path: str,
    ) -> None:
        """Pipeline works correctly with a very small inflight limit."""
        tight_settings = Settings(
            openrouter_api_key="",
            openrouter_model="test",
            redis_url="",
            ocr_workers=2,
            llm_concurrency=2,
            text_char_threshold=50,
            image_coverage_threshold=0.8,
            page_timeout_seconds=30.0,
            max_inflight_pages=3,  # very tight -- tests backpressure
        )
        results = []
        async for result in parse_pdf(sample_pdf_path, tight_settings, cache=None):
            results.append(result)

        assert len(results) == 10
        for i, result in enumerate(results):
            assert result.page_number == i + 1
