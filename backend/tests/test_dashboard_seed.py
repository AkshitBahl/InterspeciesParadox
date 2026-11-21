"""Dashboard overview and the demo seed."""

from sqlalchemy import func, select

from app.models import Conflict, MapFeature, Species, User
from app.seed.loader import run
from tests.helpers import API


def test_dashboard(client, lina):
    anon = client.get(f"{API}/dashboard").json()
    assert anon["today"] == "2126-05-20"
    assert anon["conflicts_total"] == 6
    assert anon["active_agreements"] == 1
    assert anon["average_accepted_index"] > 80
    assert {s["slug"] for s in anon["seasons"]} >= {"house-martin", "red-fox"}
    martin = next(s for s in anon["seasons"] if s["slug"] == "house-martin")
    assert martin["sensitive_now"] is True and martin["message"].startswith("Sensitive until")

    mine = client.get(f"{API}/dashboard", headers=lina).json()["my_conflicts"]
    assert [c["status"] for c in mine] == ["agreed"]


def test_seed_is_safe_to_run_twice(db):
    def counts():
        return [db.scalar(select(func.count()).select_from(m)) for m in (Species, MapFeature, User, Conflict)]

    before = counts()
    run(db)
    assert counts() == before
    assert before[0] == 6 and before[2] == 7 and before[3] == 6


def test_openapi_docs_are_generated(client):
    spec = client.get("/openapi.json").json()
    assert spec["info"]["title"]
    assert "/api/v1/conflicts/{conflict_id}/negotiation/counter-proposals" in spec["paths"]
