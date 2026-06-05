"""Google OAuth 2.0 flow for user-facing Google integrations.

Handles: auth URL generation, code→token exchange, token refresh,
and authenticated API calls to Drive + Sheets.
Tokens stored in data/google_tokens.json (per-session, single user for MVP).
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from urllib.parse import urlencode

import aiohttp

logger = logging.getLogger(__name__)

_session: aiohttp.ClientSession | None = None


async def _get_session() -> aiohttp.ClientSession:
    """Reuse a single aiohttp session for all Google API calls."""
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession()
    return _session


_TOKENS_PATH = Path(__file__).resolve().parent.parent / "data" / "google_tokens.json"
_TOKENS_PATH.parent.mkdir(parents=True, exist_ok=True)

_SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.events",
]


def get_auth_url(client_id: str, redirect_uri: str) -> str:
    """Build the Google OAuth consent URL."""
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)


async def exchange_code(
    code: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
) -> dict | None:
    """Exchange authorization code for access + refresh tokens."""
    try:
        session = await _get_session()
        if True:  # preserve indentation from original context manager
            async with session.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.warning("Token exchange failed: %d %s", resp.status, body[:200])
                    return None
                tokens = await resp.json()
                tokens["obtained_at"] = time.time()
                _save_tokens(tokens)
                logger.info("Google tokens obtained")
                return tokens
    except Exception as exc:
        logger.warning("Token exchange error: %s", exc)
        return None


async def refresh_token(client_id: str, client_secret: str) -> str | None:
    """Refresh the access token using the stored refresh token."""
    tokens = load_tokens()
    if not tokens or "refresh_token" not in tokens:
        return None

    try:
        session = await _get_session()
        if True:  # preserve indentation from original context manager
            async with session.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "refresh_token": tokens["refresh_token"],
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "refresh_token",
                },
            ) as resp:
                if resp.status != 200:
                    return None
                new_tokens = await resp.json()
                tokens["access_token"] = new_tokens["access_token"]
                tokens["obtained_at"] = time.time()
                if "expires_in" in new_tokens:
                    tokens["expires_in"] = new_tokens["expires_in"]
                _save_tokens(tokens)
                return tokens["access_token"]
    except Exception as exc:
        logger.warning("Token refresh error: %s", exc)
        return None


async def get_valid_token(client_id: str, client_secret: str) -> str | None:
    """Get a valid access token, refreshing if expired."""
    tokens = load_tokens()
    if not tokens:
        return None

    # Check if expired (with 60s buffer)
    obtained = tokens.get("obtained_at", 0)
    expires_in = tokens.get("expires_in", 3600)
    if time.time() > obtained + expires_in - 60:
        return await refresh_token(client_id, client_secret)

    return tokens.get("access_token")


def load_tokens() -> dict | None:
    """Load stored tokens from disk."""
    if not _TOKENS_PATH.exists():
        return None
    try:
        return json.loads(_TOKENS_PATH.read_text())
    except Exception:
        return None


def _save_tokens(tokens: dict) -> None:
    """Atomically save tokens to disk."""
    tmp = _TOKENS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(tokens, indent=2))
    tmp.rename(_TOKENS_PATH)


def is_connected() -> bool:
    """Check if we have stored Google tokens."""
    tokens = load_tokens()
    return tokens is not None and "access_token" in tokens


def disconnect() -> None:
    """Remove stored tokens."""
    if _TOKENS_PATH.exists():
        _TOKENS_PATH.unlink()
    logger.info("Google disconnected")


# ---------------------------------------------------------------------------
# Authenticated API helpers
# ---------------------------------------------------------------------------


async def list_drive_folders(client_id: str, client_secret: str) -> list[dict]:
    """List user's Drive folders."""
    token = await get_valid_token(client_id, client_secret)
    if not token:
        return []

    try:
        query = "mimeType='application/vnd.google-apps.folder' and trashed=false"
        url = f"https://www.googleapis.com/drive/v3/files?q={query}&fields=files(id,name)&pageSize=50"
        session = await _get_session()
        if True:  # preserve indentation from original context manager
            async with session.get(url, headers={"Authorization": f"Bearer {token}"}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("files", [])
                return []
    except Exception as exc:
        logger.warning("Drive list folders error: %s", exc)
        return []


async def list_drive_pdfs(folder_id: str, client_id: str, client_secret: str) -> list[dict]:
    """List PDF files in a Drive folder."""
    token = await get_valid_token(client_id, client_secret)
    if not token:
        return []

    try:
        query = f"'{folder_id}' in parents and mimeType='application/pdf' and trashed=false"
        url = f"https://www.googleapis.com/drive/v3/files?q={query}&fields=files(id,name,modifiedTime,size)&pageSize=100"
        session = await _get_session()
        if True:  # preserve indentation from original context manager
            async with session.get(url, headers={"Authorization": f"Bearer {token}"}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("files", [])
                return []
    except Exception as exc:
        logger.warning("Drive list PDFs error: %s", exc)
        return []


async def download_drive_file(file_id: str, client_id: str, client_secret: str) -> bytes | None:
    """Download a file from Drive."""
    token = await get_valid_token(client_id, client_secret)
    if not token:
        return None

    try:
        url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
        session = await _get_session()
        if True:  # preserve indentation from original context manager
            async with session.get(url, headers={"Authorization": f"Bearer {token}"}) as resp:
                if resp.status == 200:
                    return await resp.read()
                return None
    except Exception as exc:
        logger.warning("Drive download error: %s", exc)
        return None


async def list_spreadsheets(client_id: str, client_secret: str) -> list[dict]:
    """List user's Google Sheets."""
    token = await get_valid_token(client_id, client_secret)
    if not token:
        return []

    try:
        query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
        url = f"https://www.googleapis.com/drive/v3/files?q={query}&fields=files(id,name)&pageSize=50"
        session = await _get_session()
        if True:  # preserve indentation from original context manager
            async with session.get(url, headers={"Authorization": f"Bearer {token}"}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("files", [])
                return []
    except Exception as exc:
        logger.warning("Sheets list error: %s", exc)
        return []


async def append_sheet_row(
    spreadsheet_id: str,
    row: list,
    client_id: str,
    client_secret: str,
) -> bool:
    """Append a row to a Google Sheet using OAuth token."""
    token = await get_valid_token(client_id, client_secret)
    if not token:
        return False

    try:
        url = (
            f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}"
            f"/values/Sheet1:append?valueInputOption=USER_ENTERED"
        )
        session = await _get_session()
        if True:  # preserve indentation from original context manager
            async with session.post(
                url,
                json={"values": [row]},
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            ) as resp:
                ok = resp.status == 200
                if not ok:
                    body = await resp.text()
                    logger.warning("Sheets append failed: %d %s", resp.status, body[:200])
                return ok
    except Exception as exc:
        logger.warning("Sheets append error: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Gmail API helpers
# ---------------------------------------------------------------------------


async def list_gmail_pdf_attachments(
    client_id: str,
    client_secret: str,
    after: str = "",
    before: str = "",
    folder: str = "",
    max_results: int = 100,
) -> list[dict]:
    """List recent emails with PDF attachments.

    Args:
        after: date string like '2026/06/01'
        before: date string like '2026/06/05'
        folder: Gmail label filter: 'inbox', 'spam', 'sent', 'all' (default: all)
        max_results: max emails to return

    Returns list of:
        {"message_id", "subject", "sender", "date", "attachments": [{"id", "filename", "size"}]}
    """
    token = await get_valid_token(client_id, client_secret)
    if not token:
        return []

    try:
        # Build Gmail search query
        q = "has:attachment filename:pdf"
        if folder and folder != "all":
            q += f" in:{folder}"
        if after:
            q += f" after:{after}"
        if before:
            q += f" before:{before}"

        headers = {"Authorization": f"Bearer {token}"}

        session = await _get_session()
        if True:  # preserve indentation from original context manager
            # Step 1: list message IDs
            list_url = (
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages"
                f"?q={q}&maxResults={max_results}"
            )
            async with session.get(list_url, headers=headers) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                messages = data.get("messages", [])

            if not messages:
                return []

            # Step 2: fetch each message's metadata + attachment info
            results = []
            for msg in messages:
                msg_url = (
                    f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg['id']}"
                    f"?format=full"
                )
                async with session.get(msg_url, headers=headers) as resp:
                    if resp.status != 200:
                        continue
                    msg_data = await resp.json()

                # Extract headers
                hdrs = {h["name"]: h["value"] for h in msg_data.get("payload", {}).get("headers", [])}
                subject = hdrs.get("Subject", "(no subject)")
                sender = hdrs.get("From", "")
                date = hdrs.get("Date", "")

                # Find PDF attachments in all parts
                attachments = []
                _find_pdf_parts(msg_data.get("payload", {}), attachments)

                if attachments:
                    results.append({
                        "message_id": msg["id"],
                        "subject": subject,
                        "sender": _clean_sender(sender),
                        "date": date,
                        "attachments": attachments,
                    })

            return results
    except Exception as exc:
        logger.warning("Gmail list error: %s", exc)
        return []


def _find_pdf_parts(part: dict, out: list) -> None:
    """Recursively find PDF attachment parts in a Gmail message."""
    filename = part.get("filename", "")
    if filename.lower().endswith(".pdf") and part.get("body", {}).get("attachmentId"):
        out.append({
            "id": part["body"]["attachmentId"],
            "filename": filename,
            "size": part["body"].get("size", 0),
        })
    for sub in part.get("parts", []):
        _find_pdf_parts(sub, out)


def _clean_sender(sender: str) -> str:
    """'John Doe <john@example.com>' → 'John Doe'"""
    if "<" in sender:
        return sender.split("<")[0].strip().strip('"')
    return sender


async def download_gmail_attachment(
    message_id: str,
    attachment_id: str,
    client_id: str,
    client_secret: str,
) -> bytes | None:
    """Download a Gmail attachment by message + attachment ID."""
    token = await get_valid_token(client_id, client_secret)
    if not token:
        return None

    try:
        import base64
        url = (
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}"
            f"/attachments/{attachment_id}"
        )
        session = await _get_session()
        if True:  # preserve indentation from original context manager
            async with session.get(url, headers={"Authorization": f"Bearer {token}"}) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()
                # Gmail returns base64url-encoded data
                raw = data.get("data", "")
                return base64.urlsafe_b64decode(raw + "==")
    except Exception as exc:
        logger.warning("Gmail download error: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Google Calendar
# ---------------------------------------------------------------------------


async def create_calendar_event(
    title: str,
    when: str,
    description: str,
    client_id: str,
    client_secret: str,
) -> dict | None:
    """Create a Google Calendar event. Returns event dict or None on failure.

    Args:
        title: Event title
        when: Date/time string (flexible -- we normalize it)
        description: Event description
    """
    token = await get_valid_token(client_id, client_secret)
    if not token:
        return None

    # Try to parse the datetime. If just a date, make it all-day.
    from datetime import datetime, timedelta
    import re

    event: dict = {"summary": title, "description": description}

    # Try ISO format first, then common patterns
    dt = None
    for fmt in ["%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M", "%Y-%m-%d"]:
        try:
            dt = datetime.strptime(when.strip()[:16], fmt)
            break
        except ValueError:
            continue

    if dt and dt.hour == 0 and dt.minute == 0 and ":" not in when:
        # All-day event
        event["start"] = {"date": dt.strftime("%Y-%m-%d")}
        event["end"] = {"date": (dt + timedelta(days=1)).strftime("%Y-%m-%d")}
    elif dt:
        # Timed event (1 hour default)
        tz = "Asia/Kolkata"  # Default timezone
        event["start"] = {"dateTime": dt.isoformat(), "timeZone": tz}
        event["end"] = {"dateTime": (dt + timedelta(hours=1)).isoformat(), "timeZone": tz}
    else:
        # Can't parse -- make it tomorrow all-day as fallback
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        event["start"] = {"date": tomorrow}
        event["end"] = {"date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")}
        event["description"] = f"Original date: {when}\n\n{description}"

    try:
        url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
        session = await _get_session()
        if True:  # preserve indentation
            async with session.post(
                url,
                json=event,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            ) as resp:
                if resp.status in (200, 201):
                    result = await resp.json()
                    logger.info("Calendar event created: %s", result.get("htmlLink", ""))
                    return {"id": result.get("id"), "link": result.get("htmlLink", "")}
                body = await resp.text()
                logger.warning("Calendar create failed: %d %s", resp.status, body[:200])
                return None
    except Exception as exc:
        logger.warning("Calendar error: %s", exc)
        return None
