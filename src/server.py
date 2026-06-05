"""FastAPI server -- parse, analyze, chat, integrations."""

from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import aiohttp
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from fastapi.responses import HTMLResponse, RedirectResponse

from src import google_auth, schema_store, settings_store
from src.cache import RedisCache
from src.config import Settings
from src.integrations import send_webhook
from src.intelligence import analyze_document, chat_with_document
from src.pipeline import parse_pdf
from src.rag_client import RAGClient

logger = logging.getLogger(__name__)

_settings: Settings | None = None


def _get_settings() -> Settings:
    """Get settings or raise 500 if not initialized."""
    if _settings is None:
        raise HTTPException(status_code=500, detail="Server not initialized")
    return _settings
_cache: RedisCache | None = None
_rag: RAGClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global _settings, _cache, _rag

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    _settings = Settings.from_env()
    _cache = RedisCache()
    await _cache.connect(_settings)

    _rag = RAGClient(_settings)
    await _rag.connect()
    if _settings.has_rag():
        if await _rag.health():
            logger.info("RAG connected at %s", _settings.rag_base_url)
            if not _settings.rag_api_key:
                await _rag.register()
        else:
            logger.warning("RAG not reachable -- chat uses fallback")

    logger.info("DocParser ready")
    yield

    await _rag.close()
    await _cache.close()


app = FastAPI(title="DocParser", lifespan=lifespan)


# ===================================================================
# PARSE (existing)
# ===================================================================


async def _stream_results(pdf_path: str) -> AsyncGenerator[bytes, None]:
    _get_settings()  # raises 500 if not initialized
    async for result in parse_pdf(pdf_path, _settings, _cache):
        yield result.to_json().encode() + b"\n"


@app.post("/parse")
async def parse_endpoint(file: UploadFile) -> StreamingResponse:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    async def cleanup_stream() -> AsyncGenerator[bytes, None]:
        try:
            async for chunk in _stream_results(tmp_path):
                yield chunk
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    return StreamingResponse(
        cleanup_stream(),
        media_type="application/x-ndjson",
        headers={"X-Content-Type-Options": "nosniff"},
    )


# ===================================================================
# ANALYZE (with post-analysis hooks)
# ===================================================================


class AnalyzeRequest(BaseModel):
    full_text: str
    filename: str = "document.pdf"


@app.post("/analyze")
async def analyze_endpoint(req: AnalyzeRequest) -> dict:
    _get_settings()  # raises 500 if not initialized
    if not _settings.has_llm():
        raise HTTPException(status_code=503, detail="LLM not configured")

    result = await analyze_document(req.full_text, _settings)

    # Background hooks (non-blocking, don't add latency)
    asyncio.create_task(
        _post_analysis_hooks(req.filename, result),
        name="post-analysis-hooks",
    )

    # RAG ingest
    if _rag and _rag.is_ready:
        asyncio.create_task(
            _rag_ingest_bg(req.filename, req.full_text),
            name="rag-ingest",
        )
        result["rag_ingested"] = True
    else:
        result["rag_ingested"] = False

    return result


async def _post_analysis_hooks(filename: str, result: dict) -> None:
    """Fire webhook + sheets after analysis. Runs in background."""
    s = settings_store.load()

    # Webhook
    if s.get("webhook_enabled") and s.get("webhook_url"):
        payload = {
            "event": "document.analyzed",
            "filename": filename,
            "doc_type": result.get("doc_type"),
            "doc_type_label": result.get("doc_type_label"),
            "fields": result.get("fields"),
            "summary": result.get("summary"),
        }
        await send_webhook(s["webhook_url"], payload)

    # Google Sheets (via OAuth)
    if s.get("sheets_enabled") and s.get("sheets_spreadsheet_id") and google_auth.is_connected():
        _get_settings()  # raises 500 if not initialized
        fields = result.get("fields", {})
        row = [filename, result.get("doc_type", "")]
        for fd in fields.values():
            val = fd.get("value", "") if isinstance(fd, dict) else fd
            if isinstance(val, (list, dict)):
                val = json.dumps(val, ensure_ascii=False)
            row.append(str(val) if val is not None else "")
        await google_auth.append_sheet_row(
            s["sheets_spreadsheet_id"], row,
            _settings.google_client_id, _settings.google_client_secret,
        )


async def _rag_ingest_bg(filename: str, text: str) -> None:
    assert _rag is not None
    try:
        await _rag.ingest(filename, text)
    except Exception as exc:
        logger.warning("RAG ingest failed: %s", exc)


