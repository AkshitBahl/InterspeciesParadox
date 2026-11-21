"""Route negotiation: the mediator and the animals agree on how you get from A to B.

1. Plan routes as usual (OSRM or offline) and take the FASTEST one: what a human
   would do without thinking about wildlife.
2. List every animal along it (homes, animals, ground corridors), and which ones
   it really disturbs (it crosses their active quiet zone at street level).
3. Each disturbed species' representative objects, with data.
4. The mediator looks for the least disturbing alternative:
   * a detour that costs at most `max_extra_minutes` -> "rerouted"
   * otherwise (no detour, or too long) -> "conditions": you keep the fast route,
     but the representatives set conditions grounded in their data
     (keep quiet, no lights, dogs on a lead...).
   * nothing disturbed in the first place -> "no_conflict".
"""

from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.core import clock
from app.models import Species
from app.services import routing
from app.services.external import ExternalServiceError
from app.services.map_service import current_scenario_features, species_lookup
from app.services.representative import Voice, format_months, site_word

DEFAULT_MAX_EXTRA_MINUTES = 5.0
VERB = {"foot": "walk", "bike": "ride", "car": "drive"}


def _minutes(seconds: float) -> str:
    m = seconds / 60
    return "under a minute" if m < 1 else f"about {m:.0f} min"


