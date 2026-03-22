from __future__ import annotations

import threading

from langchain_ollama import ChatOllama

from app.config import settings

_lock = threading.Lock()
_clients: dict[str, ChatOllama] = {}


def get_llm(model: str | None = None, temperature: float = 0.0) -> ChatOllama:
    """
    Return a module-level singleton ChatOllama client for a given (model, temperature) pair.
    Model defaults to settings.agent3_model when not specified.
    Thread-safe double-checked locking avoids re-creating clients on every node invocation.
    """
    resolved_model = model or settings.agent3_model
    key = f"{resolved_model}:{temperature}"
    if key not in _clients:
        with _lock:
            if key not in _clients:
                _clients[key] = ChatOllama(
                    model=resolved_model,
                    base_url=settings.ollama_base_url,
                    temperature=temperature,
                    request_timeout=settings.llm_timeout_seconds,
                )
    return _clients[key]


def get_default_llm() -> ChatOllama:
    """Return the primary LLM for heavy tasks (model = settings.agent3_model)."""
    return get_llm(settings.agent3_model, 0.0)


def get_fast_llm() -> ChatOllama:
    """Return the LLM for lighter tasks (model = settings.agent3_fast_model)."""
    return get_llm(settings.agent3_fast_model, 0.0)