# ===================================================================
# CHAT (RAG with fallback)
# ===================================================================


class ChatRequest(BaseModel):
    full_text: str
    question: str
    session_id: str | None = None


@app.post("/chat")
async def chat_endpoint(req: ChatRequest) -> dict:
    _get_settings()  # raises 500 if not initialized

    if _rag and _rag.is_ready:
        rag_result = await _rag.query(req.question, req.session_id)
        if rag_result is not None and not rag_result.get("is_abstention", False):
            return {
                "answer": rag_result.get("answer", ""),
                "citations": rag_result.get("citations", []),
                "confidence": rag_result.get("confidence", 0),
                "is_abstention": False,
                "source": "rag",
                "session_id": rag_result.get("session_id"),
            }
        if rag_result and rag_result.get("is_abstention"):
            logger.info("RAG abstained, falling back to LLM")

    if not _settings.has_llm():
        raise HTTPException(status_code=503, detail="No LLM or RAG configured")

    async with aiohttp.ClientSession() as session:
        answer = await chat_with_document(req.full_text, req.question, _settings, session)
    return {
        "answer": answer,
        "citations": [],
        "confidence": None,
        "is_abstention": False,
        "source": "fallback",
        "session_id": None,
    }


# ===================================================================
# EXPORT
# ===================================================================


class ExportRequest(BaseModel):
    fields: dict
    doc_type: str
    format: str


