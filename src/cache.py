"""Async Redis cache with graceful degradation.

If Redis is unavailable, every method silently returns None / no-ops.
The pipeline never blocks or crashes due to cache failures.
"""

from __future__ import annotations

import hashlib
import logging
from typing import TYPE_CHECKING

import redis.asyncio as aioredis

from src.models import PageAnalysis, PageResult

if TYPE_CHECKING:
    from src.config import Settings

logger = logging.getLogger(__name__)

_ROUTING_TTL = 60 * 60 * 24  # 24 hours
_OCR_TTL = 60 * 60 * 24  # 24 hours


def _routing_cache_key(analysis: PageAnalysis) -> str:
    """Content-addressed key based on page metrics only.

    Uses quantized metrics (not text content) so pages with similar
    characteristics share cache entries across documents.
    """
    raw = (
        f"{analysis.text_char_count}:"
        f"{analysis.image_coverage_pct:.2f}:"
        f"{analysis.image_count}:"
        f"{analysis.text_quality:.1f}"
    )
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"route:{digest}"


def _ocr_cache_key(image_bytes: bytes) -> str:
    """Content-addressed key based on image content."""
    digest = hashlib.sha256(image_bytes).hexdigest()[:16]
    return f"ocr:{digest}"


class RedisCache:
    """Thin async wrapper around Redis with fail-open semantics."""

    def __init__(self) -> None:
        self._client: aioredis.Redis | None = None

    async def connect(self, settings: Settings) -> None:
        try:
            self._client = aioredis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=2.0,
            )
            await self._client.ping()
            logger.info("Redis connected at %s", settings.redis_url)
        except Exception:
            logger.warning("Redis unavailable -- running without cache")
            self._client = None

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    # -- routing cache --

    async def get_routing(self, analysis: PageAnalysis) -> str | None:
        if self._client is None:
            return None
        try:
            return await self._client.get(_routing_cache_key(analysis))
        except Exception:
            logger.debug("Redis read failed for routing cache", exc_info=True)
            return None

    async def set_routing(self, analysis: PageAnalysis, decision: str) -> None:
        if self._client is None:
            return
        try:
            await self._client.set(
                _routing_cache_key(analysis), decision, ex=_ROUTING_TTL
            )
        except Exception:
            logger.debug("Redis write failed for routing cache", exc_info=True)

    # -- OCR result cache --

    async def get_ocr_result(self, image_bytes: bytes) -> PageResult | None:
        if self._client is None:
            return None
        try:
            raw = await self._client.get(_ocr_cache_key(image_bytes))
            if raw is not None:
                return PageResult.from_json(raw)
            return None
        except Exception:
            logger.debug("Redis read failed for OCR cache", exc_info=True)
            return None

    async def set_ocr_result(self, image_bytes: bytes, result: PageResult) -> None:
        if self._client is None:
            return
        try:
            await self._client.set(
                _ocr_cache_key(image_bytes), result.to_cache_json(), ex=_OCR_TTL
            )
        except Exception:
            logger.debug("Redis write failed for OCR cache", exc_info=True)
