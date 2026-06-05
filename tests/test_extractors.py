"""Unit tests for native and OCR extractors."""

from __future__ import annotations

import io

import pytest
from PIL import Image, ImageDraw

from src.extractors import extract_native, extract_ocr
from src.models import PageAnalysis


def _make_text_analysis(page_number: int = 1, text: str = "Hello world") -> PageAnalysis:
    return PageAnalysis(
        page_number=page_number,
        text=text,
        text_char_count=len(text),
        image_count=0,
        image_coverage_pct=0.0,
        text_quality=0.95,
        page_image_bytes=None,
        thumbnail_b64="",
    )


def _make_simple_image_bytes(text: str = "Test OCR") -> bytes:
    """Create a simple image with text for OCR testing."""
    img = Image.new("RGB", (400, 100), color="white")
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), text, fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestExtractNative:
    def test_wraps_cached_text(self) -> None:
        analysis = _make_text_analysis(page_number=5, text="Some PDF text content")
        result = extract_native(analysis)

        assert result.page_number == 5
        assert result.text == "Some PDF text content"
        assert result.source == "native"
        assert result.confidence is None
        assert result.error is None

    def test_empty_text_page(self) -> None:
        analysis = _make_text_analysis(page_number=1, text="")
        result = extract_native(analysis)

        assert result.text == ""
        assert result.source == "native"

    def test_preserves_page_number(self) -> None:
        for pn in [1, 50, 100]:
            result = extract_native(_make_text_analysis(page_number=pn))
            assert result.page_number == pn


class TestExtractOcr:
    def test_returns_ocr_source(self) -> None:
        image_bytes = _make_simple_image_bytes("Hello")
        result = extract_ocr(image_bytes, page_number=3)

        assert result.page_number == 3
        assert result.source == "ocr"
        assert result.confidence is not None
        assert result.error is None

    def test_handles_corrupt_image(self) -> None:
        result = extract_ocr(b"not-an-image", page_number=7)

        assert result.page_number == 7
        assert result.source == "ocr"
        assert result.error is not None
        assert "OCR failed" in result.error

    def test_confidence_is_normalized(self) -> None:
        image_bytes = _make_simple_image_bytes("Clear text here")
        result = extract_ocr(image_bytes, page_number=1)

        if result.confidence is not None:
            assert 0.0 <= result.confidence <= 1.0
