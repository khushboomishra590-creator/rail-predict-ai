from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file (backend/config.py → backend/.env)
# This works regardless of which directory uvicorn is launched from.
_ENV_FILE = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    # PostgreSQL connection — override via .env
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/railpredict_db"

    # App metadata
    APP_TITLE: str = "RailPredict AI — Dynamic ETA Intelligence"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
    )


settings = Settings()
