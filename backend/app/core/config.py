"""Application settings.

Every setting can be overridden with an environment variable of the same name
(upper case), or with a line in a `.env` file next to `alembic.ini`.
Example: `DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/db`.
"""

from datetime import date
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- General -------------------------------------------------------------
    app_name: str = "The Interspecies Paradox API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # --- Database ------------------------------------------------------------
    database_url: str = "postgresql+psycopg://paradox:paradox@localhost:5432/interspecies"
    sql_echo: bool = False

    # --- Auth ----------------------------------------------------------------
    jwt_secret_key: str = "dev-only-secret-change-me-please-0123456789"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # --- Simulation clock ----------------------------------------------------
    # The story is set in 2126. Seasons (breeding, hibernation...) are computed
    # from this date. Set SIMULATED_TODAY=real to use the real calendar.
    simulated_today: date | None = date(2126, 5, 20)

    # --- Map -----------------------------------------------------------------
    map_center_lon: float = 4.3740
    map_center_lat: float = 50.8240
    map_default_zoom: float = 16.4
    map_pitch: float = 55.0
    map_bearing: float = -17.0
    basemap_style_url: str = "https://tiles.openfreemap.org/styles/liberty"

    # --- External geo services (optional) -------------------------------------
    enable_external_geo: bool = True
    osrm_base_url: str = "https://routing.openstreetmap.de"
    osrm_profile_paths: dict[str, str] = {
        "foot": "routed-foot",
        "bike": "routed-bike",
        "car": "routed-car",
    }
    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    geo_user_agent: str = "InterspeciesParadox/0.1 (hackathon demo backend)"
    external_timeout_seconds: float = 6.0

    # --- Free local LLM voice (optional) ---------------------------------------
    # Off by default: the representatives then speak from their templates.
    # With Ollama running on your machine, set LLM_ENABLED=true. Any server with
    # an OpenAI-style /chat/completions endpoint works (LM Studio, llama.cpp...).
    llm_enabled: bool = False
    llm_base_url: str = "http://localhost:11434/v1"
    llm_model: str = "qwen2.5:7b"
    llm_api_key: str = ""  # Ollama needs none
    llm_timeout_seconds: float = 30.0
    llm_temperature: float = 0.9  # higher = livelier and more varied (the data check still applies)
    llm_cache_seconds: float = 120.0  # the same request within this time gets the same reply, instantly
    llm_max_tokens: int = 400

    @field_validator("simulated_today", mode="before")
    @classmethod
    def _real_clock(cls, value: object) -> object:
        if isinstance(value, str) and value.strip().lower() in {"", "none", "real", "today"}:
            return None
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
