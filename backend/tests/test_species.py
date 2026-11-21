"""Species data and their humorous (but fact-grounded) representatives."""

API = "/api/v1"


def test_species_list_and_detail(client):
    species = client.get(f"{API}/species").json()
    slugs = {s["slug"] for s in species}
    assert slugs == {"house-martin", "peregrine-falcon", "common-pipistrelle", "red-mason-bee", "european-hedgehog", "red-fox"}

    bat = client.get(f"{API}/species/common-pipistrelle").json()
    assert bat["is_legally_protected"] is True
    assert bat["preferred_buffer_m"] >= bat["min_buffer_m"] > 0
    assert bat["representative"]["name"] == "Count Pipistrello"
    assert client.get(f"{API}/species/dodo").status_code == 404


def test_calendar_has_twelve_months(client):
    cal = client.get(f"{API}/species/house-martin/calendar").json()
    assert len(cal["months"]) == 12
    may = cal["months"][4]
    assert may["month"] == 5 and may["sensitive"] is True


def test_representative_introduction_is_grounded(client):
    intro = client.get(f"{API}/species/house-martin/representative").json()
    assert "Martina" in intro["speaker"]
    assert intro["text"]
    assert intro["grounding"], "every statement should point to the data it is based on"
    for g in intro["grounding"]:
        assert g["source"].startswith("species.")


def test_ask_the_representative(client):
    r = client.post(f"{API}/species/red-mason-bee/representative/ask", json={"question": "Will you sting me?"})
    assert r.status_code == 200
    answer = r.json()
    assert answer["text"]
    assert answer["grounding"]

    when = client.post(f"{API}/species/house-martin/representative/ask", json={"question": "When will you leave?"}).json()
    assert any(g["source"] in ("species.active_months", "species.sensitive_months", "species.sensitive_periods") for g in when["grounding"])


def test_any_question_gets_a_grounded_template_answer(client):
    """No language model: an off-topic question still gets an in-character answer from the data."""
    first = client.post(f"{API}/species/european-hedgehog/representative/ask", json={"question": "Do you like jazz?"}).json()
    again = client.post(f"{API}/species/european-hedgehog/representative/ask", json={"question": "Do you like jazz?"}).json()
    assert first["topic"] == "fun_fact"
    assert first["text"].startswith("Fun fact:")
    assert first["grounding"][0]["source"] == "species.facts"
    assert first == again  # templates are repeatable
    assert "voice" not in first
    assert "llm" not in client.get("/health").json()
