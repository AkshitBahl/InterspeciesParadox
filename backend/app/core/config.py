"""Application settings.

Every setting can be overridden with an environment variable of the same name
(upper case), or with a line in a `.env` file next to `alembic.ini`.
Example: `DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/db`.
"""

import json
from datetime import date
from functools import lru_cache
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-secret-change-me-please-0123456789"


class Settings(BaseSettings):
    # hide_input_in_errors: a bad setting must never print the database password in the logs.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", hide_input_in_errors=True)

    # --- General -------------------------------------------------------------
    app_name: str = "The Interspecies Paradox API"
    environment: str = "development"  # "production" on Render: refuses to start with the dev JWT secret
    api_v1_prefix: str = "/api/v1"
    # Websites allowed to call the API from a browser (CORS).
    # In the environment, write a comma separated list or a JSON list:
    #   CORS_ORIGINS=https://interspecies-paradox.vercel.app,http://localhost:5173
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173", "http://localhost:3000"]
    # Optional pattern for more allowed websites, e.g. every Vercel preview of the frontend:
    #   CORS_ORIGIN_REGEX=https://interspecies-paradox(-[a-z0-9-]+)?\.vercel\.app
    cors_origin_regex: str | None = None

    # --- Database ------------------------------------------------------------
    # Hosting services (Render, Railway, Heroku...) give "postgres://" or "postgresql://" URLs.
    # They are rewritten to use the psycopg 3 driver that this project installs.
    database_url: str = "postgresql+psycopg://paradox:paradox@localhost:5432/interspecies"
    sql_echo: bool = False

    # --- Auth ----------------------------------------------------------------
    jwt_secret_key: str = DEV_JWT_SECRET
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

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            text = value.strip()
            value = json.loads(text) if text.startswith("[") else text.split(",")
        if isinstance(value, list | tuple):
            # "https://site.app/" and "https://site.app" are the same origin for a browser.
            return [str(item).strip().rstrip("/") for item in value if str(item).strip()]
        return value

    @field_validator("cors_origin_regex", mode="before")
    @classmethod
    def _empty_regex(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def _psycopg_driver(cls, value: object) -> object:
        if isinstance(value, str):
            url = value.strip()
            for prefix in ("postgres://", "postgresql://"):
                if url.startswith(prefix):
                    return "postgresql+psycopg://" + url[len(prefix):]
            return url
        return value

    @model_validator(mode="after")
    def _safe_production(self) -> "Settings":
        if self.environment.strip().lower() == "production" and (
            self.jwt_secret_key == DEV_JWT_SECRET or len(self.jwt_secret_key) < 32
        ):
            raise ValueError("JWT_SECRET_KEY must be a random string of at least 32 characters in production.")
        return self

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
