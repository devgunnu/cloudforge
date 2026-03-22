from __future__ import annotations

import threading

from langchain_ollama import ChatOllama

from app.agents.agent3.config import DEFAULT_MODEL, FAST_MODEL

_lock = threading.Lock()
_clients: dict[str, ChatOllama] = {}


def get_llm(model: str = DEFAULT_MODEL, temperature: float = 0.0) -> ChatOllama:
    """
    Return a module-level singleton ChatOllama client for a given (model, temperature) pair.
    Thread-safe; avoids re-creating clients on every node invocation.
    """
    key = f"{model}:{temperature}"
    if key not in _clients:
        with _lock:
            if key not in _clients:
                _clients[key] = ChatOllama(
                    model=model,
                    temperature=temperature,
                )
    return _clients[key]


def get_default_llm() -> ChatOllama:
    return get_llm(DEFAULT_MODEL, 0.0)


def get_fast_llm() -> ChatOllama:
    return get_llm(FAST_MODEL, 0.0)
