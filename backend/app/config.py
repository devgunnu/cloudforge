from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CloudForge API"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000
    ollama_base_url: str = "http://localhost:11434"
    qwen_model: str = "codeqwen:latest"
    llm_temperature: float = 0.2
    llm_timeout_seconds: int = 90
    enable_web_search: bool = True
    enable_tinyfish_search: bool = False
    tinyfish_timeout_seconds: int = 25
    max_clarification_rounds: int = 6
    max_research_rounds: int = 3

    # GitHub OAuth — required, set in .env
    github_client_id: str = Field(...)
    github_client_secret: str = Field(...)
    github_redirect_uri: str = "http://localhost:8000/auth/github/callback"
    frontend_url: str = "http://localhost:3000"

    # JWT Authentication — required, set in .env
    jwt_secret_key: str = Field(...)
    algorithm: str = "HS256"
    jwt_algorithm: str = "HS256"          # alias used by security.py
    access_token_expire_minutes: int = 1440
    jwt_access_expire_minutes: int = 1440  # alias used by security.py
    jwt_refresh_expire_days: int = 30      # used by security.py

    # MongoDB — optional; leave blank to run without a database
    mongodb_url: str = ""
    mongodb_db_name: str = "cloudforge"

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
