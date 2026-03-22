from __future__ import annotations

import threading

from langchain_anthropic import ChatAnthropic

from app.agents.agent3.config import DEFAULT_MODEL, FAST_MODEL

_lock = threading.Lock()
_clients: dict[str, ChatAnthropic] = {}


def get_llm(model: str = DEFAULT_MODEL, temperature: float = 0.0) -> ChatAnthropic:
    """
    Return a module-level singleton ChatAnthropic client for a given (model, temperature) pair.
    Thread-safe; avoids re-creating clients on every node invocation.
    """
    key = f"{model}:{temperature}"
    if key not in _clients:
        with _lock:
            if key not in _clients:
                _clients[key] = ChatAnthropic(model=model, temperature=temperature)
    return _clients[key]


def get_default_llm() -> ChatAnthropic:
    return get_llm(DEFAULT_MODEL, 0.0)


def get_fast_llm() -> ChatAnthropic:
    return get_llm(FAST_MODEL, 0.0)
