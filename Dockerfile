# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM python:3.11-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        libtesseract-dev \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir --prefix=/install .

# =============================================================================
# Stage 2: Production runtime
# =============================================================================
FROM python:3.11-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        tesseract-ocr \
        libgl1 \
        libglib2.0-0 \
        fonts-dejavu-core \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /install /usr/local
COPY src/ src/

# Data directory for schemas, settings, tokens (mount as volume in prod)
RUN mkdir -p data/schemas

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

# =============================================================================
# Stage 3: Test (extends runtime)
# =============================================================================
FROM runtime AS test

COPY pyproject.toml .
RUN pip install --no-cache-dir ".[dev]"
COPY tests/ tests/
RUN python -m tests.generate_test_pdf 10 tests/sample.pdf
