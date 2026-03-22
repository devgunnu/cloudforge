from __future__ import annotations

"""Shared LLM error-handling utilities for all architecture planner agents."""

import logging
import time
from typing import Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


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


def _is_rate_limit_error(exc: BaseException) -> bool:
    try:
        import anthropic
        return isinstance(exc, anthropic.RateLimitError)
    except ImportError:
        return False


def invoke_with_retry(fn: Callable[[], T], max_retries: int = 4, base_delay: float = 15.0) -> T:
    """
    Call fn(), retrying on rate-limit (429) errors with exponential backoff.

    Delays: 15s → 30s → 60s → 120s (doubles each attempt).
    All other exceptions propagate immediately.
    """
    delay = base_delay
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except BaseException as exc:
            if _is_rate_limit_error(exc) and attempt < max_retries:
                logger.warning(
                    "Rate limit hit (attempt %d/%d). Retrying in %.0fs…",
                    attempt + 1,
                    max_retries,
                    delay,
                )
                time.sleep(delay)
                delay *= 2
            else:
                raise
