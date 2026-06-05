"""Unit tests for the three-tier routing logic + edge cases."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from src.config import Settings
from src.models import PageAnalysis
from src.router import fallback_route, heuristic_route, route_page


@pytest.fixture
def settings() -> Settings:
    return Settings(
        openrouter_api_key="",
        openrouter_model="test",
        llm_base_url="https://test.example.com/v1/chat/completions",
        redis_url="",
        ocr_workers=2,
        llm_concurrency=2,
        text_char_threshold=50,
        image_coverage_threshold=0.8,
        page_timeout_seconds=5.0,
        max_inflight_pages=20,
    )


def _make_analysis(
    text_char_count: int = 0,
    image_coverage_pct: float = 0.0,
    image_count: int = 0,
    text_quality: float = 0.95,
) -> PageAnalysis:
    return PageAnalysis(
        page_number=1,
        text="x" * text_char_count,
        text_char_count=text_char_count,
        image_count=image_count,
        image_coverage_pct=image_coverage_pct,
        text_quality=text_quality,
        page_image_bytes=None,
        thumbnail_b64="",
    )


# ---------------------------------------------------------------------------
# Tier 0: Zero-cost sanity checks
# ---------------------------------------------------------------------------


class TestTier0:
    def test_blank_page_skips_ocr(self, settings: Settings) -> None:
        """No text, no images = blank page. Don't waste OCR."""
        analysis = _make_analysis(text_char_count=0, image_count=0, text_quality=0.0)
        assert heuristic_route(analysis, settings) == "native"

    def test_no_text_with_images_routes_to_ocr(self, settings: Settings) -> None:
        analysis = _make_analysis(
            text_char_count=0, image_coverage_pct=0.9, image_count=1, text_quality=0.0,
        )
        assert heuristic_route(analysis, settings) == "ocr"

    def test_garbled_text_routes_to_ocr(self, settings: Settings) -> None:
        """Invisible OCR layer with garbage text."""
        analysis = _make_analysis(
            text_char_count=200, image_coverage_pct=0.95, image_count=1, text_quality=0.15,
        )
        assert heuristic_route(analysis, settings) == "ocr"

    def test_pure_text_no_images(self, settings: Settings) -> None:
        """Text page with zero images. No debate."""
        analysis = _make_analysis(
            text_char_count=100, image_count=0, text_quality=0.95,
        )
        assert heuristic_route(analysis, settings) == "native"


# ---------------------------------------------------------------------------
# Tier 1: Coverage-first defense
# ---------------------------------------------------------------------------


class TestTier1:
    def test_high_coverage_with_text_overlay_routes_to_ocr(self, settings: Settings) -> None:
        """Full-bleed scan with small 'Page X' footer. THE key edge case."""
        analysis = _make_analysis(
            text_char_count=30, image_coverage_pct=0.85, image_count=1, text_quality=0.95,
        )
        assert heuristic_route(analysis, settings) == "ocr"

    def test_high_coverage_with_lots_of_real_text_is_ambiguous(self, settings: Settings) -> None:
        """High coverage + lots of clean text = ambiguous (LLM decides).
        Could be decorative bg with real text, or scan with good invisible layer."""
        analysis = _make_analysis(
            text_char_count=150, image_coverage_pct=0.85, image_count=1, text_quality=0.92,
        )
        # chars=150 < threshold*4=200, so coverage-first fires -> ocr
        assert heuristic_route(analysis, settings) == "ocr"

    def test_low_coverage_with_text_is_native(self, settings: Settings) -> None:
        analysis = _make_analysis(
            text_char_count=300, image_coverage_pct=0.10, image_count=1, text_quality=0.95,
        )
        assert heuristic_route(analysis, settings) == "native"

    def test_clear_text_page(self, settings: Settings) -> None:
        analysis = _make_analysis(
            text_char_count=500, image_coverage_pct=0.05, text_quality=0.95,
        )
        assert heuristic_route(analysis, settings) == "native"

    def test_clear_scan_page(self, settings: Settings) -> None:
        analysis = _make_analysis(
            text_char_count=5, image_coverage_pct=0.95, image_count=1, text_quality=0.9,
        )
        assert heuristic_route(analysis, settings) == "ocr"


# ---------------------------------------------------------------------------
# Tier 2: Text-amount fallback
# ---------------------------------------------------------------------------


