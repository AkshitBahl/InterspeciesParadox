"""Settings read from the environment, the way Render and Vercel deployments set them."""

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import DEV_JWT_SECRET, Settings
from app.main import app


def make(monkeypatch: pytest.MonkeyPatch, **env: str) -> Settings:
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    return Settings(_env_file=None)


@pytest.mark.parametrize(
    "given",
    [
        "postgres://u:p@dpg-abc-a/interspecies",
        "postgresql://u:p@dpg-abc-a/interspecies",
        "postgresql+psycopg://u:p@dpg-abc-a/interspecies",
    ],
)
def test_hosted_database_urls_use_psycopg3(monkeypatch, given):
    assert make(monkeypatch, DATABASE_URL=given).database_url == "postgresql+psycopg://u:p@dpg-abc-a/interspecies"


def test_sqlite_url_is_left_alone(monkeypatch):
    assert make(monkeypatch, DATABASE_URL="sqlite:///./demo.db").database_url == "sqlite:///./demo.db"


@pytest.mark.parametrize(
    "given",
    [
        "https://interspecies-paradox.vercel.app/, http://localhost:5173",
        '["https://interspecies-paradox.vercel.app", "http://localhost:5173"]',
    ],
)
def test_cors_origins_accept_commas_or_json(monkeypatch, given):
    settings = make(monkeypatch, CORS_ORIGINS=given)
    assert settings.cors_origins == ["https://interspecies-paradox.vercel.app", "http://localhost:5173"]


def test_empty_cors_regex_means_none(monkeypatch):
    assert make(monkeypatch, CORS_ORIGIN_REGEX="  ").cors_origin_regex is None


def test_production_refuses_the_dev_secret(monkeypatch):
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        make(monkeypatch, ENVIRONMENT="production")
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        make(monkeypatch, ENVIRONMENT="production", JWT_SECRET_KEY="short")
    ok = make(monkeypatch, ENVIRONMENT="production", JWT_SECRET_KEY="x" * 40)
    assert ok.jwt_secret_key != DEV_JWT_SECRET


def test_cors_lets_the_local_frontend_call_the_api():
    """The CORS middleware allows the listed local origin and rejects unknown sites."""
    client = TestClient(app)
    preflight = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"}
    allowed = client.options("/api/v1/auth/login", headers={"Origin": "http://localhost:5173", **preflight})
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    blocked = client.options("/api/v1/auth/login", headers={"Origin": "https://evil.example", **preflight})
    assert "access-control-allow-origin" not in blocked.headers


def test_render_blueprint_regex_matches_the_vercel_sites():
    """render.yaml allows the Vercel production site and its previews (Starlette uses re.fullmatch)."""
    blueprint = (Path(__file__).resolve().parents[2] / "render.yaml").read_text()
    pattern = re.search(r"key: CORS_ORIGIN_REGEX\s+value: '([^']+)'", blueprint)
    assert pattern, "CORS_ORIGIN_REGEX not found in render.yaml"
    regex = re.compile(pattern.group(1))
    for site in (
        "https://interspecies-paradox.vercel.app",
        "https://interspecies-paradox-a1b2c3.vercel.app",
        "https://interspecies-paradox-git-main-akshit.vercel.app",
    ):
        assert regex.fullmatch(site), site
    for site in ("http://interspecies-paradox.vercel.app", "https://interspecies-paradox.vercel.app.evil.example", "https://other.vercel.app"):
        assert not regex.fullmatch(site), site
