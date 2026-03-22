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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
