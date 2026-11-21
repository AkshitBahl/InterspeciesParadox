"""Steps 7-8: negotiate with the species representative, then sign a temporary agreement."""

from tests.helpers import API, conflict_by_title, solutions_by_strategy


def _negotiation(client, conflict_id):
    return f"{API}/conflicts/{conflict_id}/negotiation"


def test_open_negotiation_is_idempotent(client, mei):
    bees = conflict_by_title(client, "bees")
    first = client.post(_negotiation(client, bees["id"]), headers=mei)
    assert first.status_code == 201
    body = first.json()
    assert body["status"] == "open"
    assert body["current_solution"]["coexistence_index"] == bees["best_index"]
    assert any(m["author_type"] == "representative" for m in body["messages"])
    again = client.post(_negotiation(client, bees["id"]), headers=mei).json()
    assert again["id"] == body["id"]
    assert client.get(f"{API}/conflicts/{bees['id']}").json()["status"] == "negotiating"


def test_chat_with_the_representative(client, jonas):
    bats = conflict_by_title(client, "Bats")
    msgs = client.post(f"{_negotiation(client, bats['id'])}/messages", headers=jonas, json={"message": "When can we start the roof?"}).json()
    assert [m["author_type"] for m in msgs] == ["human", "representative"]
    assert msgs[1]["author_name"] == "Count Pipistrello"
    assert msgs[1]["payload"]["statement"]["grounding"]


