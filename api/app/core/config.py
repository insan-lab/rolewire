"""Application configuration.

All secrets are expected to be injected as environment variables at process start
(`op run -- uvicorn ...` per the infra convention); nothing is read from a committed file.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    environment: Literal["dev", "test", "prod"] = "dev"
    log_level: str = "INFO"

    # --- Database ---------------------------------------------------------
    database_url: str = "postgresql+asyncpg://rolewire:rolewire@localhost:5432/rolewire"
    db_echo: bool = False
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # --- Redis ------------------------------------------------------------
    redis_url: str = "redis://localhost:6379/0"

    # --- Auth -------------------------------------------------------------
    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_seconds: int = 15 * 60
    refresh_token_ttl_seconds: int = 30 * 24 * 3600

    # --- Encryption (storage + oauth credentials at rest) -----------------
    # urlsafe base64 32-byte key (Fernet). Wrapped/managed externally (1Password/KMS).
    encryption_key: str = ""

    # Salt for applicant IP hashing. Never store raw IPs.
    ip_hash_salt: str = "dev-insecure-ip-salt"

    # --- CORS -------------------------------------------------------------
    # Public endpoints are intentionally wide open (§12); admin is origin-locked.
    admin_allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # --- Public API limits ------------------------------------------------
    public_apply_rate_limit: int = 1
    public_apply_rate_window_seconds: int = 600
    public_read_rate_limit: int = 120
    public_read_rate_window_seconds: int = 60
    max_upload_bytes: int = 10 * 1024 * 1024

    # --- Docs -------------------------------------------------------------
    expose_docs: bool = True

    # --- Providers (optional in dev) --------------------------------------
    brevo_api_key: str = ""
    brevo_webhook_secret: str = ""
    paddle_webhook_secret: str = ""
    paddle_api_key: str = ""
    paddle_environment: Literal["sandbox", "production"] = "sandbox"
    uddoktapay_api_key: str = ""
    uddoktapay_webhook_secret: str = ""
    uddoktapay_base_url: str = ""

    # Admin panel origin, used to build checkout return URLs.
    app_base_url: str = "http://localhost:3000"
    # Days a subscription may stay past_due before the tenant is suspended (§9.4).
    grace_period_days: int = 5

    oauth_google_client_id: str = ""
    oauth_google_client_secret: str = ""
    oauth_github_client_id: str = ""
    oauth_github_client_secret: str = ""
    oauth_facebook_client_id: str = ""
    oauth_facebook_client_secret: str = ""
    oauth_linkedin_client_id: str = ""
    oauth_linkedin_client_secret: str = ""
    oauth_redirect_base_url: str = "http://localhost:8000"

    # --- Hosted storage ---------------------------------------------------
    hosted_s3_endpoint: str = ""
    hosted_s3_bucket: str = ""
    hosted_s3_region: str = "us-east-1"
    hosted_s3_access_key: str = ""
    hosted_s3_secret_key: str = ""

    @field_validator("admin_allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_prod(self) -> bool:
        return self.environment == "prod"

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")


@lru_cache
def get_settings() -> Settings:
    return Settings()
