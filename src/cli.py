"""CLI entry point -- streams NDJSON to stdout."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from src.cache import RedisCache
from src.config import Settings
from src.pipeline import parse_pdf


async def _run(pdf_path: str, verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,  # logs to stderr, results to stdout
    )

    settings = Settings.from_env()
    cache = RedisCache()
    await cache.connect(settings)

    try:
        async for result in parse_pdf(pdf_path, settings, cache):
            sys.stdout.write(result.to_json() + "\n")
            sys.stdout.flush()
    finally:
        await cache.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Streaming PDF parser with intelligent routing",
    )
    parser.add_argument("pdf_path", help="Path to the PDF file to parse")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    asyncio.run(_run(args.pdf_path, args.verbose))


if __name__ == "__main__":
    main()