def _join(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def _streets(route: dict[str, Any]) -> str:
    names: list[str] = []
    for s in route["steps"]:
        if s["name"] and s["name"] not in names and s["name"] != "unnamed path":
            names.append(s["name"])
    return _join(names) if names else "unnamed paths"


PROVIDER_WORDS = {"local": "the demo district's paths", "osrm": "OpenStreetMap streets"}


def conditions_for(species: Species, profile: str) -> list[tuple[str, str, Any]]:
    """(condition, data field it comes from, value) for passing close to this species."""
    site = site_word(species)
    out: list[tuple[str, str, Any]] = [
        (f"don't stop within {species.min_buffer_m:g} m of the {site}", "species.min_buffer_m", species.min_buffer_m),
    ]
    if species.noise_sensitivity >= 3:
        out.append(("keep voices and music down", "species.noise_sensitivity", species.noise_sensitivity))
    if species.light_sensitivity >= 3:
        out.append(("switch off torches and phone lights", "species.light_sensitivity", species.light_sensitivity))
    if species.activity_pattern == "crepuscular":
        out.append(("avoid dusk and dawn", "species.activity_pattern", species.activity_pattern))
    elif species.activity_pattern == "nocturnal":
        out.append(("avoid passing late at night", "species.activity_pattern", species.activity_pattern))
    if species.movement_mode == "ground":
        out.append(("keep dogs on a lead", "species.movement_mode", species.movement_mode))
    if profile != "foot":
        out.append(("slow down to walking pace", "request.profile", profile))
    return out


def _affected(route: dict[str, Any], species_by_name: dict[str, Species]) -> list[tuple[Species, float]]:
    """Species whose quiet zone the route crosses, with the metres inside (largest first)."""
    totals: dict[str, float] = {}
    for c in route["wildlife"]["crosses_buffers"]:
        if c["species"]:
            totals[c["species"]] = totals.get(c["species"], 0.0) + c["length_inside_m"]
    rows = [(species_by_name[name], m) for name, m in totals.items() if name in species_by_name]
    return sorted(rows, key=lambda x: -x[1])


def _route_feature(route: dict[str, Any], role: str) -> dict[str, Any]:
    return {
        "type": "Feature",
        "id": f"{role}:{route['id']}",
        "geometry": route["geometry"],
        "properties": {
            "layer": "route",
            "role": role,
            "route_id": route["id"],
            "label": route["label"],
            "distance_m": route["distance_m"],
            "duration_s": route["duration_s"],
            "disturbance_score": route["wildlife"]["disturbance_score"],
        },
    }


def negotiate_route(
    db: Session,
    *,
    start: list[float],
    end: list[float],
    waypoints: list[list[float]] | None = None,
    profile: str = "foot",
    provider: str = "auto",
    max_extra_minutes: float = DEFAULT_MAX_EXTRA_MINUTES,
    nearby_m: float = routing.NEARBY_M,
    day: date | None = None,
) -> dict[str, Any]:
    day = day or clock.today()
    plan = routing.plan_routes(
        db, start=start, end=end, waypoints=waypoints, profile=profile, alternatives=True,
        avoid_active_buffers=True, provider=provider, day=day, nearby_m=nearby_m,
    )
    routes = plan["routes"]
    if not routes:
        raise ExternalServiceError("No route found between these points.")
    species = species_lookup(db)
    by_name = {s.common_name: s for s in species.values()}

    initial = min(routes, key=lambda r: r["duration_s"])
    best = min(routes, key=lambda r: (r["wildlife"]["disturbance_score"], r["duration_s"]))
    extra_s = best["duration_s"] - initial["duration_s"]
    extra_m = best["distance_m"] - initial["distance_m"]
    before = initial["wildlife"]["disturbance_score"]
    after = best["wildlife"]["disturbance_score"]
    if before == 0:
        outcome = "no_conflict"
    elif after < before and extra_s <= max_extra_minutes * 60:
        outcome = "rerouted"
    else:
        outcome = "conditions"
    final = best if outcome == "rerouted" else initial
    detour_offered = best if outcome == "conditions" and after < before else None

    verb = VERB.get(profile, "go")
    steps: list[dict[str, Any]] = []

    def step(actor: str, text: str, kind: str) -> None:
        steps.append({"step": len(steps) + 1, "actor": actor, "kind": kind, "text": text})

    on = PROVIDER_WORDS.get(initial["provider"], "the map")
    step("Mediator", f"Fastest way, on {on}: {initial['distance_m']:.0f} m along {_streets(initial)}, {_minutes(initial['duration_s'])}.", "initial_route")
    nearby = initial["wildlife"]["nearby"]
    if nearby:
        lines = [f"{n['emoji']} {n['name']}, {n['distance_m']:.0f} m away: {n['note']}" for n in nearby[:5]]
        more = f" And {len(nearby) - 5} more." if len(nearby) > 5 else ""
        step("Mediator", "On the way: " + " · ".join(lines) + more, "wildlife_on_route")
    else:
        step("Mediator", f"No wildlife within {nearby_m:.0f} m of this route.", "wildlife_on_route")

    statements: list[dict[str, Any]] = []
    all_conditions: list[str] = []
    for sp, inside in _affected(initial, by_name):
        v = Voice(sp, sp.representative)
        v.say("route.objection", seed=initial["id"], inside_m=f"{inside:.0f}")
        v.ground(f"Quiet zone of {sp.preferred_buffer_m:g} m, active in {format_months(sp.sensitive_months)}",
                 "species.preferred_buffer_m", sp.preferred_buffer_m)
        v.ground_season()
        if outcome == "rerouted":
            v.say("route.thanks", seed=best["id"], extra_m=f"{max(extra_m, 0):.0f}", extra_min=_minutes(max(extra_s, 0)))
        else:
            conds = conditions_for(sp, profile)
            text = _join([c for c, _, _ in conds])
            key = "route.too_long" if detour_offered else "route.conditions"
            v.say(key, seed=initial["id"], extra_m=f"{max(extra_m, 0):.0f}", conditions=text)
            for c, source, value in conds:
                v.ground(c, source, value)
                if c not in all_conditions:
                    all_conditions.append(c)
        v.ground_legal()
        statement = v.statement("route_negotiation")
        statements.append(statement)
        step(statement["speaker"], statement["lines"][0], "objection")
        step(statement["speaker"], " ".join(statement["lines"][1:]), "reply")

    if outcome == "no_conflict":
        step("Mediator", f"Nobody is disturbed: {verb} the fastest way.", "agreement")
    elif outcome == "rerouted":
        step("Mediator", (
            f"Agreed: take the detour along {_streets(best)}. It is {best['distance_m']:.0f} m, "
            f"{max(extra_m, 0):.0f} m and {_minutes(max(extra_s, 0))} more, and disturbance drops from {before:.0f} to {after:.0f} out of 100."
        ), "agreement")
    else:
        why = (
            f"The gentlest detour adds {_minutes(extra_s)}, more than your limit of {max_extra_minutes:g} min."
            if detour_offered else "There is no way around."
        )
        speakers = _join([st["speaker"] for st in statements])
        step("Mediator", f"{why} Agreed: you keep the fastest route, on {speakers}'s conditions.", "agreement")

    # One GeoJSON collection the map can draw directly: routes, zones crossed, animals along the way.
    by_id = {str(f.id): f for f in current_scenario_features(db, day)}
    zone_features = [
        {
            "type": "Feature",
            "id": f"crossed_zone:{c['feature_id']}",
            "geometry": by_id[c["feature_id"]].geometry,
            "properties": {"layer": "route", "role": "crossed_zone", "name": c["name"], "species": c["species"],
                           "emoji": c["species_emoji"], "length_inside_m": c["length_inside_m"]},
        }
        for c in initial["wildlife"]["crosses_buffers"] if c["feature_id"] in by_id
    ]
    animal_features = [
        {
            "type": "Feature",
            "id": f"wildlife_on_route:{n['feature_id']}",
            "geometry": n["geometry"],
            "properties": {"layer": "route", "role": "wildlife_on_route", **{k: v for k, v in n.items() if k != "geometry"}},
        }
        for n in nearby
    ]
    route_features = [_route_feature(initial, "initial_route")]
    if final is not initial:
        route_features.append(_route_feature(final, "negotiated_route"))
    elif detour_offered:
        route_features.append(_route_feature(detour_offered, "detour_offered"))

    return {
        "date": day.isoformat(),
        "outcome": outcome,
        "provider_used": plan["provider_used"],
        "initial_route": initial,
        "negotiated_route": final,
        "detour_offered": detour_offered,
        "wildlife_on_route": nearby,
        "statements": statements,
        "conditions": all_conditions,
        "comparison": {
            "extra_distance_m": round(final["distance_m"] - initial["distance_m"], 1),
            "extra_time_s": round(final["duration_s"] - initial["duration_s"], 1),
            "disturbance_before": before,
            "disturbance_after": final["wildlife"]["disturbance_score"],
            "max_extra_minutes": max_extra_minutes,
        },
        "steps": steps,
        "geojson": {"type": "FeatureCollection", "features": zone_features + animal_features + route_features},
        "notes": plan["notes"],
    }

