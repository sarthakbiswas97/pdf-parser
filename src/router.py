"""Three-tier page routing with coverage-first defense.

Tier 0 (zero-cost sanity):  blank pages, no-text, garbled text, pure text
Tier 1 (coverage-first):    image coverage dominates routing decision
Tier 2 (text-amount):       fallback on character count
LLM (ambiguous only):       ~10% of pages, OpenRouter tool calling
Fallback:                   if LLM fails/times out, relaxed heuristic
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING

import aiohttp

from src.models import PageAnalysis, RoutingDecision

if TYPE_CHECKING:
    from src.config import Settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tier 0 + 1 + 2: Heuristic Router (pure function, no IO)
# ---------------------------------------------------------------------------


def heuristic_route(analysis: PageAnalysis, settings: Settings) -> RoutingDecision | None:
    """Three-tier fast routing. Returns None only for truly ambiguous pages.

    Priority order (cheapest checks first):
        Tier 0 -- zero-cost sanity (chars == 0, garbled text, pure text)
        Tier 1 -- coverage-first defense (image dominance)
        Tier 2 -- text-amount fallback
    """
    chars = analysis.text_char_count
    coverage = analysis.image_coverage_pct
    quality = analysis.text_quality
    images = analysis.image_count
    threshold = settings.text_char_threshold
    coverage_threshold = settings.image_coverage_threshold

    # --- Tier 0: zero-cost sanity ---

    # Blank page: no text AND no images. Skip OCR entirely.
    if chars == 0 and images == 0:
        return "native"

    # No extractable text at all -- needs OCR regardless of coverage.
    if chars == 0:
        return "ocr"

    # Garbled text from invisible OCR layer -- text exists but is junk.
    if quality < 0.3:
        return "ocr"

    # Pure text page: no images at all, sufficient text. No debate.
    if images == 0 and chars > threshold:
        return "native"

    # --- Tier 1: coverage-first defense ---

    # Image-dominated page with minor text overlay.
    # Key edge case: full-bleed scan with small "Page X" footer.
    if coverage > coverage_threshold and chars < threshold * 4:
        return "ocr"

    # Text-dominated page with minimal image presence.
    if coverage < 0.15 and chars > threshold:
        return "native"

    # --- Tier 2: text-amount fallback ---

    # Overwhelming amount of text -- trust native extraction even with images.
    # Handles: corporate letterheads, watermarks, decorative borders.
    if chars > threshold * 4:
        return "native"

    # Almost no text -- not enough to trust native extraction.
    if chars < threshold // 5:
        return "ocr"

    # --- Ambiguous: needs LLM (~10% of pages) ---
    return None


def fallback_route(analysis: PageAnalysis, settings: Settings) -> RoutingDecision:
    """Relaxed heuristic used when LLM is unavailable or fails.

    Considers coverage (unlike the old version) to handle the text-overlay edge case.
    """
    if analysis.text_quality < 0.3:
        return "ocr"
    if analysis.image_coverage_pct > settings.image_coverage_threshold:
        return "ocr"
    if analysis.text_char_count < settings.text_char_threshold:
        return "ocr"
    return "native"


# ---------------------------------------------------------------------------
# LLM Router (OpenRouter + Tool Calling)
# ---------------------------------------------------------------------------

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "extract_native_text",
            "description": (
                "Use direct text extraction for this page. Best for pages with "
                "clean, selectable native PDF text where the extracted content is "
                "coherent and complete."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Brief explanation of why native extraction is appropriate.",
                    }
                },
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "extract_via_ocr",
            "description": (
                "Use OCR for this page. Best for scanned images, handwritten content, "
                "pages where native text is garbled/incomplete, or pages dominated by "
                "image content with minimal overlay text."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Brief explanation of why OCR is appropriate.",
                    }
                },
                "required": ["reason"],
            },
        },
    },
]

_SYSTEM_PROMPT = (
    "You are a PDF page routing assistant. Given metadata about a PDF page, "
    "decide whether to use native text extraction or OCR. Call exactly one tool. "
    "Consider: text length, image coverage, text quality score (low quality suggests "
    "garbled OCR artifacts from an invisible text layer), and image dominance."
)


def _build_user_message(analysis: PageAnalysis) -> str:
    text_sample = analysis.text[:200].replace("\n", " ").strip()
    return (
        f"Page {analysis.page_number}:\n"
        f"- Extracted text length: {analysis.text_char_count} characters\n"
        f"- Text quality score: {analysis.text_quality:.2f} (1.0 = clean, <0.3 = garbled)\n"
        f"- Number of images: {analysis.image_count}\n"
        f"- Image coverage: {analysis.image_coverage_pct:.0%} of page area\n"
        f"- Text sample: \"{text_sample}\"\n\n"
        "Which extraction method should be used for this page?"
    )


async def llm_route(
    analysis: PageAnalysis,
    settings: Settings,
    session: aiohttp.ClientSession,
) -> RoutingDecision:
    """Call OpenRouter with tool definitions to classify an ambiguous page."""
    payload = {
        "model": settings.openrouter_model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_message(analysis)},
        ],
        "tools": _TOOLS,
        "tool_choice": "required",
        "temperature": 0.0,
    }

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }

    async with session.post(
        settings.llm_base_url,
        json=payload,
        headers=headers,
    ) as resp:
        resp.raise_for_status()
        data = await resp.json()

    # Validate response structure defensively
    choices = data.get("choices", [])
    if not choices:
        raise ValueError("LLM response missing 'choices'")

    message = choices[0].get("message", {})
    tool_calls = message.get("tool_calls", [])

    if not tool_calls:
        logger.warning("LLM returned no tool call for page %d", analysis.page_number)
        raise ValueError("No tool call in LLM response")

    fn_name = tool_calls[0].get("function", {}).get("name", "")
    raw_args = tool_calls[0].get("function", {}).get("arguments", "{}")

    try:
        fn_args = json.loads(raw_args)
    except json.JSONDecodeError:
        fn_args = {}

    logger.debug(
        "LLM routed page %d -> %s (reason: %s)",
        analysis.page_number,
        fn_name,
        fn_args.get("reason", ""),
    )

    if fn_name == "extract_native_text":
        return "native"
    if fn_name == "extract_via_ocr":
        return "ocr"

    raise ValueError(f"Unexpected tool call: {fn_name}")


# ---------------------------------------------------------------------------
# Combined Router
# ---------------------------------------------------------------------------


async def route_page(
    analysis: PageAnalysis,
    settings: Settings,
    session: aiohttp.ClientSession | None,
) -> RoutingDecision:
    """Route a page through heuristic tiers, then LLM if ambiguous."""
    # Tiers 0/1/2: fast heuristic
    decision = heuristic_route(analysis, settings)
    if decision is not None:
        logger.debug("Heuristic routed page %d -> %s", analysis.page_number, decision)
        return decision

    # LLM tier (if API key available and session provided)
    if settings.openrouter_api_key and session is not None:
        try:
            decision = await asyncio.wait_for(
                llm_route(analysis, settings, session),
                timeout=5.0,
            )
            return decision
        except Exception:
            logger.warning(
                "LLM routing failed for page %d, falling back to heuristic",
                analysis.page_number,
                exc_info=True,
            )

    # Fallback: relaxed heuristic (considers coverage + quality)
    decision = fallback_route(analysis, settings)
    logger.debug("Fallback routed page %d -> %s", analysis.page_number, decision)
    return decision
