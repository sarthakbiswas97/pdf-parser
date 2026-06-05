"""Pipeline configuration loaded from .env file and environment variables.

Load order: .env file (if present) -> environment variables (override).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (walk up from this file to find it)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ENV_PATH = _PROJECT_ROOT / ".env"
load_dotenv(_ENV_PATH)


@dataclass(frozen=True, slots=True)
class Settings:
    openrouter_api_key: str
    openrouter_model: str
    llm_base_url: str
    redis_url: str
    ocr_workers: int
    llm_concurrency: int
    text_char_threshold: int
    image_coverage_threshold: float
    page_timeout_seconds: float
    max_inflight_pages: int
    rag_base_url: str
    rag_api_key: str
    google_creds_path: str
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            openrouter_api_key=os.environ.get("OPENROUTER_API_KEY", ""),
            openrouter_model=os.environ.get(
                "OPENROUTER_MODEL", "gpt-4o-mini"
            ),
            llm_base_url=os.environ.get(
                "LLM_BASE_URL", "https://openrouter.ai/api/v1/chat/completions"
            ),
            redis_url=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
            ocr_workers=int(os.environ.get("OCR_WORKERS", min(os.cpu_count() or 2, 4))),
            llm_concurrency=int(os.environ.get("LLM_CONCURRENCY", "10")),
            text_char_threshold=int(os.environ.get("TEXT_CHAR_THRESHOLD", "50")),
            image_coverage_threshold=float(
                os.environ.get("IMAGE_COVERAGE_THRESHOLD", "0.8")
            ),
            page_timeout_seconds=float(
                os.environ.get("PAGE_TIMEOUT_SECONDS", "30.0")
            ),
            max_inflight_pages=int(os.environ.get("MAX_INFLIGHT_PAGES", "20")),
            rag_base_url=os.environ.get("RAG_BASE_URL", "http://localhost:8001"),
            rag_api_key=os.environ.get("RAG_API_KEY", ""),
            google_creds_path=os.environ.get("GOOGLE_CREDS_PATH", ""),
            google_client_id=os.environ.get("GOOGLE_CLIENT_ID", ""),
            google_client_secret=os.environ.get("GOOGLE_CLIENT_SECRET", ""),
            google_redirect_uri=os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback"),
        )

    def has_llm(self) -> bool:
        """Check if LLM routing is available."""
        return bool(self.openrouter_api_key)

    def has_rag(self) -> bool:
        """Check if RAG system is configured."""
        return bool(self.rag_base_url)
