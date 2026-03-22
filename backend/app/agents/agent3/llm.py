from __future__ import annotations

import threading

from langchain_anthropic import ChatAnthropic

from app.config import settings

_lock = threading.Lock()
_clients: dict[str, ChatAnthropic] = {}


def get_llm(model: str | None = None, temperature: float = 0.0) -> ChatAnthropic:
    """
    Return a module-level singleton ChatAnthropic client for a given (model, temperature) pair.
    Thread-safe double-checked locking avoids re-creating clients on every node invocation.
    """
    resolved_model = model or settings.llm_model
    key = f"{resolved_model}:{temperature}"
    if key not in _clients:
        with _lock:
            if key not in _clients:
                _clients[key] = ChatAnthropic(
                    model=resolved_model,
                    api_key=settings.anthropic_api_key,
                    temperature=temperature,
                    timeout=settings.llm_timeout_seconds,
                    max_tokens=16384,
                )
    return _clients[key]


def get_default_llm() -> ChatAnthropic:
    """Return the primary LLM for heavy tasks."""
    return get_llm(settings.llm_model, 0.0)


def get_fast_llm() -> ChatAnthropic:
    """Return the LLM for lighter tasks (same model, lower temperature)."""
    return get_llm(settings.llm_model, 0.0)
