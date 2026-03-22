from __future__ import annotations

from app.config import settings


def get_llm():
    """Centralized model factory — returns OpenRouter or Ollama based on LLM_PROVIDER."""
    if settings.llm_provider == "openrouter":
        from langchain_openrouter import ChatOpenRouter
        return ChatOpenRouter(
            model=settings.openrouter_model,
            api_key=settings.openrouter_api_key,
            temperature=settings.llm_temperature,
            timeout=settings.llm_timeout_seconds * 1000,
        )
    else:
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            temperature=settings.llm_temperature,
            request_timeout=settings.llm_timeout_seconds,
        )
