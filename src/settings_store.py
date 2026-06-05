"""Simple JSON-file settings store for integration config.

Stores webhook URL, Google Sheets ID, Drive folder ID, etc.
Single file at data/settings.json. Atomic writes.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_SETTINGS_PATH = Path(__file__).resolve().parent.parent / "data" / "settings.json"

_DEFAULTS: dict = {
    "webhook_url": "",
    "webhook_enabled": False,
    "sheets_spreadsheet_id": "",
    "sheets_enabled": False,
    "drive_folder_id": "",
    "drive_enabled": False,
    "google_creds_path": "",
}


def load() -> dict:
    """Load settings from disk, merged with defaults.

    google_creds_path is always sourced from env (never stored in settings.json).
    """
    import os
    settings = dict(_DEFAULTS)
    if _SETTINGS_PATH.exists():
        try:
            stored = json.loads(_SETTINGS_PATH.read_text())
            settings.update(stored)
        except Exception as exc:
            logger.warning("Failed to load settings: %s", exc)
    # Always use env for creds path (security: don't persist in JSON)
    settings["google_creds_path"] = os.environ.get("GOOGLE_CREDS_PATH", "")
    return settings


def save(updates: dict) -> dict:
    """Merge updates into settings and save. Returns full settings."""
    current = load()
    current.update(updates)

    _SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _SETTINGS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(current, indent=2))
    tmp.rename(_SETTINGS_PATH)

    logger.info("Settings saved")
    return current


def get(key: str, default: str = "") -> str:
    """Get a single setting value."""
    return load().get(key, default)