@app.post("/export")
async def export_endpoint(req: ExportRequest) -> StreamingResponse:
    if req.format == "json":
        content = json.dumps(req.fields, indent=2, ensure_ascii=False)
        return StreamingResponse(
            iter([content.encode()]),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={req.doc_type}_data.json"},
        )
    if req.format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["Field", "Value", "Confidence"])
        for name, data in req.fields.items():
            if isinstance(data, dict):
                val = data.get("value", "")
                conf = data.get("confidence", "")
                if isinstance(val, (list, dict)):
                    val = json.dumps(val, ensure_ascii=False)
                writer.writerow([name, val, conf])
        return StreamingResponse(
            iter([buf.getvalue().encode()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={req.doc_type}_data.csv"},
        )
    raise HTTPException(status_code=400, detail="Format must be 'json' or 'csv'")


# ===================================================================
# SETTINGS
# ===================================================================


@app.get("/settings")
async def get_settings() -> dict:
    s = settings_store.load()
    # Don't expose creds path to frontend
    s.pop("google_creds_path", None)
    return s


class SettingsUpdate(BaseModel):
    webhook_url: str | None = None
    webhook_enabled: bool | None = None
    sheets_spreadsheet_id: str | None = None
    sheets_enabled: bool | None = None
    drive_folder_id: str | None = None
    drive_enabled: bool | None = None


@app.post("/settings")
async def update_settings(req: SettingsUpdate) -> dict:
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    s = settings_store.save(updates)
    s.pop("google_creds_path", None)
    return s


# ===================================================================
# SCHEMAS
# ===================================================================


@app.get("/schemas")
async def list_schemas_endpoint() -> dict:
    schemas = schema_store.list_schemas()
    result = {}
    for name, schema in schemas.items():
        result[name] = {**schema, "is_custom": schema_store.is_custom(name)}
    return result


class SchemaCreate(BaseModel):
    type_name: str
    label: str
    description: str = ""
    fields: dict[str, str]


@app.post("/schemas")
async def create_schema(req: SchemaCreate) -> dict:
    schema = {
        "label": req.label,
        "description": req.description,
        "fields": req.fields,
    }
    schema_store.save_schema(req.type_name, schema)
    return {"status": "saved", "type": req.type_name}


@app.delete("/schemas/{type_name}")
async def delete_schema(type_name: str) -> dict:
    if schema_store.delete_schema(type_name):
        return {"status": "deleted", "type": type_name}
    raise HTTPException(status_code=404, detail="Custom schema not found")


# ===================================================================
# GOOGLE OAUTH
# ===================================================================


@app.get("/auth/google")
async def google_auth_start():
    """Redirect user to Google's OAuth consent screen."""
    _get_settings()  # raises 500 if not initialized
    url = google_auth.get_auth_url(_settings.google_client_id, _settings.google_redirect_uri)
    return RedirectResponse(url)


@app.get("/auth/google/callback")
async def google_auth_callback(code: str = ""):
    """Handle OAuth callback from Google."""
    _get_settings()  # raises 500 if not initialized
    if not code:
        return HTMLResponse("<h3>Authorization failed</h3><p>No code received.</p>", status_code=400)

    tokens = await google_auth.exchange_code(
        code, _settings.google_client_id, _settings.google_client_secret, _settings.google_redirect_uri,
    )
    if not tokens:
        return HTMLResponse("<h3>Authorization failed</h3><p>Token exchange failed.</p>", status_code=400)

    # Redirect back to the app
    return HTMLResponse(
        "<script>window.opener?.postMessage('google_connected','*');window.close();</script>"
        "<p>Connected! You can close this window.</p>"
    )


@app.get("/auth/google/status")
async def google_auth_status() -> dict:
    """Check if Google is connected."""
    return {"connected": google_auth.is_connected()}


@app.post("/auth/google/disconnect")
async def google_auth_disconnect() -> dict:
    google_auth.disconnect()
    return {"connected": False}


# ===================================================================
# GOOGLE DRIVE (user's Drive via OAuth)
# ===================================================================


@app.get("/integrations/drive/folders")
async def drive_folders() -> dict:
    """List user's Google Drive folders."""
    _get_settings()  # raises 500 if not initialized
    if not google_auth.is_connected():
        raise HTTPException(status_code=401, detail="Google not connected")
    folders = await google_auth.list_drive_folders(_settings.google_client_id, _settings.google_client_secret)
    return {"folders": folders}


@app.get("/integrations/drive/browse")
async def drive_browse(folder_id: str = "root") -> dict:
    """List folders + PDFs in a Drive folder for browsing."""
    _get_settings()  # raises 500 if not initialized
    if not google_auth.is_connected():
        raise HTTPException(status_code=401, detail="Google not connected")

    token = await google_auth.get_valid_token(_settings.google_client_id, _settings.google_client_secret)
    if not token:
        raise HTTPException(status_code=401, detail="Token expired")

    items = []
    async with aiohttp.ClientSession() as session:
        # Get folders + PDFs in one call
        query = f"'{folder_id}' in parents and trashed=false and (mimeType='application/vnd.google-apps.folder' or mimeType='application/pdf')"
        url = f"https://www.googleapis.com/drive/v3/files?q={query}&fields=files(id,name,mimeType,size,modifiedTime)&orderBy=folder,name&pageSize=100"
        async with session.get(url, headers={"Authorization": f"Bearer {token}"}) as resp:
            if resp.status == 200:
                data = await resp.json()
                items = data.get("files", [])

    folders = [f for f in items if f["mimeType"] == "application/vnd.google-apps.folder"]
    pdfs = [f for f in items if f["mimeType"] == "application/pdf"]
    return {"folders": folders, "pdfs": pdfs}


@app.post("/integrations/drive/parse/{file_id}")
async def drive_parse_file(file_id: str, filename: str = "document.pdf") -> StreamingResponse:
    """Download a PDF from Drive and stream parse results."""
    _get_settings()  # raises 500 if not initialized
    if not google_auth.is_connected():
        raise HTTPException(status_code=401, detail="Google not connected")

    file_bytes = await google_auth.download_drive_file(
        file_id, _settings.google_client_id, _settings.google_client_secret,
    )
    if not file_bytes:
        raise HTTPException(status_code=404, detail="Failed to download file from Drive")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    async def stream() -> AsyncGenerator[bytes, None]:
        try:
            async for result in parse_pdf(tmp_path, _settings, _cache):
                yield result.to_json().encode() + b"\n"
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@app.post("/integrations/drive/sync")
async def drive_sync() -> dict:
    """Parse all PDFs from the configured Drive folder."""
    _get_settings()  # raises 500 if not initialized
    s = settings_store.load()
    folder_id = s.get("drive_folder_id")
    if not folder_id:
        raise HTTPException(status_code=400, detail="No Drive folder configured")
    if not google_auth.is_connected():
        raise HTTPException(status_code=401, detail="Google not connected")

    files = await google_auth.list_drive_pdfs(
        folder_id, _settings.google_client_id, _settings.google_client_secret,
    )
    if not files:
        return {"status": "no_files", "count": 0}

    results = []
    for f in files:
        file_bytes = await google_auth.download_drive_file(
            f["id"], _settings.google_client_id, _settings.google_client_secret,
        )
        if not file_bytes:
            results.append({"name": f["name"], "status": "download_failed"})
            continue

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            pages = []
            async for page_result in parse_pdf(tmp_path, _settings, _cache):
                pages.append(page_result)
            full_text = "\n\n".join(p.text for p in pages)
            analysis = await analyze_document(full_text, _settings)
            asyncio.create_task(_post_analysis_hooks(f["name"], analysis))
            results.append({"name": f["name"], "status": "parsed", "doc_type": analysis.get("doc_type"), "pages": len(pages)})
        except Exception as exc:
            results.append({"name": f["name"], "status": f"error: {exc}"})
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    return {"status": "synced", "count": len(results), "files": results}


# ===================================================================
# GOOGLE SHEETS (user's Sheets via OAuth)
# ===================================================================


@app.get("/integrations/sheets/list")
async def sheets_list() -> dict:
    """List user's Google Sheets."""
    _get_settings()  # raises 500 if not initialized
    if not google_auth.is_connected():
        raise HTTPException(status_code=401, detail="Google not connected")
    sheets = await google_auth.list_spreadsheets(_settings.google_client_id, _settings.google_client_secret)
    return {"sheets": sheets}


# ===================================================================
# GMAIL (PDF attachments from email)
# ===================================================================


@app.get("/integrations/gmail/attachments")
async def gmail_attachments(after: str = "", before: str = "", folder: str = "") -> dict:
    """List recent emails with PDF attachments, filtered by date range and folder."""
    _get_settings()  # raises 500 if not initialized
    if not google_auth.is_connected():
        raise HTTPException(status_code=401, detail="Google not connected")

    emails = await google_auth.list_gmail_pdf_attachments(
        _settings.google_client_id,
        _settings.google_client_secret,
        after=after,
        before=before,
        folder=folder,
    )
    return {"emails": emails}


@app.post("/integrations/gmail/parse/{message_id}/{attachment_id}")
async def gmail_parse(message_id: str, attachment_id: str, filename: str = "email_attachment.pdf") -> StreamingResponse:
    """Download a PDF attachment from Gmail and stream parse results."""
    _get_settings()  # raises 500 if not initialized
    if not google_auth.is_connected():
        raise HTTPException(status_code=401, detail="Google not connected")

    file_bytes = await google_auth.download_gmail_attachment(
        message_id, attachment_id,
        _settings.google_client_id, _settings.google_client_secret,
    )
    if not file_bytes:
        raise HTTPException(status_code=404, detail="Failed to download attachment")

    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    async def stream() -> AsyncGenerator[bytes, None]:
        try:
            async for result in parse_pdf(tmp_path, _settings, _cache):
                yield result.to_json().encode() + b"\n"
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    return StreamingResponse(stream(), media_type="application/x-ndjson")


# ===================================================================
# EMAIL DIGEST (chat with your emails)
# ===================================================================


# In-memory store for last digest (so chat can reference it)
_last_email_digest: dict = {"emails": [], "analysis": {}, "request_id": 0}
_digest_counter = 0


@app.get("/integrations/gmail/digest")
async def email_digest(after: str = "", before: str = "", folder: str = "") -> dict:
    """Fetch emails in date range, analyze with LLM, return structured digest."""
    global _digest_counter
    _get_settings()
    if not google_auth.is_connected():
        raise HTTPException(status_code=401, detail="Google not connected")
    if not _settings.has_llm():
        raise HTTPException(status_code=503, detail="LLM not configured")

    from src.email_intelligence import fetch_emails, analyze_emails

    # Track this request -- only the latest request stores its result for chat
    _digest_counter += 1
    this_request = _digest_counter

    # Fetch
    emails = await fetch_emails(
        after=after, before=before, folder=folder,
        client_id=_settings.google_client_id,
        client_secret=_settings.google_client_secret,
    )

    if not emails:
        return {"total_emails": 0, "highlights": [], "deadlines": [], "action_items": [], "topics": []}

    # Analyze
    analysis = await analyze_emails(emails, _settings)

    # Only store if this is still the latest request (prevents stale overwrites)
    if this_request == _digest_counter:
        _last_email_digest["emails"] = emails
        _last_email_digest["analysis"] = analysis
        _last_email_digest["request_id"] = this_request

    # Include email list in response (for the Emails tab in frontend)
    analysis["emails"] = [
        {
            "message_id": e["message_id"],
            "subject": e["subject"],
            "sender": e["sender"],
            "date": e["date"],
            "body": e["body"][:200],
            "attachments": e.get("attachments", []),
        }
        for e in emails
    ]

    return analysis


class EmailChatRequest(BaseModel):
    question: str
    message_id: str | None = None  # if set, chat about this specific email


@app.post("/integrations/gmail/chat")
async def email_chat(req: EmailChatRequest) -> dict:
    """Chat about emails. If message_id is set, narrows to that email only."""
    _get_settings()
    if not _settings.has_llm():
        raise HTTPException(status_code=503, detail="LLM not configured")

    all_emails = _last_email_digest.get("emails", [])
    analysis = _last_email_digest.get("analysis", {})
    if not all_emails:
        raise HTTPException(status_code=400, detail="No email digest loaded. Run digest first.")

    from src.email_intelligence import chat_with_emails

    # Narrow to single email if message_id provided
    if req.message_id:
        emails = [e for e in all_emails if e["message_id"] == req.message_id]
        if not emails:
            raise HTTPException(status_code=404, detail="Email not found")
    else:
        emails = all_emails

    answer = await chat_with_emails(emails, analysis, req.question, _settings)
    return {"answer": answer, "context": "single" if req.message_id else "all"}


# ===================================================================
# CALENDAR
# ===================================================================


class CalendarEventRequest(BaseModel):
    title: str
    when: str
    description: str = ""


@app.post("/integrations/calendar/add")
async def add_calendar_event(req: CalendarEventRequest) -> dict:
    """Create a Google Calendar event from a deadline."""
    _get_settings()
    if not google_auth.is_connected():
        raise HTTPException(status_code=401, detail="Google not connected")

    result = await google_auth.create_calendar_event(
        title=req.title,
        when=req.when,
        description=req.description,
        client_id=_settings.google_client_id,
        client_secret=_settings.google_client_secret,
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create calendar event")
    return {"status": "created", **result}


# ===================================================================
# BATCH UPLOAD
# ===================================================================


@app.post("/batch")
async def batch_upload(files: list[UploadFile]) -> StreamingResponse:
    """Upload multiple PDFs. Streams NDJSON: one result per completed document."""
    _get_settings()
    if not _settings.has_llm():
        raise HTTPException(status_code=503, detail="LLM not configured")

    import tempfile

    batch_sem = asyncio.Semaphore(3)  # max 3 concurrent parses

    async def process_one(file: UploadFile) -> dict:
        async with batch_sem:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                content = await file.read()
                tmp.write(content)
                tmp_path = tmp.name

            try:
                # Parse
                pages = []
                async for page_result in parse_pdf(tmp_path, _settings, _cache):
                    pages.append(page_result)

                full_text = "\n\n".join(p.text for p in pages)

                # Analyze
                from src.intelligence import analyze_document
                analysis = await analyze_document(full_text, _settings)

                # Extract key scalar fields for table display
                key_fields = {}
                for k, v in analysis.get("fields", {}).items():
                    val = v.get("value") if isinstance(v, dict) else v
                    if val is not None and not isinstance(val, (list, dict)):
                        key_fields[k] = str(val)
                        if len(key_fields) >= 4:
                            break

                return {
                    "filename": file.filename or "unknown.pdf",
                    "status": "done",
                    "doc_type": analysis.get("doc_type", "other"),
                    "doc_type_label": analysis.get("doc_type_label", "Unknown"),
                    "summary": analysis.get("summary", ""),
                    "key_fields": key_fields,
                    "pages": len(pages),
                }
            except Exception as exc:
                return {
                    "filename": file.filename or "unknown.pdf",
                    "status": "error",
                    "error": str(exc),
                }
            finally:
                Path(tmp_path).unlink(missing_ok=True)

    async def stream() -> AsyncGenerator[bytes, None]:
        tasks = [asyncio.create_task(process_one(f)) for f in files]
        for task in asyncio.as_completed(tasks):
            result = await task
            yield json.dumps(result, ensure_ascii=False).encode() + b"\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")


# ===================================================================
# WEBHOOK TEST
# ===================================================================


@app.post("/integrations/webhook/test")
async def test_webhook() -> dict:
    s = settings_store.load()
    url = s.get("webhook_url")
    if not url:
        raise HTTPException(status_code=400, detail="No webhook URL configured")
    ok = await send_webhook(url, {"event": "webhook.test", "message": "DocParser webhook is working!"})
    return {"delivered": ok, "url": url}


# ===================================================================
# HEALTH + FRONTEND
# ===================================================================


@app.get("/health")
async def health() -> dict:
    rag_ok = await _rag.health() if _rag else False
    return {"status": "ok", "rag": "connected" if rag_ok else "unavailable"}


_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(_STATIC_DIR / "index.html")
