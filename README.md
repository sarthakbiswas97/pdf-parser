# DocParser

A document intelligence platform that parses PDFs, extracts structured data, and connects to your workflow — Google Drive, Gmail, Sheets, Calendar.

Upload any PDF. Get classified fields, summaries, and a chat interface. Or skip the upload entirely — pull files from Drive, parse email attachments, or get a daily digest of your inbox with deadlines and action items.

## What It Does

**Parse** — Drop a PDF (or multiple). The system streams results page-by-page, auto-detecting which pages need OCR and which have native text.

**Analyze** — AI classifies the document (invoice, resume, contract, etc.), extracts structured fields with confidence scores, and generates a summary.

**Chat** — Ask questions about any parsed document. Backed by RAG for large docs, with fallback to direct LLM context for smaller ones.

**Email Digest** — Select a date range from your Gmail. The system fetches all emails, identifies highlights, deadlines, and action items. Chat about them. Add deadlines to Google Calendar with one click.

**Batch** — Drop 10 PDFs at once. Results stream in as a grid — each card shows doc type, key fields, and status. Export all as CSV.

**Integrate** — Parsed results auto-push to Google Sheets, fire webhooks, or export as JSON/CSV.

## Quick Start

```bash
# Backend
cd pdf-parser
cp .env.example .env          # add your API keys
pip install -e ".[dev]"
docker compose up -d redis     # Redis for caching
uvicorn src.server:app --port 8000

# Frontend
cd frontend
npm install
npm run dev                    # http://localhost:3000
```

For Google integrations, set up OAuth credentials in Google Cloud Console and add the client ID/secret to `.env`.

## Architecture Overview

```
Frontend (React + Vite)          Backend (FastAPI)
       │                              │
       ├── Upload ──────────► /parse (streaming NDJSON)
       ├── Analyze ─────────► /analyze (LLM: classify + extract + summarize)
       ├── Chat ────────────► /chat (RAG → fallback LLM)
       ├── Drive ───────────► /integrations/drive/*
       ├── Gmail ───────────► /integrations/gmail/*
       ├── Calendar ────────► /integrations/calendar/add
       ├── Batch ───────────► /batch (concurrent, semaphore-bounded)
       └── Settings ────────► /settings, /schemas
                                      │
                              ┌───────┴────────┐
                              │                │
                          Redis            RAG System
                        (cache)         (Qdrant + LLM)
```

**PDF Pipeline**: pdfplumber (ThreadPool) → three-tier router (heuristic + LLM) → tesseract OCR (ProcessPool) → reorder buffer → async generator streaming.

**Non-blocking**: every IO operation runs off the asyncio loop — pdfplumber in threads, OCR in processes, LLM/Google API calls via aiohttp.

See [DESIGN.md](DESIGN.md) for the full technical deep-dive.

## Configuration

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | LLM for routing, analysis, chat |
| `OPENROUTER_MODEL` | Model name (default: gemma-4-31b-it:free) |
| `LLM_BASE_URL` | OpenRouter or OpenAI endpoint |
| `REDIS_URL` | Cache for routing + OCR results |
| `GOOGLE_CLIENT_ID` | OAuth for Drive, Gmail, Sheets, Calendar |
| `GOOGLE_CLIENT_SECRET` | OAuth secret |
| `RAG_BASE_URL` | RAG system URL (optional) |
| `RAG_API_KEY` | RAG tenant key (optional) |

## Project Structure

```
src/
├── pipeline.py          # Streaming parse orchestrator
├── analyzer.py          # Two-stage page analyzer
├── router.py            # Three-tier routing (heuristic + LLM)
├── extractors.py        # Native + OCR extraction
├── intelligence.py      # LLM: classify, extract, summarize, chat
├── email_intelligence.py # Gmail fetch + email analysis
├── google_auth.py       # OAuth + Drive/Sheets/Gmail/Calendar APIs
├── rag_client.py        # RAG system client
├── server.py            # FastAPI (27 endpoints)
├── cache.py             # Redis caching layer
├── schema_store.py      # Custom extraction schemas
└── integrations.py      # Webhook delivery

frontend/src/
├── App.tsx              # Main app shell
├── hooks/use-docparser  # Core state management
├── lib/api.ts           # API client + NDJSON stream reader
└── components/          # 12 React components
```
