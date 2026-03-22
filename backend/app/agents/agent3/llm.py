from __future__ import annotations

import threading

from langchain_groq import ChatGroq

from app.agents.agent3.config import DEFAULT_MODEL, FAST_MODEL

_lock = threading.Lock()
_clients: dict[str, ChatGroq] = {}


def get_llm(model: str = DEFAULT_MODEL, temperature: float = 0.0) -> ChatGroq:
    """
    Return a module-level singleton ChatGroq client for a given (model, temperature) pair.
    Thread-safe; avoids re-creating clients on every node invocation.

    parallel_tool_calls=False prevents models from generating multiple tool calls in a
    single response turn, which causes format errors on models not well-calibrated for
    parallel tool-call JSON output.
    """
    key = f"{model}:{temperature}"
    if key not in _clients:
        with _lock:
            if key not in _clients:
                _clients[key] = ChatGroq(
                    model=model,
                    temperature=temperature,
                    model_kwargs={"parallel_tool_calls": False},
                )
    return _clients[key]


def get_default_llm() -> ChatGroq:
    return get_llm(DEFAULT_MODEL, 0.0)


def get_fast_llm() -> ChatGroq:
    return get_llm(FAST_MODEL, 0.0)
