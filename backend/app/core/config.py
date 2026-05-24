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


settings = Settings()
