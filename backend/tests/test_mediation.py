"""Steps 2-6: report a conflict, assess needs, generate and compare solutions."""

from tests.helpers import API, conflict_by_title, solutions_by_strategy


def test_demo_story_is_seeded(client):
    statuses = {c["title"].split()[0]: c["status"] for c in client.get(f"{API}/conflicts").json()}
    assert statuses["House"] == "agreed"
    assert statuses["Bats"] == "negotiating"
    assert statuses["Fox"] == "reported"


def test_report_a_conflict_creates_hotspot_and_new_site(client, noor):
    body = {
        "title": "Hedgehog sleeping in our compost corner",
        "species_slug": "european-hedgehog",
        "category": "other",
        "location": {"type": "Point", "coordinates": [4.3760, 50.8222]},
        "human_activity": {"type": "garden_works", "planned_start": "2126-06-01", "planned_end": "2126-06-03"},
    }
    r = client.post(f"{API}/conflicts", headers=noor, json=body)
    assert r.status_code == 201, r.text
    conflict = r.json()
    assert conflict["status"] == "reported"
    assert conflict["next_step"].startswith("Run the needs assessment")

    hotspot = client.get(f"{API}/map/features/{conflict['hotspot_feature_id']}").json()
    assert hotspot["properties"]["layer"] == "conflict_hotspot"
    site = client.get(f"{API}/map/features/{conflict['site_feature_id']}").json()
    assert site["properties"]["layer"] == "wildlife_site"
    # a new site gets its seasonal buffer automatically
    buffers = client.get(f"{API}/map/features", params={"layers": "ecological_buffer"}).json()["features"]
    assert any(b["properties"]["parent_id"] == site["id"] for b in buffers)


def test_report_near_a_known_site_reuses_it(client, lina):
    fox = conflict_by_title(client, "Fox")
    site = client.get(f"{API}/map/features/{fox['site_feature_id']}").json()
    body = {"title": "Fox again", "species_slug": "red-fox", "location": site["geometry"]}
    conflict = client.post(f"{API}/conflicts", headers=lina, json=body).json()
    assert conflict["site_feature_id"] == fox["site_feature_id"]


def test_report_validation(client, lina):
    assert client.post(f"{API}/conflicts", headers=lina, json={"title": "No place", "species_slug": "red-fox"}).status_code == 422
    bad_species = {"title": "Unicorn", "species_slug": "unicorn", "location": {"type": "Point", "coordinates": [4.374, 50.824]}}
    assert client.post(f"{API}/conflicts", headers=lina, json=bad_species).status_code == 400
    assert client.post(f"{API}/conflicts", json=bad_species).status_code == 401


def test_only_the_reporter_can_edit(client, lina, noor):
    fox = conflict_by_title(client, "Fox")
    assert client.patch(f"{API}/conflicts/{fox['id']}", headers=lina, json={"severity": 5}).status_code == 403
    r = client.patch(f"{API}/conflicts/{fox['id']}", headers=noor, json={"severity": 5})
    assert r.status_code == 200 and r.json()["severity"] == 5


def test_list_filters(client, mei):
    assert {c["status"] for c in client.get(f"{API}/conflicts", params={"status": "reported"}).json()} == {"reported"}
    bees = client.get(f"{API}/conflicts", params={"species": "red-mason-bee"}).json()
    assert len(bees) == 1
    mine = client.get(f"{API}/conflicts", params={"mine": True}, headers=mei).json()
    assert [c["title"] for c in mine] == [bees[0]["title"]]


def test_needs_assessment(client, noor):
    fox = conflict_by_title(client, "Fox")
    r = client.post(f"{API}/conflicts/{fox['id']}/assessment", headers=noor)
    assert r.status_code == 201, r.text
    a = r.json()
    wildlife = {n["key"] for n in a["wildlife_needs"]}
    assert {"undisturbed_site", "seasonal_quiet"} <= wildlife
    assert a["human_needs"]
    assert a["conflicting_needs"], "a conflict should have at least one clash"
    for pair in a["conflicting_needs"] + a["compatible_needs"]:
        assert pair["explanation"]
    assert 0 <= a["conflict_intensity"] <= 1
    assert a["representative_statement"]["speaker"] == "Vix Rousseau"
    assert client.get(f"{API}/conflicts/{fox['id']}").json()["status"] == "assessed"


