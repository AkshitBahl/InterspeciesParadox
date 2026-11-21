"""Plain unit tests for the pure helpers (no database)."""

from datetime import date

import pytest

from app.core.security import TokenError, create_token, decode_token, hash_password, verify_password
from app.services import geo, seasons
from app.services.coexistence_index import compute_index, grade, normalise_weights
from app.services.representative import format_months

# --- security -------------------------------------------------------------------


def test_password_hash_roundtrip():
    hashed = hash_password("coexist2126")
    assert hashed.startswith("$argon2")
    assert verify_password("coexist2126", hashed)
    assert not verify_password("wrong", hashed)


def test_token_types_are_checked():
    import uuid

    uid = uuid.uuid4()
    assert decode_token(create_token(uid, "access"), "access") == uid
    with pytest.raises(TokenError):
        decode_token(create_token(uid, "access"), "refresh")
    with pytest.raises(TokenError):
        decode_token("garbage", "access")


# --- seasons --------------------------------------------------------------------


def test_months_between_wraps_years():
    assert seasons.months_between(date(2126, 11, 20), date(2127, 2, 3)) == [11, 12, 1, 2]


def test_next_window_outside_skips_the_season():
    # Bats are sensitive May-August: a 30-day job asked for in June starts on 1 September.
    start = seasons.next_window_outside([5, 6, 7, 8], date(2126, 6, 15), 30)
    assert start == date(2126, 9, 1)
    assert seasons.next_window_outside(list(range(1, 13)), date(2126, 6, 15), 5) is None


def test_end_and_next_season():
    assert seasons.end_of_season([4, 5, 6, 7, 8, 9], date(2126, 5, 20)) == date(2126, 9, 30)
    assert seasons.next_season_start([4, 5, 6, 7, 8, 9], date(2126, 5, 20)) == date(2127, 4, 1)
    assert seasons.overlap_fraction(date(2126, 5, 25), date(2126, 6, 3), [5]) == pytest.approx(0.7)


def test_format_months_handles_runs_across_new_year():
    assert format_months([11, 12, 1, 2, 3]) == "November–March"


# --- geo ------------------------------------------------------------------------


def test_circle_and_distance_are_in_metres():
    lon, lat = 4.374, 50.824
    circle = geo.circle(lon, lat, 10)
    assert geo.area_m2(circle) == pytest.approx(3.14159 * 100, rel=0.03)
    east = geo.point(*geo.LocalProjection(lon, lat).to_lonlat(25, 0))
    assert geo.distance_m(geo.point(lon, lat), east) == pytest.approx(25, abs=0.2)


def test_length_inside_a_buffer():
    proj = geo.LocalProjection(4.374, 50.824)
    line = {"type": "LineString", "coordinates": [list(proj.to_lonlat(-20, 0)), list(proj.to_lonlat(20, 0))]}
    buffer = geo.circle(4.374, 50.824, 5)
    assert geo.length_inside(line, buffer) == pytest.approx(10, abs=0.5)


def test_invalid_geometry_is_rejected():
    with pytest.raises(ValueError):
        geo.validate_geometry({"type": "Point", "coordinates": [400, 0]})


# --- Coexistence Index ---------------------------------------------------------

NEEDS = [
    {"key": "nest", "side": "wildlife", "label": "Nest", "importance": 5, "baseline_satisfaction": 0.3},
    {"key": "door", "side": "human", "label": "Door", "importance": 5, "baseline_satisfaction": 0.5},
]


def _index(**overrides):
    args = dict(cost_eur=200, budget_eur=500, effort="low", implementation_days=1, days_available=10, legal_compliant=True)
    args.update(overrides)
    effects = args.pop("effects", {"nest": {"satisfaction": 0.9, "reason": "quiet"}, "door": {"satisfaction": 0.8, "reason": "ok"}})
    return compute_index(NEEDS, effects, **args)


def test_index_formula_is_transparent():
    result = _index()
    parts = {c["key"]: c for c in result["components"]}
    assert parts["wildlife_wellbeing"]["score"] == 90.0
    assert parts["human_wellbeing"]["score"] == 80.0
    assert parts["feasibility"]["score"] == 100.0
    assert parts["balance"]["score"] == 90.0
    assert result["raw_index"] == pytest.approx(0.3 * 90 + 0.3 * 80 + 0.2 * 100 + 0.2 * 90)
    assert result["index"] == result["raw_index"]
    assert result["grade"] == "Thriving together"
    assert all(g["passed"] for g in result["gates"])


def test_safety_gates_cap_the_index():
    assert _index(legal_compliant=False, legal_notes=["breaks the law"])["index"] == 39.0
    assert _index(limit_violations=["too close to the den"])["index"] == 49.0
    assert _index(hard_violations=["no step-free access"])["index"] == 49.0


def test_one_sided_solutions_are_punished_by_balance():
    fair = _index()
    one_sided = _index(effects={"nest": {"satisfaction": 1.0, "reason": ""}, "door": {"satisfaction": 0.2, "reason": ""}})
    assert one_sided["index"] < fair["index"]


def test_weights_are_normalised_and_grades():
    w = normalise_weights({"wildlife": 3, "human": 1, "feasibility": 0, "balance": 0})
    assert w["wildlife"] == 0.75 and w["human"] == 0.25
    assert grade(85)[0] == "Thriving together"
    assert grade(70)[0] == "Good neighbours"
    assert grade(55)[0] == "Fragile truce"
    assert grade(20)[0] == "Conflict persists"
