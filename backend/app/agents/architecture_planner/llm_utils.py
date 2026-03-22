from __future__ import annotations

"""Shared LLM error-handling utilities for all architecture planner agents."""

import logging

logger = logging.getLogger(__name__)


def _get_api_error_types() -> tuple[type[BaseException], ...]:
    """Return a tuple of Anthropic + httpx exception types for use in except clauses."""
    types: list[type[BaseException]] = []

    try:
        import anthropic
        types.extend([
            anthropic.APITimeoutError,
            anthropic.RateLimitError,
            anthropic.AuthenticationError,
            anthropic.PermissionDeniedError,
            anthropic.APIConnectionError,
            anthropic.BadRequestError,
            anthropic.InternalServerError,
            anthropic.APIStatusError,
        ])
    except ImportError:
        pass

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

    return tuple(types)


# Resolved once at module import — cheap to use in except clauses.
API_ERROR_TYPES: tuple[type[BaseException], ...] = _get_api_error_types()
