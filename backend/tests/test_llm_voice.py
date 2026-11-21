"""The optional local LLM voice: it re-words, the rules decide, and the data check guards the facts.

No real model is called: a fake Ollama answers through httpx.MockTransport.
"""

import json
import re
from collections.abc import Callable, Iterator

import httpx
import pytest

from app.core.config import settings
from app.seed.loader import run
from app.services import llm
from tests.helpers import API, conflict_by_title

Reply = Callable[[str, str], dict | str]


def _draft_lines(user: str) -> list[str]:
    section = user.split("Draft lines:\n", 1)[1].split("\n\n", 1)[0]
    return [re.sub(r"^\d+\. ", "", line) for line in section.splitlines()]


def echo_in_character(system: str, user: str) -> dict:
    """A well-behaved model: same facts, a little extra flair."""
    if "Draft lines:" in user:
        return {"lines": [f"Psst, neighbour! {line}" for line in _draft_lines(user)]}
    return {"answer": "I'd rather nibble beetles than jazz, honestly.", "sources": ["species.diet", "species.made_up"]}


class FakeOllama:
    def __init__(self) -> None:
        self.reply: Reply = echo_in_character
        self.calls: list[dict] = []
        self.down = False
        self.models = [settings.llm_model]

    def handler(self, request: httpx.Request) -> httpx.Response:
        if self.down:
            raise httpx.ConnectError("connection refused", request=request)
        if request.url.path.endswith("/models"):
            return httpx.Response(200, json={"object": "list", "data": [{"id": m} for m in self.models]})
        body = json.loads(request.content)
        self.calls.append(body)
        system, user = body["messages"][0]["content"], body["messages"][1]["content"]
        content = self.reply(system, user)
        text = content if isinstance(content, str) else json.dumps(content)
        return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": text}}]})


@pytest.fixture()
def ollama(db, monkeypatch) -> Iterator[FakeOllama]:
    fake = FakeOllama()
    monkeypatch.setattr(settings, "llm_enabled", True)
    monkeypatch.setattr(llm, "client_factory", lambda: httpx.Client(transport=httpx.MockTransport(fake.handler)))
    llm.reset()
    yield fake
    llm.reset()


def test_off_by_default_uses_templates(client):
    intro = client.get(f"{API}/species/red-fox/representative").json()
    assert intro["voice"] == {"engine": "template", "model": None, "reason": "LLM_ENABLED is false", "template_text": None}
    assert client.get("/health").json()["llm"]["enabled"] is False


def test_llm_rewords_but_keeps_the_grounding(client, ollama):
    intro = client.get(f"{API}/species/red-fox/representative").json()
    assert intro["voice"]["engine"] == "llm"
    assert intro["voice"]["model"] == settings.llm_model
    assert all(line.startswith("Psst, neighbour! ") for line in intro["lines"])
    assert intro["voice"]["template_text"] in intro["text"].replace("Psst, neighbour! ", "")
    assert {g["source"] for g in intro["grounding"]} >= {"species.preferred_buffer_m", "species.min_buffer_m"}
    # The prompt carries the persona and the rules.
    system, user = (m["content"] for m in ollama.calls[0]["messages"])
    assert "Vix Rousseau" in system and "Never add a number" in user
    # Same question again: answered from the cache, no second call.
    client.get(f"{API}/species/red-fox/representative")
    assert len(ollama.calls) == 1


def test_cache_expires_so_replies_can_vary(client, ollama, monkeypatch):
    monkeypatch.setattr(settings, "llm_cache_seconds", 0)
    client.get(f"{API}/species/red-fox/representative")
    client.get(f"{API}/species/red-fox/representative")
    assert len(ollama.calls) == 2
    assert ollama.calls[0]["temperature"] == settings.llm_temperature


def test_invented_numbers_fall_back_to_the_template(client, ollama):
    ollama.reply = lambda system, user: {"lines": [f"{line} Stay 2 m away!" for line in _draft_lines(user)]}
    intro = client.get(f"{API}/species/red-fox/representative").json()
    assert intro["voice"]["engine"] == "template"
    assert "numbers that are not in the data: 2" in intro["voice"]["reason"]
    assert "Stay 2 m away" not in intro["text"]


def test_invented_months_and_wrong_line_counts_fall_back(client, ollama):
    ollama.reply = lambda system, user: {"lines": [f"{line} See you in December." for line in _draft_lines(user)]}
    intro = client.get(f"{API}/species/house-martin/representative").json()
    assert intro["voice"]["engine"] == "template" and "December" in intro["voice"]["reason"]

    llm.reset()
    ollama.reply = lambda system, user: {"lines": ["Just one line."]}
    intro = client.get(f"{API}/species/house-martin/representative").json()
    assert intro["voice"]["engine"] == "template" and "expected" in intro["voice"]["reason"]


