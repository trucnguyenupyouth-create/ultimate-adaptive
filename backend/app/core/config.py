from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "dev-secret"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
