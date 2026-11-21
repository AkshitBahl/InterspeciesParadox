"""Small helpers shared by the API tests."""

from fastapi.testclient import TestClient

API = "/api/v1"


def conflict_by_title(client: TestClient, words: str) -> dict:
    """Find a seeded demo conflict by a word in its title (e.g. 'Fox', 'Bats')."""
    matches = [c for c in client.get(f"{API}/conflicts").json() if words in c["title"]]
    assert matches, f"no demo conflict with '{words}' in the title"
    return matches[0]


def solutions_by_strategy(client: TestClient, conflict_id: str) -> dict[str, dict]:
    """Proposed solutions of a conflict, keyed by strategy."""
    rows = client.get(f"{API}/conflicts/{conflict_id}/solutions").json()
    return {s["strategy"]: s for s in rows if s["status"] == "proposed"}
