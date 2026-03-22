from __future__ import annotations

"""Shared LLM error-handling utilities for all architecture planner agents."""

import logging

logger = logging.getLogger(__name__)


def _get_api_error_types() -> tuple[type[BaseException], ...]:
    """Return a tuple of API-level exception types for configured LLM backends.

    Checked at import time so the tuple is stable. An empty tuple is returned
    if neither backend is installed (never matches in except clauses).
    """
    types: list[type[BaseException]] = []

    # Anthropic SDK errors
    try:
        import anthropic
        types.extend([
            anthropic.APITimeoutError,       # Request timed out
            anthropic.RateLimitError,        # HTTP 429
            anthropic.AuthenticationError,   # HTTP 401 — bad API key
            anthropic.PermissionDeniedError, # HTTP 403 — key lacks permission
            anthropic.APIConnectionError,    # Network-level failure
            anthropic.BadRequestError,       # HTTP 400 — bad request / context too long
            anthropic.InternalServerError,   # HTTP 500+ and 529 overloaded_error
            anthropic.APIStatusError,        # Base for all other HTTP error responses
        ])
    except ImportError:
        pass

    # httpx errors (used internally by both the Anthropic client and Ollama)
    try:
        import httpx
        types.extend([
            httpx.ConnectError,       # Ollama server not running / unreachable
            httpx.TimeoutException,   # Base timeout class
            httpx.ConnectTimeout,
            httpx.ReadTimeout,
        ])
    except ImportError:
        pass

    # Ollama-specific errors (model not found, etc.)
    try:
        import ollama
        types.append(ollama.ResponseError)
    except ImportError:
        pass

    return tuple(types)


# Resolved once at module import — cheap to use in except clauses.
API_ERROR_TYPES: tuple[type[BaseException], ...] = _get_api_error_types()