def test_breaking_character_falls_back(client, ollama):
    ollama.reply = lambda system, user: {"lines": ["As an AI language model, I cannot be a fox." for _ in _draft_lines(user)]}
    intro = client.get(f"{API}/species/red-fox/representative").json()
    assert intro["voice"]["engine"] == "template"
    assert intro["voice"]["reason"] == "reply broke character"


def test_ask_answers_any_question_from_the_fact_sheet(client, ollama):
    r = client.post(f"{API}/species/european-hedgehog/representative/ask", json={"question": "Do you like jazz?"})
    answer = r.json()
    assert answer["voice"]["engine"] == "llm"
    assert answer["text"] == "I'd rather nibble beetles than jazz, honestly."
    assert answer["topic"] == "open_question"
    # Only real fact names become grounding; the made-up one is dropped.
    assert [g["source"] for g in answer["grounding"]] == ["species.diet"]
    assert answer["voice"]["template_text"].startswith("Fun fact")
    user = ollama.calls[0]["messages"][1]["content"]
    assert "species.min_buffer_m (Absolute minimum distance)" in user
    assert "Question: Do you like jazz?" in user


def test_ask_without_real_sources_falls_back(client, ollama):
    ollama.reply = lambda system, user: {"answer": "Jazz is great.", "sources": ["vibes"]}
    answer = client.post(f"{API}/species/european-hedgehog/representative/ask", json={"question": "Do you like jazz?"}).json()
    assert answer["voice"]["engine"] == "template"
    assert answer["text"].startswith("Fun fact")


def test_tolerates_think_blocks_and_code_fences():
    assert llm.parse_json_object('<think>hmm</think>\n```json\n{"lines": ["a"]}\n```') == {"lines": ["a"]}
    assert llm.parse_json_object('Sure! {"answer": "x", "sources": []} Bye') == {"answer": "x", "sources": []}
    with pytest.raises(llm.LLMError):
        llm.parse_json_object("no json here")


def test_ollama_down_falls_back_and_waits_before_retrying(client, ollama):
    ollama.down = True
    intro = client.get(f"{API}/species/red-fox/representative").json()
    assert intro["voice"]["engine"] == "template" and "could not reach" in intro["voice"]["reason"]
    ollama.down = False
    again = client.get(f"{API}/species/red-fox/representative").json()
    assert again["voice"]["engine"] == "template" and "trying again" in again["voice"]["reason"]
    assert ollama.calls == []  # the cooldown skipped the call
    llm.reset()
    assert client.get(f"{API}/species/red-fox/representative").json()["voice"]["engine"] == "llm"


def test_negotiation_chat_and_counter_offers_are_voiced(client, ollama, jonas):
    bats = conflict_by_title(client, "Bats")
    msgs = client.post(f"{API}/conflicts/{bats['id']}/negotiation/messages", headers=jonas,
                       json={"message": "Do you like our roof garden?"}).json()
    statement = msgs[1]["payload"]["statement"]
    assert statement["voice"]["engine"] == "llm"
    assert msgs[1]["text"] == statement["text"]


def test_route_negotiation_keeps_objection_and_reply_steps(client, ollama):
    body = {"start": {"lon": 4.3722935, "lat": 50.8230956}, "end": {"lon": 4.3745688, "lat": 50.8247235}, "provider": "local"}
    result = client.post(f"{API}/geo/route/negotiate", json=body).json()
    assert result["outcome"] == "conditions"
    fox = result["statements"][0]
    assert fox["voice"]["engine"] == "llm"
    kinds = [s["kind"] for s in result["steps"]]
    assert "objection" in kinds and "reply" in kinds
    objection = next(s for s in result["steps"] if s["kind"] == "objection")
    assert objection["text"].startswith("Psst, neighbour! ")


def test_seeding_never_calls_the_model(db, ollama):
    run(db, do_reset=True)
    assert ollama.calls == []


def test_health_reports_the_model(client, ollama):
    info = client.get("/health").json()["llm"]
    assert info["enabled"] is True and info["reachable"] is True and info["model_ready"] is True
    ollama.models = ["llama3.2:3b"]
    info = client.get("/health").json()["llm"]
    assert info["model_ready"] is False and "ollama pull" in info["note"]
    ollama.down = True
    info = client.get("/health").json()["llm"]
    assert info["reachable"] is False and "Is Ollama running?" in info["note"]
