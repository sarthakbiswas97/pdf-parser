"""Email intelligence: fetch emails from Gmail, analyze with LLM.

Fetches all emails in a date range, extracts clean text,
sends to LLM for highlights/deadlines/action items analysis.
"""

from __future__ import annotations

import base64
import json
import logging
from typing import TYPE_CHECKING

import aiohttp
from bs4 import BeautifulSoup

from src.google_auth import _find_pdf_parts, _get_session, get_valid_token
from src.intelligence import _llm_call, _strip_code_fences

if TYPE_CHECKING:
    from src.config import Settings

logger = logging.getLogger(__name__)

_MAX_BODY_CHARS = 400  # per email, keeps total context manageable
_MAX_EMAILS = 200


# ---------------------------------------------------------------------------
# Gmail: fetch all emails in date range
# ---------------------------------------------------------------------------


async def fetch_emails(
    after: str,
    before: str,
    folder: str,
    client_id: str,
    client_secret: str,
    on_progress: callable | None = None,
) -> list[dict]:
    """Fetch all emails in a date range. Returns list of extracted email dicts.

    Each dict: {subject, sender, date, body, message_id}
    """
    token = await get_valid_token(client_id, client_secret)
    if not token:
        return []

    session = await _get_session()
    headers = {"Authorization": f"Bearer {token}"}

    # Step 1: list message IDs
    q = ""
    if folder and folder != "all":
        q += f"in:{folder} "
    if after:
        q += f"after:{after} "
    if before:
        q += f"before:{before}"
    q = q.strip() or "newer_than:7d"

    list_url = (
        f"https://gmail.googleapis.com/gmail/v1/users/me/messages"
        f"?q={q}&maxResults={_MAX_EMAILS}"
    )

    async with session.get(list_url, headers=headers) as resp:
        if resp.status != 200:
            logger.warning("Gmail list failed: %d", resp.status)
            return []
        data = await resp.json()
        message_ids = [m["id"] for m in data.get("messages", [])]

    if not message_ids:
        return []

    total = len(message_ids)
    logger.info("Fetching %d emails for digest", total)

    # Step 2: fetch each message (sequential, within rate limits)
    emails = []
    for i, msg_id in enumerate(message_ids):
        msg_url = (
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}"
            f"?format=full"
        )
        async with session.get(msg_url, headers=headers) as resp:
            if resp.status != 200:
                continue
            msg_data = await resp.json()

        email = _extract_email(msg_data)
        if email:
            emails.append(email)

        if on_progress:
            on_progress(i + 1, total)

    # Deduplicate by thread: keep latest message per thread
    # Gmail returns newest first, so first seen per thread is the latest
    seen_threads: dict[str, dict] = {}
    for email in emails:
        tid = email.get("thread_id") or email["message_id"]
        if tid not in seen_threads:
            seen_threads[tid] = email
    deduped = list(seen_threads.values())

    logger.info("Fetched %d emails (%d after dedup)", len(emails), len(deduped))
    return deduped


def _extract_email(msg_data: dict) -> dict | None:
    """Extract subject, sender, date, body text, and attachments from a Gmail message."""
    payload = msg_data.get("payload", {})
    hdrs = {h["name"]: h["value"] for h in payload.get("headers", [])}

    subject = hdrs.get("Subject", "(no subject)")
    sender = _clean_sender(hdrs.get("From", ""))
    date = hdrs.get("Date", "")

    # Extract body text
    body = _extract_body(payload)

    # Find PDF attachments
    attachments: list[dict] = []
    _find_pdf_parts(payload, attachments)

    # Skip only if no body AND no attachments (truly empty email)
    if not body and not attachments:
        return None

    # For empty body with attachments, describe what's attached
    if not body and attachments:
        names = ", ".join(a["filename"] for a in attachments)
        body = f"[Attachments: {names}]"

    # Truncate
    if len(body) > _MAX_BODY_CHARS:
        body = body[:_MAX_BODY_CHARS] + "..."

    return {
        "message_id": msg_data.get("id", ""),
        "thread_id": msg_data.get("threadId", ""),
        "subject": subject,
        "sender": sender,
        "date": date,
        "body": body,
        "attachments": attachments,
    }


