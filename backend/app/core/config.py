from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "SED Backend"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_env: str = "development"

    postgres_db: str = "sed"
    postgres_user: str = "sed"
    postgres_password: str = "change_me"
    postgres_host: str = "postgres"
    postgres_port: int = 5432

    redis_host: str = "redis"
    redis_port: int = 6379
    storage_root: str = "/app/storage"
    libreoffice_binary: str = "soffice"

    session_cookie_name: str = "sed_session"
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"
    session_cookie_domain: str | None = None
    session_ttl_hours: int = 12

    password_min_length: int = 8

    initial_admin_username: str = "admin"
    initial_admin_password: str = "admin12345"
    initial_admin_full_name: str = "System Administrator"

    @field_validator("session_cookie_domain", mode="before")
    @classmethod
    def empty_cookie_domain_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
