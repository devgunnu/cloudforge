from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CloudForge API"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000
    ollama_base_url: str = "http://localhost:11434"
    qwen_model: str = "qwen3.5:latest"
    llm_temperature: float = 0.2
    llm_timeout_seconds: int = 90
    enable_web_search: bool = True
    max_clarification_rounds: int = 6
    max_research_rounds: int = 3

    # Agent 2 — Architecture Planner LLM
    # Set arch_model_type="anthropic" and ANTHROPIC_API_KEY in .env for Claude.
    # Defaults to local Ollama so the server starts without any extra API keys.
    arch_model_type: str = "ollama"
    arch_model_name: str = "llama3.1:8b"

    # Agent 3 — Code Generator LLM (Groq)
    groq_api_key: str = ""
    agent3_model: str = "llama-3.1-8b-instant"
    agent3_fast_model: str = "llama-3.1-8b-instant"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
