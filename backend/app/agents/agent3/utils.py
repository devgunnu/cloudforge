from __future__ import annotations

import json
import re
from typing import Any


# ---------------------------------------------------------------------------
# Code / markdown helpers
# ---------------------------------------------------------------------------

_FENCE_RE = re.compile(
    r"^```(?:[a-zA-Z0-9_+-]*)?\n(.*?)^```[ \t]*$",
    re.MULTILINE | re.DOTALL,
)


def strip_code_fences(text: str) -> str:
    """
    Remove markdown code fences from LLM output.
    Handles ``` `` `python, ```typescript, etc.
    Returns the interior content if a fence is found, else the original text.
    """
    text = text.strip()
    match = _FENCE_RE.search(text)
    if match:
        return match.group(1).rstrip()
    return text


# ---------------------------------------------------------------------------
# JSON extraction helpers
# ---------------------------------------------------------------------------


def safe_json_extract(text: str) -> Any:
    """
    Extract and parse the first JSON object or array from a string.
    Strips markdown fences first, then tries direct parse, then first-brace scan.
    Raises ValueError if no valid JSON can be found.
    """
    clean = strip_code_fences(text)

    # Try direct parse first
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # Scan for first '{' or '['
    for start_char, end_char in (("{", "}"), ("[", "]")):
        idx = clean.find(start_char)
        if idx >= 0:
            # Find the matching closing brace by counting depth, respecting strings
            depth = 0
            in_string = False
            escape_next = False

            for i, ch in enumerate(clean[idx:], start=idx):
                if escape_next:
                    escape_next = False
                    continue

                if ch == '\\':
                    escape_next = True
                    continue

                if ch == '"' and not escape_next:
                    in_string = not in_string
                    continue

                if not in_string:
                    if ch == start_char:
                        depth += 1
                    elif ch == end_char:
                        depth -= 1
                        if depth == 0:
                            try:
                                return json.loads(clean[idx : i + 1])
                            except json.JSONDecodeError:
                                # If this fails, keep scanning for another valid JSON
                                break

    # Show more context for debugging
    preview_len = min(500, len(clean))
    last_part = clean[-100:] if len(clean) > 100 else "(response too short)"
    raise ValueError(
        f"No valid JSON found in response. "
        f"Length: {len(clean)} chars. "
        f"First {preview_len} chars: {clean[:preview_len]!r}. "
        f"Last 100 chars: {last_part!r}"
    )


# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------


def truncate_list(items: list, max_items: int) -> list:
    """Keep only the last `max_items` elements of a list to prevent unbounded growth."""
    if len(items) > max_items:
        return items[-max_items:]
    return items
