"""Text extraction functions for native PDF text and OCR.

extract_native: wraps already-cached text from PageAnalysis (zero cost).
extract_ocr:    runs tesseract on image bytes (CPU-bound, runs in ProcessPool).
                Must be a top-level function to be picklable.
"""

from __future__ import annotations

import io
import logging
from statistics import mean

import pytesseract
from PIL import Image

from src.models import PageAnalysis, PageResult

logger = logging.getLogger(__name__)


def extract_native(analysis: PageAnalysis) -> PageResult:
    """Wrap the already-extracted text into a PageResult. No re-reading of the PDF."""
    return PageResult(
        page_number=analysis.page_number,
        text=analysis.text,
        source="native",
        confidence=None,
        image=analysis.thumbnail_b64,
    )


def extract_ocr(page_image_bytes: bytes, page_number: int) -> PageResult:
    """Run tesseract OCR on rendered page image.

    This function is intentionally top-level and accepts only picklable args
    so it can be submitted to a ProcessPoolExecutor.
    """
    try:
        image = Image.open(io.BytesIO(page_image_bytes))

        # Get detailed OCR data including per-word confidence
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)

        # Build text from words, filter out empty entries
        words = [w for w in data["text"] if w.strip()]
        text = " ".join(words)

        # Compute mean confidence from valid (non -1) entries
        valid_confidences = [
            float(c) for c in data["conf"] if int(c) > 0
        ]
        confidence = round(mean(valid_confidences) / 100.0, 3) if valid_confidences else 0.0

        return PageResult(
            page_number=page_number,
            text=text,
            source="ocr",
            confidence=confidence,
        )
    except Exception as exc:
        logger.error("OCR failed for page %d: %s", page_number, exc, exc_info=True)
        return PageResult(
            page_number=page_number,
            text="",
            source="ocr",
            confidence=0.0,
            error=f"OCR failed: {exc}",
        )
