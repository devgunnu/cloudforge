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

# Matches <think>...</think> blocks emitted by chain-of-thought models (e.g. Groq 8b)
_THINK_RE = re.compile(r"<think>(.*?)</think>", re.DOTALL | re.IGNORECASE)


def strip_think_tags(text: str) -> str:
    """Remove <think>...</think> chain-of-thought blocks from LLM output.

    If stripping think tags leaves nothing meaningful, the content inside the
    think block is returned as a fallback — some models (Groq 8b) occasionally
    place the actual code inside the think block.
    """
    stripped = _THINK_RE.sub("", text).strip()
    if stripped:
        return stripped
    # Fallback: extract content from inside think blocks
    inner_parts = _THINK_RE.findall(text)
    if inner_parts:
        return "\n".join(p.strip() for p in inner_parts if p.strip())
    return stripped


def strip_code_fences(text: str) -> str:
    """
    Remove markdown code fences from LLM output.
    Handles ``` `` `python, ```typescript, etc.
    Returns the interior content if a fence is found, else the original text.
    Also strips <think>...</think> blocks before processing.
    """
    text = strip_think_tags(text)
    text = text.strip()
    match = _FENCE_RE.search(text)
    if match:
        return match.group(1).rstrip()
    return text


# ---------------------------------------------------------------------------
# JSON extraction helpers
# ---------------------------------------------------------------------------


def _escape_control_chars_in_strings(text: str) -> str:
    """Escape raw control characters (newline, tab, carriage return) that appear
    inside JSON string literals.  Structural whitespace between tokens is left
    intact so json.loads() can still parse the document skeleton.

    This handles the common Groq / local-model failure mode where multiline
    HCL or code content is placed inside a JSON "content" field without proper
    escaping.
    """
    result: list[str] = []
    in_string = False
    escape_next = False
    for ch in text:
        if escape_next:
            result.append(ch)
            escape_next = False
            continue
        if ch == "\\" and in_string:
            result.append(ch)
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            result.append(ch)
            continue
        if in_string:
            if ch == "\n":
                result.append("\\n")
            elif ch == "\r":
                result.append("\\r")
            elif ch == "\t":
                result.append("\\t")
            else:
                result.append(ch)
        else:
            result.append(ch)
    return "".join(result)


def safe_json_extract(text: str) -> Any:
    """
    Extract and parse the first JSON object or array from a string.

    Steps:
    1. Strip <think>...</think> chain-of-thought blocks (Groq 8b).
    2. Normalize CRLF → LF (prevents fence regex failures on Windows/HTTP responses).
    3. Strip markdown code fences (full regex match, then partial fallback).
    4. Try json.loads() on the raw cleaned content.
    5. Fix double-escaped backslash-quotes (\\") and retry.
    6. Scan for the first '{' or '[' and parse from there.
    7. Use regex to find any JSON object/array anywhere in the response.

    Raises ValueError if no valid JSON can be found.
    """
    # Step 1: strip chain-of-thought tags first
    text = strip_think_tags(text)

    # Step 2: normalize line endings — CRLF breaks ^/$ anchors in MULTILINE regex
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # Step 3: strip code fences (operates on already-think-stripped text)
    clean = text.strip()
    fence_match = _FENCE_RE.search(clean)
    if fence_match:
        clean = fence_match.group(1).rstrip()
    elif clean.startswith('```'):
        # Partial fence strip: handle truncated responses where closing ``` is missing
        first_nl = clean.find('\n')
        if first_nl >= 0:
            inner = clean[first_nl + 1:]
            stripped = inner.rstrip()
            if stripped.endswith('```'):
                inner = stripped[:-3].rstrip()
            clean = inner

    # Step 3a: try direct parse on cleaned text
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # Step 3b: the model sometimes embeds literal newlines/tabs inside JSON string
    # values (invalid JSON). Escape only control chars that appear INSIDE string
    # literals — structural whitespace must remain untouched.
    try:
        sanitized = _escape_control_chars_in_strings(clean)
        return json.loads(sanitized)
    except (json.JSONDecodeError, Exception):
        pass

    # Step 3c: fix double-escaped backslash-quotes (\\" → \").
    # Models sometimes output \\" inside JSON string values when embedding code/HCL
    # that contains quotes. In valid JSON, \\" means literal-backslash + close-string,
    # which breaks parsing. Converting \\" → \" makes the quote an escaped char instead.
    try:
        normalized = sanitized.replace('\\\\"', '\\"')
        return json.loads(normalized)
    except (json.JSONDecodeError, NameError, Exception):
        pass

    # Step 4: scan forward from first '{' or '[', tracking brace depth while
    # ignoring brackets inside JSON string literals (handles TF HCL in content fields).
    # On a failed parse at depth==0, continue scanning for the NEXT candidate rather
    # than breaking — the model may have preamble text before the real JSON object.
    for start_char, end_char in (("{", "}"), ("[", "]")):
        search_from = 0
        while True:
            idx = clean.find(start_char, search_from)
            if idx < 0:
                break
            depth = 0
            in_string = False
            escape_next = False
            end_idx = -1
            for i, ch in enumerate(clean[idx:], start=idx):
                if escape_next:
                    escape_next = False
                    continue
                if ch == "\\" and in_string:
                    escape_next = True
                    continue
                if ch == '"' and not in_string:
                    in_string = True
                    continue
                if ch == '"' and in_string:
                    in_string = False
                    continue
                if in_string:
                    continue
                if ch == start_char:
                    depth += 1
                elif ch == end_char:
                    depth -= 1
                    if depth == 0:
                        end_idx = i
                        break
            if end_idx >= 0:
                try:
                    return json.loads(clean[idx : end_idx + 1])
                except json.JSONDecodeError:
                    # This balanced block failed — advance past it and keep looking
                    search_from = end_idx + 1
                    continue
            # No balanced block found from this position
            break

    # Step 5: regex fallback — find any JSON object or array in the full response
    for pattern in (r"\{[\s\S]*\}", r"\[[\s\S]*\]"):
        m = re.search(pattern, clean)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass

    raise ValueError(f"No valid JSON found in response (first 200 chars): {clean[:200]!r}")


# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------


def truncate_list(items: list, max_items: int) -> list:
    """Keep only the last `max_items` elements of a list to prevent unbounded growth."""
    if len(items) > max_items:
        return items[-max_items:]
    return items
