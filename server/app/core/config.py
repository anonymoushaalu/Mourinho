"""Application settings.

Configuration is read from the environment exactly once, validated by Pydantic,
and exposed as a frozen singleton. A bad or missing value crashes the process at
import time — a container that cannot start is far better than one serving
traffic with a silently wrong config.
"""

from enum import StrEnum
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    LOCAL = "local"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="forbid",  # an unknown key is usually a typo in a deploy manifest
        frozen=True,
    )

    app_name: str = "Mourinho"
    version: str = "0.1.0"
    environment: Environment = Environment.LOCAL

    api_v1_prefix: str = "/api/v1"

    # Secrets have no default: production must supply them.
    secret_key: str = Field(min_length=32)

    log_level: str = "INFO"

    # Explicit allow-list. Wildcards are rejected below.
    cors_origins: list[str] = Field(default_factory=list)

    @property
    def is_production(self) -> bool:
        return self.environment is Environment.PRODUCTION

    @property
    def docs_url(self) -> str | None:
        """Interactive docs are a recon aid; keep them off in production."""
        return None if self.is_production else "/docs"

    @field_validator("cors_origins")
    @classmethod
    def _reject_wildcard(cls, value: list[str]) -> list[str]:
        if "*" in value:
            raise ValueError("Wildcard CORS origin is not permitted; list origins explicitly.")
        return value


@lru_cache
def get_settings() -> Settings:
    """Cached accessor. Also the FastAPI dependency, so tests can override it."""
    return Settings()
