"""Animation tracks for the map ("a bird flies along its corridor, robots take
the new route...").

The frontend gets, for each moving object, a path plus evenly spaced keyframes,
so it can animate with Turf.js `along()` or simply step through the keyframes.
Speeds are *accelerated* for the demo so a loop takes 4-30 seconds.
"""

from typing import Any

from app.models import MapFeature, Species
from app.services import geo

DEMO_SPEED_M_S = {"aerial": 30.0, "flying_insect": 8.0, "ground": 4.0, "foot": 6.0, "bike": 12.0, "robot": 8.0}


def _emoji_and_speed(f: MapFeature, sp: Species | None) -> tuple[str, float, str]:
    props = f.properties or {}
    if f.layer == "wildlife_corridor" and sp:
        return sp.emoji, DEMO_SPEED_M_S.get(sp.movement_mode, 5.0), "wildlife"
    if f.layer == "delivery_route":
        vehicle = props.get("vehicle", "")
        if "robot" in vehicle:
            return "🤖", DEMO_SPEED_M_S["robot"], "delivery"
        return "🚲", DEMO_SPEED_M_S["bike"], "delivery"
    return "🚶", DEMO_SPEED_M_S["foot"], "human"


def build_tracks(
    features: list[MapFeature], species: dict, roles: dict | None = None, include_streets: bool = False
) -> list[dict[str, Any]]:
    roles = roles or {}
    tracks = []
    for f in features:
        if f.geometry["type"] != "LineString" or f.layer not in ("wildlife_corridor", "human_route", "delivery_route"):
            continue
        props = f.properties or {}
        if not include_streets and props.get("kind") == "street":
            continue
        if not props.get("animate", f.layer == "wildlife_corridor"):
            continue
        sp = species.get(f.species_id)
        emoji, speed, kind = _emoji_and_speed(f, sp)
        coords = f.geometry["coordinates"]
        length = geo.length_m(f.geometry)
        duration = int(max(4000, min(30000, length / speed * 1000)))
        n = int(max(10, min(80, length / 8)))
        tracks.append({
            "id": str(f.id),
            "feature_id": str(f.id),
            "label": f.name,
            "kind": kind,
            "layer": f.layer,
            "emoji": emoji,
            "species_slug": sp.slug if sp else None,
            "scenario_role": roles.get(f.id, "current"),
            "coordinates": coords,
            "length_m": round(length, 1),
            "duration_ms": duration,
            "loop": True,
            "start_delay_ms": (f.id.int % 20) * 100,
            "keyframes": geo.sample_along(coords, n),
        })
    order = {"proposed": 0, "current": 1}
    tracks.sort(key=lambda t: (order.get(t["scenario_role"], 2), t["kind"], t["label"]))
    return tracks