class TestTier2:
    def test_overwhelming_text_trusts_native(self, settings: Settings) -> None:
        """Letterhead/watermark with 600 chars of real text."""
        analysis = _make_analysis(
            text_char_count=600, image_coverage_pct=0.90, image_count=1, text_quality=0.95,
        )
        # chars=600 > threshold*4=200 -> native
        assert heuristic_route(analysis, settings) == "native"

    def test_minimal_text_routes_to_ocr(self, settings: Settings) -> None:
        analysis = _make_analysis(
            text_char_count=8, image_coverage_pct=0.3, image_count=1, text_quality=0.9,
        )
        # chars=8 < threshold//5=10 -> ocr
        assert heuristic_route(analysis, settings) == "ocr"

    def test_vector_chart_low_text(self, settings: Settings) -> None:
        """Vector diagram with only axis labels. No raster images."""
        analysis = _make_analysis(
            text_char_count=15, image_count=0, image_coverage_pct=0.0, text_quality=0.9,
        )
        # image_count=0 but chars=15 < threshold=50, so Tier 0 pure-text doesn't fire.
        # Tier 2: chars=15 > threshold//5=10, so doesn't fire.
        # Falls through to ambiguous.
        assert heuristic_route(analysis, settings) is None


# ---------------------------------------------------------------------------
# Ambiguous -> LLM / Fallback
# ---------------------------------------------------------------------------


class TestAmbiguous:
    def test_moderate_text_moderate_coverage(self, settings: Settings) -> None:
        """Mixed page: some text, some images, moderate coverage."""
        analysis = _make_analysis(
            text_char_count=80, image_coverage_pct=0.45, image_count=2, text_quality=0.88,
        )
        assert heuristic_route(analysis, settings) is None


# ---------------------------------------------------------------------------
# Fallback route (LLM unavailable)
# ---------------------------------------------------------------------------


class TestFallbackRoute:
    def test_fallback_low_text_to_ocr(self, settings: Settings) -> None:
        analysis = _make_analysis(text_char_count=20, text_quality=0.9)
        assert fallback_route(analysis, settings) == "ocr"

    def test_fallback_sufficient_text_to_native(self, settings: Settings) -> None:
        analysis = _make_analysis(text_char_count=100, text_quality=0.95)
        assert fallback_route(analysis, settings) == "native"

    def test_fallback_high_coverage_to_ocr(self, settings: Settings) -> None:
        """Fallback now considers coverage (unlike old version)."""
        analysis = _make_analysis(
            text_char_count=100, image_coverage_pct=0.85, text_quality=0.9,
        )
        assert fallback_route(analysis, settings) == "ocr"

    def test_fallback_garbled_text_to_ocr(self, settings: Settings) -> None:
        analysis = _make_analysis(text_char_count=200, text_quality=0.2)
        assert fallback_route(analysis, settings) == "ocr"


# ---------------------------------------------------------------------------
# Combined route_page (async)
# ---------------------------------------------------------------------------


class TestRoutePage:
    @pytest.mark.asyncio
    async def test_clear_case_skips_llm(self, settings: Settings) -> None:
        analysis = _make_analysis(
            text_char_count=500, image_coverage_pct=0.05, text_quality=0.95,
        )
        result = await route_page(analysis, settings, session=None)
        assert result == "native"

    @pytest.mark.asyncio
    async def test_ambiguous_without_api_key_uses_fallback(self, settings: Settings) -> None:
        analysis = _make_analysis(
            text_char_count=80, image_coverage_pct=0.45, image_count=2, text_quality=0.88,
        )
        result = await route_page(analysis, settings, session=None)
        # Fallback: 80 > 50 threshold, coverage < 0.7, quality > 0.3 -> native
        assert result == "native"

    @pytest.mark.asyncio
    async def test_ambiguous_with_llm_success(self) -> None:
        settings_with_key = Settings(
            openrouter_api_key="test-key",
            openrouter_model="test",
            redis_url="",
            ocr_workers=2,
            llm_concurrency=2,
            text_char_threshold=50,
            image_coverage_threshold=0.8,
            page_timeout_seconds=5.0,
            max_inflight_pages=20,
        )
        analysis = _make_analysis(
            text_char_count=80, image_coverage_pct=0.45, image_count=2, text_quality=0.88,
        )

        mock_session = AsyncMock()
        with patch("src.router.llm_route", new_callable=AsyncMock, return_value="ocr"):
            result = await route_page(analysis, settings_with_key, session=mock_session)
            assert result == "ocr"

    @pytest.mark.asyncio
    async def test_ambiguous_with_llm_failure_uses_fallback(self) -> None:
        settings_with_key = Settings(
            openrouter_api_key="test-key",
            openrouter_model="test",
            redis_url="",
            ocr_workers=2,
            llm_concurrency=2,
            text_char_threshold=50,
            image_coverage_threshold=0.8,
            page_timeout_seconds=5.0,
            max_inflight_pages=20,
        )
        analysis = _make_analysis(
            text_char_count=80, image_coverage_pct=0.45, image_count=2, text_quality=0.88,
        )

        mock_session = AsyncMock()
        with patch(
            "src.router.llm_route",
            new_callable=AsyncMock,
            side_effect=RuntimeError("API down"),
        ):
            result = await route_page(analysis, settings_with_key, session=mock_session)
            assert result == "native"
