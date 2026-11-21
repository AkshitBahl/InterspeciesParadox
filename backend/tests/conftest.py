"""Test setup.

By default tests use an in-memory SQLite database (fast, nothing to install).
Set TEST_DATABASE_URL to run them against PostgreSQL instead, e.g.
    TEST_DATABASE_URL=postgresql+psycopg://paradox:paradox@localhost:5432/interspecies_test pytest
"""

import os
from collections.abc import Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import clock
from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.seed.loader import DEMO_PASSWORD, run
from app.services import external, llm

TEST_DATE = date(2126, 5, 20)


@pytest.fixture(scope="session")
def engine():
    url = os.getenv("TEST_DATABASE_URL")
    if url:
        eng = create_engine(url)
    else:
        eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture()
def db(engine) -> Iterator[Session]:
    """A fresh, fully seeded database for every test."""
    clock.set_today(TEST_DATE)
    settings.enable_external_geo = False
    settings.llm_enabled = False  # tests never call a real model, whatever .env says
    external.clear_cache()
    llm.reset()
    SessionTest = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with SessionTest() as session:
        run(session, do_reset=True)
        yield session
    clock.set_today(None)


@pytest.fixture()
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def login(client: TestClient, email: str, password: str = DEMO_PASSWORD) -> dict[str, str]:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def lina(client: TestClient) -> dict[str, str]:
    return login(client, "lina@example.org")


@pytest.fixture()
def mei(client: TestClient) -> dict[str, str]:
    return login(client, "mei@example.org")


@pytest.fixture()
def noor(client: TestClient) -> dict[str, str]:
    return login(client, "noor@example.org")


@pytest.fixture()
def jonas(client: TestClient) -> dict[str, str]:
    return login(client, "jonas@example.org")
