# Design & Engineering

## System Architecture

```
                     ┌─────────────┐
                     │   Frontend   │  React + Vite + Tailwind
                     │   :3000      │  12 components, 1 state hook
                     └──────┬──────┘
                            │ HTTP (proxied)
                     ┌──────▼──────┐
                     │   FastAPI    │  27 endpoints, async
                     │   :8000     │  
                     └──┬───┬───┬──┘
                        │   │   │
              ┌─────────┘   │   └─────────┐
              ▼             ▼             ▼
          ┌───────┐   ┌─────────┐   ┌──────────┐
          │ Redis │   │   RAG   │   │ Google   │
          │ :6379 │   │  :8001  │   │  APIs    │
          │ cache │   │ Qdrant  │   │ OAuth2   │
          └───────┘   └─────────┘   └──────────┘
```

## PDF Parsing Pipeline

### Non-Blocking Execution Model

Every operation runs off the main asyncio loop:

| Operation | Executor | Why |
|-----------|----------|-----|
| pdfplumber (page analysis) | ThreadPoolExecutor | C-backed, releases GIL |
| tesseract OCR | ProcessPoolExecutor | CPU-bound, bypasses GIL |
| LLM calls | aiohttp | Native async IO |
| Redis cache | redis.asyncio | Native async IO |
| Google APIs | aiohttp | Native async IO |

### Two-Stage Page Analyzer

Stage 1 (cheap): extract text + compute image coverage + text quality score from metadata. All O(n) on already-loaded data.

Pre-screen: calls the heuristic router inline (pure function) to decide if image rendering is needed.

Stage 2 (conditional): renders page to PNG (~50ms) only if pre-screen says OCR or ambiguous. Text-only pages skip rendering entirely.

### Three-Tier Routing

```
Tier 0 (instant):  blank page, no text, garbled text quality, pure text
Tier 1 (coverage): image coverage > threshold → OCR (even with text overlay)
Tier 2 (fallback): text amount thresholds
LLM (ambiguous):   ~10% of pages, tool-calling via OpenRouter
```

The critical edge case: a full-bleed scanned image with a tiny text overlay correctly routes to OCR because coverage dominates.

Text quality detection catches garbled invisible OCR layers — pages where pdfplumber extracts text but it's junk from a prior bad OCR pass.

### Streaming & Ordering

The pipeline uses a producer/consumer pattern with a reorder buffer:

- **Producer**: iterates pages, creates asyncio.Future per page, spawns processing tasks
- **Processor**: per page — routes, extracts, resolves the Future
- **Consumer**: awaits Futures in strict order (1, 2, 3...) and yields results

Page 30 can't stream before page 25, even if 30 finishes first. The reorder buffer holds completed results until the next expected page resolves.

**Backpressure**: an inflight semaphore (default 20) limits concurrent pages in the pipeline. For a 1000-page PDF, only 20 pages exist in memory at once.

**Event signaling**: replaced busy-wait polling with asyncio.Event for zero-CPU-waste coordination.

## Document Intelligence

### LLM Pipeline

```
Full text → classify (LLM) ──┐
                              ├── concurrent
Full text → summarize (LLM) ─┘
                              │
Classification result ────────▼
                     extract_fields (LLM, schema-driven)
```

Classify and summarize run concurrently. Field extraction runs after classification (needs the doc type to select the right schema).

### Custom Schemas

Built-in schemas (invoice, resume, contract, etc.) are in `schemas.py`. Custom schemas are JSON files in `data/schemas/` that override or extend built-ins. The LLM uses the schema's field descriptions as extraction instructions.

### Caching

Content-addressed Redis cache:
- **Routing decisions**: keyed by `sha256(metrics)`, TTL 24h
- **OCR results**: keyed by `sha256(image_bytes)`, TTL 24h

Fail-open: if Redis is down, the pipeline runs without caching.

## Chat Architecture

### RAG-First with Fallback

```
Question → RAG system → answer + citations
              │
              └── abstains? → fallback: stuff text into LLM context
```

The RAG system (Qdrant + hybrid search + BGE embeddings) handles large documents. If RAG abstains (low confidence), the server silently falls back to stuffing truncated text into the LLM prompt. The user always gets an answer.

### Email Chat

For email digest, RAG is not used — 200 emails × 400 chars each fits in one LLM context window. The system builds a context string from all emails and sends it with the user's question. When a single email is selected, only that email's content is sent.

## Google Integrations

Single OAuth 2.0 flow with four scopes:
- `drive.readonly` — browse and download files
- `spreadsheets` — append extracted fields as rows
- `gmail.readonly` — fetch emails and attachments
- `calendar.events` — create events from detected deadlines

All API calls use a shared aiohttp session. Tokens are stored in `data/google_tokens.json` with automatic refresh.

## Batch Processing

Multiple PDFs are processed with `asyncio.Semaphore(3)` — max 3 concurrent parses. Results stream as NDJSON (one line per completed document). Memory stays bounded at ~300MB peak regardless of batch size.

```
POST /batch (multipart, N files)
  → Semaphore(3) gates concurrent processing
  → Each file: parse → analyze → yield NDJSON result
  → Frontend renders results as they arrive (grid, not list)
```

## Performance Budget

| Operation | Latency | Memory |
|-----------|---------|--------|
| Text page (native) | ~20ms | negligible |
| OCR page (tesseract) | ~1-3s | ~100MB |
| LLM routing (ambiguous) | ~500ms | negligible |
| Document analysis | ~3-5s | negligible |
| Email digest (50 emails) | ~15-20s | ~10MB |
| Batch (10 PDFs, 3 concurrent) | ~40s total | ~300MB peak |

## Scale Considerations

Current design handles ~15 concurrent PDF requests on a 4-core/8GB machine. For 100K+ concurrent:

- Replace ProcessPoolExecutor with GPU OCR (PaddleOCR, 10-50x speedup)
- Add job queue (SQS/Redis Streams) to decouple ingestion from processing
- Auto-scale workers on queue depth with spot instances
- Cache aggressively — a $550/mo Redis cluster saves $10K+/mo in compute

Realistic cost at scale: ~$25K/mo for 100K concurrent with queue + GPU + spot + cache, vs $8M/mo with naive horizontal scaling.

## Remote OCR API Scenario

If OCR were a remote API (500ms latency per page):

- Replace ProcessPoolExecutor with pure async (IO-bound, not CPU-bound)
- Increase concurrency from 4 to 50+ (bound by API rate limit, not CPU)
- Add retry with exponential backoff + circuit breaker
- Cache becomes critical (cost per call, not fixed compute)
- Client-side rate limiter to avoid 429 storms
