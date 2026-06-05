"""Async client for the RAG system API.

Handles registration, document ingestion, and query.
Degrades gracefully -- all methods return None on failure
so the caller can fall back to naive chat.
"""

from __future__ import annotations

import io
import logging
from typing import TYPE_CHECKING

import aiohttp

if TYPE_CHECKING:
    from src.config import Settings

logger = logging.getLogger(__name__)


class RAGClient:
    """Thin async wrapper around the RAG system's REST API."""

    def __init__(self, settings: Settings) -> None:
        self._base = settings.rag_base_url.rstrip("/")
        self._api_key = settings.rag_api_key
        self._session: aiohttp.ClientSession | None = None

    async def connect(self) -> None:
        self._session = aiohttp.ClientSession()

    async def close(self) -> None:
        if self._session:
            await self._session.close()
            self._session = None

    def _headers(self) -> dict[str, str]:
        return {"X-Api-Key": self._api_key}

    @property
    def is_ready(self) -> bool:
        return bool(self._api_key and self._session)

    # ------------------------------------------------------------------
    # Register (one-time)
    # ------------------------------------------------------------------

    async def register(self, name: str = "docparser", email: str = "docparser@example.com") -> str | None:
        """Register a tenant and return the API key. Returns None on failure."""
        if not self._session:
            return None
        try:
            async with self._session.post(
                f"{self._base}/v1/register",
                json={"name": name, "email": email},
            ) as resp:
                if resp.status == 409:
                    logger.info("RAG tenant already registered")
                    return None
                resp.raise_for_status()
                data = await resp.json()
                key = data["api_key"]
                self._api_key = key
                logger.info("RAG tenant registered, key obtained")
                return key
        except Exception as exc:
            logger.warning("RAG registration failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Clear old documents (per-document isolation)
    # ------------------------------------------------------------------

    async def clear_documents(self) -> None:
        """Delete all existing documents for this tenant before new ingest."""
        if not self.is_ready:
            return
        try:
            async with self._session.delete(
                f"{self._base}/v1/documents",
                headers=self._headers(),
            ) as resp:
                if resp.status == 200:
                    logger.info("RAG: cleared old documents")
        except Exception as exc:
            logger.warning("RAG clear failed (non-fatal): %s", exc)

    # ------------------------------------------------------------------
    # Ingest
    # ------------------------------------------------------------------

    async def ingest(self, filename: str, text_content: str) -> dict | None:
        """Clear old docs, then ingest new document text. Returns stats or None."""
        if not self.is_ready:
            logger.debug("RAG not ready, skipping ingest")
            return None

        # Clear stale data so only the current document is searchable
        await self.clear_documents()

        try:
            txt_bytes = text_content.encode("utf-8")
            form = aiohttp.FormData()
            form.add_field(
                "files",
                io.BytesIO(txt_bytes),
                filename=filename.rsplit(".", 1)[0] + ".txt",
                content_type="text/plain",
            )

            async with self._session.post(
                f"{self._base}/v1/ingest",
                data=form,
                headers=self._headers(),
            ) as resp:
                resp.raise_for_status()
                result = await resp.json()
                logger.info(
                    "RAG ingest: %d docs, %d chunks in %dms",
                    result.get("documents_processed", 0),
                    result.get("chunks_created", 0),
                    result.get("elapsed_ms", 0),
                )
                return result
        except Exception as exc:
            logger.warning("RAG ingest failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    async def query(
        self,
        question: str,
        session_id: str | None = None,
    ) -> dict | None:
        """Query the RAG system. Returns answer dict or None on failure."""
        if not self.is_ready:
            logger.debug("RAG not ready, skipping query")
            return None

        try:
            payload: dict = {"question": question, "top_k": 5}
            if session_id:
                payload["session_id"] = session_id

            async with self._session.post(
                f"{self._base}/v1/query",
                json=payload,
                headers={**self._headers(), "Content-Type": "application/json"},
            ) as resp:
                resp.raise_for_status()
                result = await resp.json()
                logger.debug(
                    "RAG query: confidence=%.2f, citations=%d, abstention=%s",
                    result.get("confidence", 0),
                    len(result.get("citations", [])),
                    result.get("is_abstention", False),
                )
                return result
        except Exception as exc:
            logger.warning("RAG query failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    async def health(self) -> bool:
        """Check if the RAG system is reachable."""
        if not self._session:
            return False
        try:
            async with self._session.get(
                f"{self._base}/v1/health", timeout=aiohttp.ClientTimeout(total=3)
            ) as resp:
                return resp.status == 200
        except Exception:
            return False
