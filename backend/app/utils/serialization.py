from __future__ import annotations

from datetime import datetime
from typing import Any

from bson import ObjectId


def serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    """Recursively convert ObjectId and datetime values to JSON-serializable types."""
    result = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        elif isinstance(value, list):
            result[key] = [
                serialize_doc(item) if isinstance(item, dict) else
                str(item) if isinstance(item, ObjectId) else
                item.isoformat() if isinstance(item, datetime) else
                item
                for item in value
            ]
        else:
            result[key] = value
    return result
