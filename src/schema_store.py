"""Custom extraction schema store.

Built-in schemas from schemas.py are always available.
Custom schemas live as JSON files in data/schemas/ and override built-ins.
No database needed.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from src.schemas import DOCUMENT_TYPES

logger = logging.getLogger(__name__)

_SCHEMA_DIR = Path(__file__).resolve().parent.parent / "data" / "schemas"
_SCHEMA_DIR.mkdir(parents=True, exist_ok=True)


def _load_custom_schemas() -> dict[str, dict]:
    """Load all custom schemas from disk."""
    custom = {}
    for f in _SCHEMA_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            custom[f.stem] = data
        except Exception as exc:
            logger.warning("Failed to load schema %s: %s", f.name, exc)
    return custom


def list_schemas() -> dict[str, dict]:
    """Return merged dict: built-in + custom (custom overrides built-in)."""
    merged = dict(DOCUMENT_TYPES)
    merged.update(_load_custom_schemas())
    return merged


def get_schema(doc_type: str) -> dict | None:
    """Get a schema by type. Custom takes priority over built-in."""
    custom_path = _SCHEMA_DIR / f"{doc_type}.json"
    if custom_path.exists():
        try:
            return json.loads(custom_path.read_text())
        except Exception:
            pass
    return DOCUMENT_TYPES.get(doc_type)


def save_schema(doc_type: str, schema: dict) -> None:
    """Save a custom schema to disk. Atomic write."""
    if "label" not in schema or "fields" not in schema:
        raise ValueError("Schema must have 'label' and 'fields'")

    tmp = _SCHEMA_DIR / f"{doc_type}.tmp"
    target = _SCHEMA_DIR / f"{doc_type}.json"
    tmp.write_text(json.dumps(schema, indent=2))
    tmp.rename(target)
    logger.info("Saved custom schema: %s", doc_type)


def delete_schema(doc_type: str) -> bool:
    """Delete a custom schema. Cannot delete built-ins."""
    target = _SCHEMA_DIR / f"{doc_type}.json"
    if target.exists():
        target.unlink()
        logger.info("Deleted custom schema: %s", doc_type)
        return True
    return False


def is_custom(doc_type: str) -> bool:
    """Check if a schema is custom (vs built-in)."""
    return (_SCHEMA_DIR / f"{doc_type}.json").exists()
