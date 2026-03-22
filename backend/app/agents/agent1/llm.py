from __future__ import annotations

from langchain_ollama import ChatOllama

from app.config import settings

def get_llm() -> ChatOllama:
    # Centralized model factory keeps all nodes consistent and easy to tune.
    return ChatOllama(model=settings.llm_model, base_url=settings.ollama_base_url, temperature=settings.llm_temperature, request_timeout=settings.llm_timeout_seconds)
