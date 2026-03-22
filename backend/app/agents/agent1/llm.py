from __future__ import annotations

import logging

from langchain_anthropic import ChatAnthropic
from langchain_core.language_models.chat_models import BaseChatModel

try:
    from langchain_ollama import ChatOllama
except ImportError:  # pragma: no cover - optional dependency
    ChatOllama = None

try:
    from langchain_openai import ChatOpenAI
except ImportError:  # pragma: no cover - optional dependency
    ChatOpenAI = None

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:  # pragma: no cover - optional dependency
    ChatGoogleGenerativeAI = None

from app.config import settings


logger = logging.getLogger(__name__)


def supported_llm_providers() -> list[str]:
    return ["ollama", "anthropic", "openai", "google"]


def _normalize_provider(provider: str | None) -> str:
    requested = (provider or settings.llm_provider or "auto").strip().lower()
    if requested in {"", "auto"}:
        return "ollama"
    if requested not in supported_llm_providers():
        logger.warning("Unknown llm provider '%s'; defaulting to ollama", requested)
        return "ollama"
    return requested


def _ensure_provider_configuration(provider: str) -> str:
    if provider == "anthropic" and not settings.anthropic_api_key.strip():
        logger.warning("Anthropic API key not configured; defaulting to ollama")
        return "ollama"
    if provider == "openai" and not settings.openai_api_key.strip():
        logger.warning("OpenAI API key not configured; defaulting to ollama")
        return "ollama"
    if provider == "google" and not settings.google_api_key.strip():
        logger.warning("Google API key not configured; defaulting to ollama")
        return "ollama"
    return provider


def get_llm(provider: str | None = None, model: str | None = None) -> BaseChatModel:
    resolved_provider = _ensure_provider_configuration(_normalize_provider(provider))

    if resolved_provider == "ollama":
        if ChatOllama is None:
            raise RuntimeError("langchain-ollama is not installed; cannot use ollama provider")
        return ChatOllama(
            model=model or settings.ollama_model,
            base_url=settings.ollama_base_url,
            temperature=settings.llm_temperature,
            timeout=settings.llm_timeout_seconds,
        )

    if resolved_provider == "anthropic":
        return ChatAnthropic(
            model=model or settings.anthropic_model or settings.llm_model,
            api_key=settings.anthropic_api_key,
            temperature=settings.llm_temperature,
            timeout=settings.llm_timeout_seconds,
            max_tokens=16384,
        )

    if resolved_provider == "openai":
        if ChatOpenAI is None:
            raise RuntimeError("langchain-openai is not installed; cannot use openai provider")
        return ChatOpenAI(
            model=model or settings.openai_model,
            api_key=settings.openai_api_key,
            temperature=settings.llm_temperature,
            timeout=settings.llm_timeout_seconds,
            max_tokens=16384,
        )

    if resolved_provider == "google":
        if ChatGoogleGenerativeAI is None:
            raise RuntimeError("langchain-google-genai is not installed; cannot use google provider")
        return ChatGoogleGenerativeAI(
            model=model or settings.google_model,
            google_api_key=settings.google_api_key,
            temperature=settings.llm_temperature,
            timeout=settings.llm_timeout_seconds,
            max_output_tokens=16384,
        )

    raise RuntimeError(f"Unsupported llm provider: {resolved_provider}")
