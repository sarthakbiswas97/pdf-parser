"""Shared fixtures for the test suite."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.config import Settings

TESTS_DIR = Path(__file__).parent
SAMPLE_PDF_PATH = str(TESTS_DIR / "sample.pdf")


@pytest.fixture(scope="session", autouse=True)
def generate_sample_pdf() -> None:
    """Generate the test PDF once per test session if it doesn't exist."""
    if not Path(SAMPLE_PDF_PATH).exists():
        from tests.generate_test_pdf import generate_test_pdf

        generate_test_pdf(SAMPLE_PDF_PATH, num_pages=10)


@pytest.fixture
def sample_pdf_path() -> str:
    return SAMPLE_PDF_PATH


@pytest.fixture
def settings() -> Settings:
    """Settings with no external dependencies (no API key, default thresholds)."""
    return Settings(
        openrouter_api_key="",
        openrouter_model="gpt-4o-mini",
        llm_base_url="https://api.openai.com/v1/chat/completions",
        redis_url="redis://localhost:6379/0",
        ocr_workers=2,
        llm_concurrency=2,
        text_char_threshold=50,
        image_coverage_threshold=0.8,
        page_timeout_seconds=30.0,
        max_inflight_pages=20,
    )