def test_generate_and_compare_solutions(client, noor):
    fox = conflict_by_title(client, "Fox")
    r = client.post(f"{API}/conflicts/{fox['id']}/solutions/generate", headers=noor)
    assert r.status_code == 201, r.text
    sols = r.json()
    assert 2 <= len(sols) <= 5
    indexes = [s["coexistence_index"] for s in sols]
    assert indexes == sorted(indexes, reverse=True)
    assert len({s["strategy"] for s in sols}) == len(sols)

    cmp_ = client.get(f"{API}/conflicts/{fox['id']}/solutions/compare").json()
    assert cmp_["recommended_solution_id"] == sols[0]["id"]
    assert all(row["improvement_over_status_quo"] > 0 for row in cmp_["solutions"] if row["legal_compliant"])
    assert cmp_["status_quo"]["index"] < sols[0]["coexistence_index"]

    # generating again replaces the old proposals
    again = client.post(f"{API}/conflicts/{fox['id']}/solutions/generate", headers=noor).json()
    assert {s["id"] for s in again}.isdisjoint({s["id"] for s in sols})
    assert len(client.get(f"{API}/conflicts/{fox['id']}/solutions").json()) == len(again)


def test_coexistence_index_breakdown_and_weights(client):
    bees = conflict_by_title(client, "bees")
    best = max(solutions_by_strategy(client, bees["id"]).values(), key=lambda s: s["coexistence_index"])
    idx = client.get(f"{API}/solutions/{best['id']}/coexistence-index").json()
    assert idx["index"] == best["coexistence_index"]
    assert {c["key"] for c in idx["components"]} == {"wildlife_wellbeing", "human_wellbeing", "feasibility", "balance"}
    assert {g["type"] for g in idx["gates"]} == {"legal_protection", "ecological_minimum", "hard_human_needs"}

    wildlife_first = client.get(f"{API}/solutions/{best['id']}/coexistence-index", params={"wildlife": 1, "human": 0, "feasibility": 0, "balance": 0}).json()
    wildlife_score = next(c["score"] for c in idx["components"] if c["key"] == "wildlife_wellbeing")
    assert wildlife_first["weights"]["wildlife"] == 1.0
    assert wildlife_first["raw_index"] == wildlife_score


def test_only_ideas_better_than_doing_nothing_are_proposed(client):
    for words in ("Bats", "bees", "Peregrine", "robots"):
        conflict = conflict_by_title(client, words)
        cmp_ = client.get(f"{API}/conflicts/{conflict['id']}/solutions/compare").json()
        assert cmp_["solutions"]
        assert all(row["index"] >= cmp_["status_quo"]["index"] + 1 for row in cmp_["solutions"])


def test_illegal_solutions_are_capped(client):
    bats = conflict_by_title(client, "Bats")
    shift = solutions_by_strategy(client, bats["id"])["schedule_shift"]
    assert shift["legal_compliant"] is True
    # Moving the roof works into the maternity season breaks the Habitats Directive.
    preview = client.post(f"{API}/solutions/{shift['id']}/what-if", json={"changes": {"new_start": "2126-06-15"}}).json()
    assert preview["legal_compliant"] is False
    assert preview["coexistence_index"]["index"] <= 39
    legal_gate = next(g for g in preview["coexistence_index"]["gates"] if g["type"] == "legal_protection")
    assert legal_gate["passed"] is False and legal_gate["cap"] == 39


def test_what_if_preview_below_ecological_minimum(client):
    peregrine = conflict_by_title(client, "Peregrine")
    screen = solutions_by_strategy(client, peregrine["id"])["screen_mitigation"]
    params = {p["name"]: p for p in client.get(f"{API}/solutions/{screen['id']}/parameters").json()}
    assert params["radius_m"]["ecological_minimum"] > 0

    ok = client.post(f"{API}/solutions/{screen['id']}/what-if", json={"changes": {"radius_m": params["radius_m"]["current_value"]}}).json()
    too_close = client.post(f"{API}/solutions/{screen['id']}/what-if", json={"changes": {"radius_m": params["radius_m"]["ecological_minimum"] / 2}}).json()
    assert ok["limit_violations"] == []
    assert too_close["limit_violations"]
    assert too_close["coexistence_index"]["index"] <= 49
    assert too_close["would_representative_accept"] in ("counter", "reject")

    # nothing was saved
    assert len(client.get(f"{API}/conflicts/{peregrine['id']}/solutions").json()) == len(solutions_by_strategy(client, peregrine["id"]))


def test_what_if_rejects_unknown_parameters(client):
    bees = conflict_by_title(client, "bees")
    sol = next(iter(solutions_by_strategy(client, bees["id"]).values()))
    assert client.post(f"{API}/solutions/{sol['id']}/what-if", json={"changes": {"banana": 1}}).status_code == 422
