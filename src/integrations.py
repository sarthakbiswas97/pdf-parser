"""Post-analysis integration: webhook delivery.

Fire-and-forget, never raises. Logs success/failure.
"""

from __future__ import annotations

import logging

import aiohttp

logger = logging.getLogger(__name__)

_WEBHOOK_TIMEOUT = aiohttp.ClientTimeout(total=10)


async def send_webhook(url: str, payload: dict) -> bool:
    """POST JSON to a user-configured URL."""
    if not url:
        return False

    logger.info("Sending webhook to %s", url)

    try:
        async with aiohttp.ClientSession(timeout=_WEBHOOK_TIMEOUT) as session:
            async with session.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json", "User-Agent": "DocParser/1.0"},
            ) as resp:
                ok = 200 <= resp.status < 300
                if ok:
                    logger.info("Webhook delivered: %d", resp.status)
                else:
                    logger.warning("Webhook failed: %d", resp.status)
                return ok
    except Exception as exc:
        logger.warning("Webhook error: %s", exc)
        return False
