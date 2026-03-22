from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CloudForge API"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # LLM provider switch — "openrouter" or "ollama"
    llm_provider: str = "ollama"

    # OpenRouter (used when llm_provider="openrouter")
    openrouter_api_key: str = ""
    openrouter_model: str = "anthropic/claude-haiku-4.5"
    openrouter_fast_model: str = "anthropic/claude-haiku-4.5"

    # Ollama (used when llm_provider="ollama")
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5-coder:7b"
    ollama_fast_model: str = "qwen2.5-coder:7b"

    # Shared LLM settings
    llm_temperature: float = 0.2
    llm_timeout_seconds: int = 120
    llm_max_tokens: int = 3500

    enable_web_search: bool = True
    max_clarification_rounds: int = 6
    max_research_rounds: int = 3

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
