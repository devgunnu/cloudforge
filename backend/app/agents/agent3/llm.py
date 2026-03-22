from __future__ import annotations

import threading

# from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama

from app.config import settings

_lock = threading.Lock()
_clients: dict[str, ChatGroq] = {}


def get_llm(model: str | None = None, temperature: float = 0.0) -> ChatGroq:
    resolved_model = model or settings.agent3_model
    key = f"{resolved_model}:{temperature}"
    if key not in _clients:
        with _lock:
            if key not in _clients:
                _clients[key] = ChatOllama(
                    model=resolved_model,
                    api_key=settings.groq_api_key,
                    temperature=temperature,
                    request_timeout=settings.llm_timeout_seconds,
                )
    return _clients[key]


def get_default_llm() -> ChatOllama:
    return get_llm(settings.agent3_model, 0.0)


def get_fast_llm() -> ChatOllama:
    return get_llm(settings.agent3_fast_model, 0.0)