def _extract_body(payload: dict) -> str:
    """Recursively extract text from email payload. Prefers text/plain."""
    mime = payload.get("mimeType", "")

    # Simple text part
    if mime == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            text = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
            # Some "plain text" actually contains HTML (forwarded messages)
            stripped = text.lstrip()
            if stripped.startswith("<") or "<html" in text[:200].lower():
                text = _html_to_text(text)
            return text

    # HTML fallback
    if mime == "text/html":
        data = payload.get("body", {}).get("data", "")
        if data:
            html = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
            return _html_to_text(html)

    # Multipart: recurse into parts
    parts = payload.get("parts", [])
    # Prefer text/plain over text/html
    for part in parts:
        if part.get("mimeType") == "text/plain":
            text = _extract_body(part)
            if text:
                return text
    for part in parts:
        text = _extract_body(part)
        if text:
            return text

    return ""


def _html_to_text(html: str) -> str:
    """Strip HTML tags from email body, keeping clean text."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "head"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)


def _clean_sender(sender: str) -> str:
    if "<" in sender:
        return sender.split("<")[0].strip().strip('"')
    return sender


# ---------------------------------------------------------------------------
# LLM: analyze emails
# ---------------------------------------------------------------------------


def _build_email_context(emails: list[dict]) -> str:
    """Build a single context string from all emails."""
    lines = []
    for i, e in enumerate(emails, 1):
        lines.append(
            f"--- Email {i} ---\n"
            f"From: {e['sender']}\n"
            f"Subject: {e['subject']}\n"
            f"Date: {e['date']}\n"
            f"Body: {e['body']}\n"
        )
    return "\n".join(lines)


_DIGEST_PROMPT = """You are an email analyst. Analyze all emails below and provide a structured digest.

Return a JSON object with these fields:

{{
  "total_emails": <number>,
  "highlights": [
    {{"title": "...", "detail": "...", "sender": "...", "date": "..."}}
  ],
  "deadlines": [
    {{"what": "...", "when": "...", "sender": "...", "urgency": "high|medium|low"}}
  ],
  "action_items": [
    {{"action": "...", "from": "...", "priority": "high|medium|low"}}
  ],
  "topics": [
    {{"topic": "...", "email_count": <number>, "key_senders": ["..."]}}
  ]
}}

Rules:
- highlights: 3-7 most important/notable things. Not every email is a highlight.
- deadlines: anything with a due date, meeting time, expiry, or time-sensitive request. Sort by urgency.
- action_items: things that need a response or action from the user. Include "reply needed", "review requested", etc.
- topics: group emails by theme/conversation topic. Merge related emails.
- For urgency: "high" = within 48 hours or overdue, "medium" = this week, "low" = no rush.
- If an email mentions a deadline or has words like "urgent", "ASAP", "by tomorrow", "due", "expires" — flag it.
- Return ONLY the JSON object, no other text."""


async def analyze_emails(
    emails: list[dict],
    settings: Settings,
) -> dict:
    """Analyze a batch of emails with LLM. Returns structured digest."""
    context = _build_email_context(emails)

    messages = [
        {"role": "system", "content": _DIGEST_PROMPT},
        {"role": "user", "content": f"Analyze these {len(emails)} emails:\n\n{context}"},
    ]

    async with aiohttp.ClientSession() as session:
        try:
            data = await _llm_call(messages, settings, session, temperature=0.1)
            content = _strip_code_fences(data["choices"][0]["message"]["content"])
            result = json.loads(content)
            result["total_emails"] = len(emails)
            return result
        except Exception as exc:
            logger.warning("Email analysis failed: %s", exc)
            return {
                "total_emails": len(emails),
                "highlights": [],
                "deadlines": [],
                "action_items": [],
                "topics": [],
                "error": str(exc),
            }


# ---------------------------------------------------------------------------
# LLM: chat with email context
# ---------------------------------------------------------------------------


async def chat_with_emails(
    emails: list[dict],
    analysis: dict,
    question: str,
    settings: Settings,
) -> str:
    """Answer a question about the emails using the digest context."""
    context = _build_email_context(emails)

    # Include the analysis summary so the LLM has structured context too
    analysis_summary = json.dumps(
        {k: v for k, v in analysis.items() if k != "error"},
        indent=2,
        ensure_ascii=False,
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an email assistant. Answer the user's question based ONLY on "
                "the emails and analysis provided below. Be concise and direct. "
                "If you can't find the answer, say so.\n\n"
                f"Analysis summary:\n{analysis_summary}\n\n"
                f"Full email content:\n{context}"
            ),
        },
        {"role": "user", "content": question},
    ]

    async with aiohttp.ClientSession() as session:
        try:
            data = await _llm_call(messages, settings, session, temperature=0.1)
            return data["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            logger.warning("Email chat failed: %s", exc)
            return f"Error: {exc}"
