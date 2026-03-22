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

    # Agent 3 — Terraform / Code Generator LLM (always Ollama)
    agent3_model: str = "qwen3.5"        # primary model for heavy tasks
    agent3_fast_model: str = "qwen3.5"   # lighter tasks (code fixing, test gen)

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

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/auth/github/callback"

    # External services
    anthropic_api_key: str = ""
    frontend_url: str = "http://localhost:3000"

    # Agent data paths
    graph_json_path: str = "app/agents/data/graph/graph.json"
    kuzu_db_path: str = "./cloudforge_db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
