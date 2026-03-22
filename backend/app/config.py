from pydantic_settings import BaseSettings, SettingsConfigDict

HAIKU_MODEL = "claude-haiku-4-5-20251001"


class Settings(BaseSettings):
    app_name: str = "CloudForge API"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # LLM — all agents use Claude Haiku via Anthropic
    anthropic_api_key: str = ""
    llm_model: str = HAIKU_MODEL
    llm_temperature: float = 0.2
    llm_timeout_seconds: int = 90
    enable_web_search: bool = True
    max_clarification_rounds: int = 6
    max_research_rounds: int = 3

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "cloudforge"

    # JWT
    jwt_secret_key: str = "changeme"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 30
    jwt_refresh_expire_days: int = 7

    # Encryption
    fernet_key: str = ""
    fernet_keys: str = ""  # Comma-separated list of Fernet keys, newest first. Overrides fernet_key if set.

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/auth/github/callback"

    frontend_url: str = "http://localhost:3000"

    # Agent data paths
    graph_json_path: str = "app/agents/data/graph/graph.json"
    kuzu_db_path: str = "./cloudforge_db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
