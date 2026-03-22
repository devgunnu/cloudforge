from __future__ import annotations

"""Shared LLM error-handling utilities for all architecture planner agents."""

import logging

logger = logging.getLogger(__name__)


def _get_api_error_types() -> tuple[type[BaseException], ...]:
    """Return a tuple of API-level exception types for the OpenRouter LLM backend.

    Checked at import time so the tuple is stable. An empty tuple is returned
    if no relevant SDK is installed (never matches in except clauses).
    """
    types: list[type[BaseException]] = []

    # OpenAI SDK errors (langchain-openrouter depends on the openai SDK)
    try:
        import openai
        types.extend([
            openai.APITimeoutError,
            openai.RateLimitError,
            openai.AuthenticationError,
            openai.PermissionDeniedError,
            openai.APIConnectionError,
            openai.BadRequestError,
            openai.InternalServerError,
            openai.APIStatusError,
        ])
    except ImportError:
        pass

    # httpx errors (used internally by OpenRouter and Ollama clients)
    try:
        import httpx
        types.extend([
            httpx.ConnectError,
            httpx.TimeoutException,
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