def test_counter_proposal_inside_the_season_gets_a_counter_offer(client, jonas):
    bats = conflict_by_title(client, "Bats")
    shift = solutions_by_strategy(client, bats["id"])["schedule_shift"]
    r = client.post(f"{_negotiation(client, bats['id'])}/counter-proposals", headers=jonas,
                    json={"solution_id": shift["id"], "changes": {"new_start": "2126-06-15"}, "message": "Can we start mid-June?"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["verdict"] == "counter"
    assert body["revision"]["status"] == "rejected"
    assert body["revision"]["legal_compliant"] is False
    counter = body["counter_solution"]
    assert counter["origin"] == "representative_counter"
    assert counter["parameters"]["new_start"] >= "2126-09-01"  # after the maternity season
    assert counter["legal_compliant"] is True
    assert body["negotiation"]["current_solution_id"] == counter["id"]
    assert body["negotiation"]["rounds"] == 1
    # the reply explains the real problem (the season), not a distance
    assert "works" in body["messages"][1]["text"]


def test_harmless_counter_proposal_is_accepted(client, jonas):
    bats = conflict_by_title(client, "Bats")
    shift = solutions_by_strategy(client, bats["id"])["schedule_shift"]
    body = client.post(f"{_negotiation(client, bats['id'])}/counter-proposals", headers=jonas,
                       json={"solution_id": shift["id"], "changes": {"duration_days": 50}}).json()
    assert body["verdict"] == "accept"
    assert body["revision"]["origin"] == "human_revision"
    assert body["revision"]["parent_solution_id"] == shift["id"]
    assert body["counter_solution"] is None


def test_impossible_counter_proposal_is_rejected(client, jonas):
    bats = conflict_by_title(client, "Bats")
    shift = solutions_by_strategy(client, bats["id"])["schedule_shift"]
    # a whole year of works can never fit outside the bats' sensitive months
    body = client.post(f"{_negotiation(client, bats['id'])}/counter-proposals", headers=jonas,
                       json={"solution_id": shift["id"], "changes": {"duration_days": 365}}).json()
    assert body["verdict"] == "reject"
    assert body["counter_solution"] is None


def test_counter_proposal_validation(client, jonas):
    bats = conflict_by_title(client, "Bats")
    shift = solutions_by_strategy(client, bats["id"])["schedule_shift"]
    url = f"{_negotiation(client, bats['id'])}/counter-proposals"
    assert client.post(url, headers=jonas, json={"solution_id": shift["id"], "changes": {"banana": 1}}).status_code == 422
    other = next(iter(solutions_by_strategy(client, conflict_by_title(client, "bees")["id"]).values()))
    assert client.post(url, headers=jonas, json={"solution_id": other["id"], "changes": {"duration_days": 5}}).status_code == 400


def test_accept_rules(client, jonas, mei):
    bats = conflict_by_title(client, "Bats")
    shift = solutions_by_strategy(client, bats["id"])["schedule_shift"]
    url = f"{_negotiation(client, bats['id'])}/accept"
    assert client.post(url, headers=mei, json={"solution_id": shift["id"]}).status_code == 403
    illegal = client.post(f"{_negotiation(client, bats['id'])}/counter-proposals", headers=jonas,
                          json={"solution_id": shift["id"], "changes": {"duration_days": 365}}).json()["revision"]
    assert client.post(url, headers=jonas, json={"solution_id": illegal["id"]}).status_code == 400


def test_full_flow_accept_sign_and_map(client, mei):
    bees = conflict_by_title(client, "bees")
    habitat = solutions_by_strategy(client, bees["id"])["alternative_habitat"]
    client.post(_negotiation(client, bees["id"]), headers=mei)

    r = client.post(f"{_negotiation(client, bees['id'])}/accept", headers=mei, json={"solution_id": habitat["id"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["solution"]["status"] == "accepted"
    assert body["negotiation"]["status"] == "agreed"
    agreement = body["agreement"]
    assert agreement["status"] == "draft"
    assert [s["party"] for s in agreement["signatures"]] == ["species_representative"]
    assert agreement["valid_until"] > agreement["valid_from"]
    assert agreement["review_dates"]
    assert client.get(f"{API}/conflicts/{bees['id']}").json()["status"] == "agreement_pending"

    # proposed features are not on the current map yet
    current = client.get(f"{API}/map/features").json()["features"]
    assert not any(f["properties"]["solution_id"] == habitat["id"] for f in current)

    signed = client.post(f"{API}/agreements/{agreement['id']}/sign", headers=mei).json()
    assert signed["status"] == "active"
    assert client.get(f"{API}/conflicts/{bees['id']}").json()["status"] == "agreed"

    current = client.get(f"{API}/map/features").json()["features"]
    agreed = [f for f in current if f["properties"]["agreement_id"] == agreement["id"]]
    assert agreed and all(f["properties"]["status"] == "agreed" for f in agreed)
    assert any(f["properties"]["layer"] == "agreed_zone" for f in agreed)

    md = client.get(f"{API}/agreements/{agreement['id']}/markdown")
    assert md.headers["content-type"].startswith("text/markdown")
    assert "Osmia Stonewright" in md.text and "active" in md.text

    assert client.post(f"{API}/agreements/{agreement['id']}/sign", headers=mei).status_code == 400  # signed twice


def test_neighbour_can_cosign_and_reporter_can_terminate(client, lina, jonas):
    martins = conflict_by_title(client, "House martins")
    agreement_id = martins["agreement_id"]
    assert martins["agreement_status"] == "active"

    cosigned = client.post(f"{API}/agreements/{agreement_id}/sign", headers=jonas, json={"role": "building_manager"}).json()
    assert {"party": "building_manager"}.items() <= cosigned["signatures"][-1].items()

    assert client.post(f"{API}/agreements/{agreement_id}/terminate", headers=jonas, json={"reason": "not mine"}).status_code == 400
    ended = client.post(f"{API}/agreements/{agreement_id}/terminate", headers=lina, json={"reason": "The martins left early."}).json()
    assert ended["status"] == "terminated"
    assert client.get(f"{API}/conflicts/{martins['id']}").json()["status"] == "closed"
    # agreed features disappear from the current map once the agreement ends
    current = client.get(f"{API}/map/features").json()["features"]
    assert not any(f["properties"]["agreement_id"] == agreement_id for f in current)


def test_agreements_list_and_expiry(client):
    from datetime import date

    from app.core import clock

    active = client.get(f"{API}/agreements", params={"status": "active"}).json()
    assert len(active) == 1
    clock.set_today(date(2126, 12, 1))  # after the martins' season
    assert client.get(f"{API}/agreements/{active[0]['id']}").json()["status"] == "expired"
