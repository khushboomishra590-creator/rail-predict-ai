from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file (backend/config.py → backend/.env)
# This works regardless of which directory uvicorn is launched from.
_ENV_FILE = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    # PostgreSQL connection — override via .env or cloud provider env vars.
    # Railway injects DATABASE_URL as postgresql:// — we normalise it to
    # postgresql+psycopg2:// so SQLAlchemy uses the correct driver.
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/railpredict_db"

    # App metadata
    APP_TITLE: str = "RailPredict AI — Dynamic ETA Intelligence"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
    )

    def __init__(self, **data):
        super().__init__(**data)
        # Normalise Railway's postgresql:// → postgresql+psycopg2://
        if self.DATABASE_URL.startswith("postgresql://"):
            object.__setattr__(
                self,
                "DATABASE_URL",
                self.DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1),
            )


settings = Settings()
