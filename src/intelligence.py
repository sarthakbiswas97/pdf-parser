"""LLM-powered document intelligence: classify, extract, summarize, chat.

All functions are async, use aiohttp for non-blocking OpenRouter calls,
and degrade gracefully on failure.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
from typing import TYPE_CHECKING

import aiohttp

from src.schema_store import get_schema, list_schemas

if TYPE_CHECKING:
    from src.config import Settings

logger = logging.getLogger(__name__)

_MAX_TEXT_CHARS = 8000


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences from LLM response."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text  # truncate to fit model context


def _truncate(text: str, limit: int = _MAX_TEXT_CHARS) -> str:
    """Keep first and last portions of text to preserve context."""
    if len(text) <= limit:
        return text
    half = limit // 2
    return text[:half] + "\n\n[... truncated ...]\n\n" + text[-half:]


async def _llm_call(
    messages: list[dict],
    settings: Settings,
    session: aiohttp.ClientSession,
    tools: list[dict] | None = None,
    temperature: float = 0.0,
    max_retries: int = 3,
) -> dict:
    """LLM chat completion call with retry on rate limits."""
    payload: dict = {
        "model": settings.openrouter_model,
        "messages": messages,
        "temperature": temperature,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "required"

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }

    for attempt in range(max_retries):
        async with session.post(
            settings.llm_base_url,
            json=payload,
            headers=headers,
        ) as resp:
            if resp.status == 429:
                wait = (2 ** attempt) + random.random()
                logger.warning("Rate limited (429), retrying in %.1fs (attempt %d)", wait, attempt + 1)
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            return await resp.json()

    raise RuntimeError("LLM rate limited after max retries")


# ---------------------------------------------------------------------------
# Classify
# ---------------------------------------------------------------------------


async def classify_document(
    full_text: str,
    settings: Settings,
    session: aiohttp.ClientSession,
) -> dict:
    """Classify document type. Returns {"type": "invoice", "confidence": 0.95}."""
    text = _truncate(full_text, 3000)

    all_schemas = list_schemas()
    type_descriptions = "\n".join(
        f"- {key}: {val['description']}" for key, val in all_schemas.items()
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a document classifier. Given document text, determine its type. "
                "Respond with a JSON object: {\"type\": \"...\", \"confidence\": 0.0-1.0}. "
                f"Valid types:\n{type_descriptions}\n\n"
                "Return ONLY the JSON object, no other text."
            ),
        },
        {"role": "user", "content": text},
    ]

    try:
        data = await _llm_call(messages, settings, session)
        content = _strip_code_fences(data["choices"][0]["message"]["content"])
        result = json.loads(content)
        valid_types = list(all_schemas.keys())
        if result.get("type") not in valid_types:
            result["type"] = "other"
        return result
    except Exception as exc:
        logger.warning("Classification failed: %s", exc)
        return {"type": "other", "confidence": 0.0}


# ---------------------------------------------------------------------------
# Extract Fields
# ---------------------------------------------------------------------------


async def extract_fields(
    full_text: str,
    doc_type: str,
    settings: Settings,
    session: aiohttp.ClientSession,
) -> dict:
    """Extract structured fields for the given document type.

    Returns: {"field_name": {"value": "...", "confidence": 0.0-1.0}, ...}
    """
    schema = get_schema(doc_type) or get_schema("other")
    text = _truncate(full_text)

    field_descriptions = "\n".join(
        f"- {name}: {desc}" for name, desc in schema["fields"].items()
    )

    messages = [
        {
            "role": "system",
            "content": (
                f"You are a {schema['label']} data extractor. "
                "Extract the following fields from the document text. "
                "For each field, provide a value and a confidence score (0.0 to 1.0). "
                "If a field is not found, set value to null and confidence to 0.0.\n\n"
                f"Fields to extract:\n{field_descriptions}\n\n"
                "Respond with a JSON object where each key is the field name and the value is "
                "{\"value\": ..., \"confidence\": 0.0-1.0}. "
                "For list fields (like skills, line_items, transactions, experience, education), "
                "the value should be an array.\n"
                "Return ONLY the JSON object, no other text."
            ),
        },
        {"role": "user", "content": text},
    ]

    try:
        data = await _llm_call(messages, settings, session)
        content = _strip_code_fences(data["choices"][0]["message"]["content"])
        return json.loads(content)
    except Exception as exc:
        logger.warning("Field extraction failed: %s", exc)
        return {
            name: {"value": None, "confidence": 0.0}
            for name in schema["fields"]
        }


# ---------------------------------------------------------------------------
# Summarize
# ---------------------------------------------------------------------------


async def summarize_document(
    full_text: str,
    doc_type: str,
    settings: Settings,
    session: aiohttp.ClientSession,
) -> str:
    """Generate a 2-3 sentence summary of the document."""
    text = _truncate(full_text, 4000)
    schema = get_schema(doc_type) or get_schema("other")
    label = schema["label"]

    messages = [
        {
            "role": "system",
            "content": (
                f"You are a document analyst. This is a {label}. "
                "Write a clear, concise 2-3 sentence summary of this document. "
                "Focus on the most important facts: who, what, when, how much. "
                "No preamble, just the summary."
            ),
        },
        {"role": "user", "content": text},
    ]

    try:
        data = await _llm_call(messages, settings, session, temperature=0.1)
        return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning("Summarization failed: %s", exc)
        return "Summary unavailable."


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------


async def chat_with_document(
    full_text: str,
    question: str,
    settings: Settings,
    session: aiohttp.ClientSession,
) -> str:
    """Answer a question about the document."""
    text = _truncate(full_text)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a document assistant. Answer the user's question based ONLY on "
                "the document text provided below. If the answer is not in the document, "
                "say \"I couldn't find that in the document.\" Be concise and direct.\n\n"
                f"Document text:\n{text}"
            ),
        },
        {"role": "user", "content": question},
    ]

    try:
        data = await _llm_call(messages, settings, session, temperature=0.1)
        return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning("Chat failed: %s", exc)
        return f"Error: {exc}"


# ---------------------------------------------------------------------------
# Combined Analysis (classify + summarize concurrently, then extract)
# ---------------------------------------------------------------------------


async def analyze_document(
    full_text: str,
    settings: Settings,
) -> dict:
    """Run full document analysis: classify, summarize, extract fields.

    classify + summarize run concurrently (independent).
    extract_fields runs after classify (needs doc_type).
    """
    async with aiohttp.ClientSession() as session:
        # Phase 1: classify + summarize concurrently
        classify_task = asyncio.create_task(
            classify_document(full_text, settings, session)
        )
        # Start summarize with "other" -- will be accurate enough
        summarize_task = asyncio.create_task(
            summarize_document(full_text, "other", settings, session)
        )

        classification = await classify_task
        doc_type = classification.get("type", "other")

        # Phase 2: extract fields (needs doc_type)
        fields = await extract_fields(full_text, doc_type, settings, session)

        summary = await summarize_task

    return {
        "doc_type": doc_type,
        "doc_type_confidence": classification.get("confidence", 0.0),
        "doc_type_label": (get_schema(doc_type) or get_schema("other"))["label"],
        "fields": fields,
        "summary": summary,
    }
