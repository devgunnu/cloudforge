from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CloudForge API"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # LLM — Ollama (local)
    ollama_base_url: str = "http://localhost:11434"
    qwen_model: str = "qwen3.5:latest"
    llm_temperature: float = 0.2
    llm_timeout_seconds: int = 90

    # LLM — Anthropic (for Terraform generation)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"

    # Deploy settings
    deploy_workspace_root: str = "/tmp/cloudforge"
    deploy_dry_run: bool = True  # When True, simulates terraform commands

    # Agents
    enable_web_search: bool = True
    max_clarification_rounds: int = 6
    max_research_rounds: int = 3

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
