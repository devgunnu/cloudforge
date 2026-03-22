from __future__ import annotations

import threading

from app.config import settings

_lock = threading.Lock()
_clients: dict[str, object] = {}


def _make_client(model: str, temperature: float):
    """Create an LLM client based on LLM_PROVIDER setting."""
    if settings.llm_provider == "openrouter":
        from langchain_openrouter import ChatOpenRouter
        return ChatOpenRouter(
            model=model,
            api_key=settings.openrouter_api_key,
            temperature=temperature,
            max_tokens=settings.llm_max_tokens,
            timeout=settings.llm_timeout_seconds * 1000,
        )
    else:
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=model,
            base_url=settings.ollama_base_url,
            temperature=temperature,
            request_timeout=settings.llm_timeout_seconds,
        )


def get_llm(model: str | None = None, temperature: float = 0.0):
    if settings.llm_provider == "openrouter":
        resolved_model = model or settings.openrouter_model
    else:
        resolved_model = model or settings.ollama_model
    key = f"{resolved_model}:{temperature}"
    if key not in _clients:
        with _lock:
            if key not in _clients:
                _clients[key] = _make_client(resolved_model, temperature)
    return _clients[key]


def get_default_llm():
    if settings.llm_provider == "openrouter":
        return get_llm(settings.openrouter_model, 0.0)
    return get_llm(settings.ollama_model, 0.0)


def get_fast_llm():
    if settings.llm_provider == "openrouter":
        return get_llm(settings.openrouter_fast_model, 0.0)
    return get_llm(settings.ollama_fast_model, 0.0)


def get_structured_llm(schema, method: str = "json_schema"):
    """Return a structured-output chain bound to `schema`.

    Uses include_raw=True so callers can inspect result["parsed"] and fall
    back to result["raw"].content if parsing fails.
    """
    return get_default_llm().with_structured_output(schema, method=method, include_raw=True)
