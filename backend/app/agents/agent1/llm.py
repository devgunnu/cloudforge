from __future__ import annotations

from langchain_anthropic import ChatAnthropic

from app.config import settings


def get_llm() -> ChatAnthropic:
    return ChatAnthropic(
        model=settings.llm_model,
        api_key=settings.anthropic_api_key,
        temperature=settings.llm_temperature,
        timeout=settings.llm_timeout_seconds,
        max_tokens=16384,
    )
