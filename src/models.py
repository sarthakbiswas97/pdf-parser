"""Immutable data models for the PDF parsing pipeline."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal

RoutingDecision = Literal["native", "ocr"]


@dataclass(frozen=True, slots=True)
class PageAnalysis:
    """Metadata extracted from a single PDF page. Carries cached text and image bytes
    so downstream layers never re-read the PDF."""

    page_number: int
    text: str
    text_char_count: int
    image_count: int
    image_coverage_pct: float
    text_quality: float  # 0.0-1.0, ratio of clean printable chars (detects garbled OCR)
    page_image_bytes: bytes | None  # full-res PNG for OCR, only when needed
    thumbnail_b64: str  # small JPEG thumbnail, always available for display


@dataclass(frozen=True, slots=True)
class PageResult:
    """Unified output for every page, regardless of extraction path."""

    page_number: int
    text: str
    source: RoutingDecision
    confidence: float | None = None
    error: str | None = None
    image: str | None = None  # base64 JPEG thumbnail for frontend display

    def to_json(self) -> str:
        d: dict = {
            "page_number": self.page_number,
            "text": self.text,
            "source": self.source,
            "confidence": self.confidence,
            "error": self.error,
        }
        if self.image:
            d["image"] = self.image
        return json.dumps(d, ensure_ascii=False)

    def to_cache_json(self) -> str:
        """JSON without image -- for Redis cache (keep payloads small)."""
        return json.dumps(
            {
                "page_number": self.page_number,
                "text": self.text,
                "source": self.source,
                "confidence": self.confidence,
                "error": self.error,
            },
            ensure_ascii=False,
        )

    @classmethod
    def from_json(cls, raw: str) -> PageResult:
        data = json.loads(raw)
        return cls(**data)
