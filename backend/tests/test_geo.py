"""Search and wildlife-aware routing. External services (OSRM, Nominatim) are faked."""

import httpx
import pytest

from app.core.config import settings
from app.seed.brussels_dataset import ll
from app.services import external
from tests.helpers import API

X, E = ll(-115, 160), ll(140, 160)  # two corners on Avenue du Soleil
ROUTE = {"start": {"lon": X[0], "lat": X[1]}, "end": {"lon": E[0], "lat": E[1]}, "profile": "foot"}


@pytest.fixture()
def fox_on_the_avenue(client, noor):
    """Drop a fox resting spot in the middle of Avenue du Soleil (fox cubs: March-June)."""
    r = client.post(f"{API}/map/features", headers=noor, json={
        "layer": "wildlife_site", "name": "Fox resting under a bench", "species_slug": "red-fox",
        "geometry": {"type": "Point", "coordinates": ll(-10, 160)},
    })
    assert r.status_code == 201
    return r.json()


@pytest.fixture()
def fake_osm(monkeypatch):
    """Turn external geo on and answer OSRM/Nominatim requests from memory."""
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        path = request.url.path
        if "/route/v1/" in path:
            line = [list(X), list(ll(-10, 160)), list(E)]  # straight down the avenue, past the fox
            return httpx.Response(200, json={"code": "Ok", "routes": [{
                "geometry": {"type": "LineString", "coordinates": line}, "distance": 255.0, "duration": 190.0,
                "legs": [{"steps": [{"maneuver": {"type": "depart"}, "name": "Avenue du Soleil", "distance": 255.0}]}],
            }]})
        if path.endswith("/search"):
            return httpx.Response(200, json=[{"name": "Place Flagey", "display_name": "Place Flagey, Ixelles, Brussels", "lon": "4.3720", "lat": "50.8275", "type": "square"}])
        if path.endswith("/reverse"):
            return httpx.Response(200, json={"display_name": "Rue de la Mousse 12, Ixelles"})
        return httpx.Response(404)

    monkeypatch.setattr(settings, "enable_external_geo", True)
    monkeypatch.setattr(external, "client_factory", lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    return calls


def test_offline_route_without_wildlife_in_the_way(client):
    r = client.post(f"{API}/geo/route", json=ROUTE).json()
    assert r["provider_used"] == "local"
    assert len(r["routes"]) == 1  # the two offline options are the same, so they are merged
    route = r["routes"][0]
    assert route["distance_m"] == pytest.approx(255, abs=1)
    assert route["wildlife"]["wildlife_friendly"] is True
    assert route["steps"][0]["instruction"].startswith("Walk along Avenue du Soleil")


def test_offline_route_detours_around_an_active_buffer(client, fox_on_the_avenue):
    r = client.post(f"{API}/geo/route", json=ROUTE).json()
    routes = {x["id"]: x for x in r["routes"]}
    shortest, friendly = routes["local-shortest"], routes["local-wildlife"]
    assert shortest["wildlife"]["crosses_buffers"][0]["species"] == "Red fox"
    assert shortest["wildlife"]["disturbance_score"] > 0
    assert friendly["wildlife"]["wildlife_friendly"] is True
    assert friendly["distance_m"] > shortest["distance_m"]
    assert r["recommended_route_id"] == "local-wildlife"

    fastest_first = client.post(f"{API}/geo/route", json={**ROUTE, "avoid_active_buffers": False}).json()
    assert fastest_first["recommended_route_id"] == "local-shortest"

    bike = client.post(f"{API}/geo/route", json={**ROUTE, "profile": "bike"}).json()
    assert bike["routes"][0]["duration_s"] < shortest["duration_s"]


def test_buffers_out_of_season_are_ignored(client, fox_on_the_avenue):
    from datetime import date

    from app.core import clock

    clock.set_today(date(2126, 10, 1))  # fox cubs have left the den by autumn
    r = client.post(f"{API}/geo/route", json=ROUTE).json()
    assert all(x["wildlife"]["wildlife_friendly"] for x in r["routes"])


def test_high_nests_do_not_disturb_the_street(client):
    """The peregrine ledge is 78 m up Solaris Tower: walking below is fine."""
    w, e = ll(-220, 160), ll(140, 160)
    r = client.post(f"{API}/geo/route", json={**ROUTE, "start": {"lon": w[0], "lat": w[1]}, "end": {"lon": e[0], "lat": e[1]}}).json()
    assert all(x["wildlife"]["wildlife_friendly"] for x in r["routes"])
    assert any("high nests" in note for note in r["notes"])


def test_osrm_route_gets_a_wildlife_friendly_alternative(client, fox_on_the_avenue, fake_osm):
    r = client.post(f"{API}/geo/route", json=ROUTE).json()
    assert r["provider_used"] == "osrm"
    ids = [x["id"] for x in r["routes"]]
    assert ids[0] == "osrm-0" and "local-wildlife" in ids
    osrm = r["routes"][0]
    assert osrm["steps"][0]["name"] == "Avenue du Soleil"
    assert osrm["wildlife"]["wildlife_friendly"] is False
    assert r["recommended_route_id"] == "local-wildlife"
    assert any("/routed-foot/route/v1/" in str(c.url) for c in fake_osm)


def test_osrm_failure_falls_back_offline(client, monkeypatch):
    def broken(request):
        return httpx.Response(503)

    monkeypatch.setattr(settings, "enable_external_geo", True)
    monkeypatch.setattr(external, "client_factory", lambda: httpx.Client(transport=httpx.MockTransport(broken)))
    r = client.post(f"{API}/geo/route", json=ROUTE)
    assert r.status_code == 200
    assert r.json()["provider_used"] == "local"
    assert any("OSRM unavailable" in n for n in r.json()["notes"])
    assert client.post(f"{API}/geo/route", json={**ROUTE, "provider": "osrm"}).status_code == 502


def test_local_search_ranks_dataset_matches_first(client):
    r = client.get(f"{API}/geo/search", params={"q": "moss"}).json()
    assert r["results"][0]["name"] == "Mosshaus Residences"
    assert all(x["source"] == "local" for x in r["results"])
    bats = client.get(f"{API}/geo/search", params={"q": "pipistrelle"}).json()["results"]
    assert any(x["layer"] == "wildlife_site" for x in bats)


def test_search_adds_nominatim_results(client, fake_osm):
    r = client.get(f"{API}/geo/search", params={"q": "flagey"}).json()
    sources = [x["source"] for x in r["results"]]
    assert "local" in sources and "nominatim" in sources
    assert sources.index("local") < sources.index("nominatim")
    request = next(c for c in fake_osm if c.url.path.endswith("/search"))
    assert request.url.params["format"] == "jsonv2"


def test_reverse_geocode(client, fake_osm):
    lon, lat = ll(40, 80)
    r = client.get(f"{API}/geo/reverse", params={"lon": lon, "lat": lat}).json()
    assert r["nearest_feature"]["name"] == "Mosshaus main entrance"  # the most specific thing here
    assert any(x["layer"] == "building" for x in r["also_here"])
    assert r["address"] == "Rue de la Mousse 12, Ixelles"


def test_external_answers_are_cached(client, fake_osm):
    client.get(f"{API}/geo/search", params={"q": "flagey"})
    client.get(f"{API}/geo/search", params={"q": "flagey"})
    assert sum(1 for c in fake_osm if c.url.path.endswith("/search")) == 1


# --- Route negotiation ------------------------------------------------------------

PONDSIDE, MOSSHAUS = [4.3722935, 50.8230956], [4.3745688, 50.8247235]
SCHOOL_RUN = {"start": {"lon": PONDSIDE[0], "lat": PONDSIDE[1]}, "end": {"lon": MOSSHAUS[0], "lat": MOSSHAUS[1]}, "provider": "local"}


def test_route_lists_the_wildlife_along_the_way(client):
    route = client.post(f"{API}/geo/route", json=SCHOOL_RUN).json()["routes"][0]
    nearby = {n["name"]: n for n in route["wildlife"]["nearby"]}
    martins = nearby["House martin colony above Mosshaus entrance"]
    assert martins["disturbed_by_route"] is False and "out of reach" in martins["note"]
    fox = nearby["Fox den under the garden shed"]
    assert fox["disturbed_by_route"] is True and fox["sensitive_now"] is True
    assert any(n["layer"] == "wildlife_corridor" and n["species_slug"] == "european-hedgehog" for n in nearby.values())
    distances = [n["distance_m"] for n in route["wildlife"]["nearby"]]
    assert distances == sorted(distances)


def _negotiate(client, body):
    r = client.post(f"{API}/geo/route/negotiate", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_negotiation_without_conflict(client):
    d = _negotiate(client, {**ROUTE, "provider": "local"})
    assert d["outcome"] == "no_conflict"
    assert d["negotiated_route"]["id"] == d["initial_route"]["id"]
    assert d["statements"] == [] and d["conditions"] == []
    assert d["steps"][-1]["kind"] == "agreement"


def test_negotiation_reroutes_around_the_fox(client, fox_on_the_avenue):
    d = _negotiate(client, {**ROUTE, "provider": "local"})
    assert d["outcome"] == "rerouted"
    assert d["initial_route"]["id"] == "local-shortest"
    assert d["negotiated_route"]["id"] == "local-wildlife"
    assert d["comparison"]["disturbance_before"] > 0 and d["comparison"]["disturbance_after"] == 0
    assert d["comparison"]["extra_distance_m"] == pytest.approx(200, abs=2)
    assert d["wildlife_on_route"][0]["name"] == "Fox resting under a bench"

    [fox] = d["statements"]
    assert fox["speaker"] == "Vix Rousseau"
    assert {g["source"] for g in fox["grounding"]} >= {"species.preferred_buffer_m", "species.sensitive_months"}
    assert [s["kind"] for s in d["steps"]] == ["initial_route", "wildlife_on_route", "objection", "reply", "agreement"]
    roles = {f["properties"]["role"] for f in d["geojson"]["features"]}
    assert roles == {"initial_route", "negotiated_route", "crossed_zone", "wildlife_on_route"}
    negotiated = next(f for f in d["geojson"]["features"] if f["properties"]["role"] == "negotiated_route")
    assert negotiated["properties"]["stroke"]  # also readable in geojson.io


def test_negotiation_sets_conditions_when_the_detour_is_too_long(client, fox_on_the_avenue):
    d = _negotiate(client, {**ROUTE, "provider": "local", "max_extra_minutes": 1})
    assert d["outcome"] == "conditions"
    assert d["negotiated_route"]["id"] == "local-shortest"
    assert d["detour_offered"]["id"] == "local-wildlife"
    assert "keep dogs on a lead" in d["conditions"]  # foxes move on the ground
    sources = {g["source"] for g in d["statements"][0]["grounding"]}
    assert {"species.movement_mode", "species.min_buffer_m"} <= sources


def test_negotiation_sets_conditions_when_there_is_no_way_around(client):
    """The only path out of Pondside Terraces passes the fox den."""
    d = _negotiate(client, {**SCHOOL_RUN, "profile": "bike"})
    assert d["outcome"] == "conditions"
    assert d["detour_offered"] is None
    assert "slow down to walking pace" in d["conditions"]
    assert "no way around" in d["steps"][-1]["text"]


def test_negotiation_with_osrm(client, fox_on_the_avenue, fake_osm):
    d = _negotiate(client, ROUTE)
    assert d["provider_used"] == "osrm"
    assert d["initial_route"]["id"] == "osrm-0"
    assert d["outcome"] == "rerouted" and d["negotiated_route"]["id"] == "local-wildlife"
