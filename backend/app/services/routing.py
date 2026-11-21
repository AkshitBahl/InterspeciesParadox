"""Wildlife-aware route preview.

1. Ask OSRM (real OpenStreetMap streets) for routes + alternatives, if enabled.
2. If OSRM is off or unreachable, use our offline network (the dummy dataset).
3. Score every route against the *active* ecological buffers (today's season):
   how many metres pass through a quiet zone, and for which species.
   Buffers are measured at street level: a nest 78 m up a tower is not
   disturbed by people walking below (see `street_level_zones`).
4. If every route disturbs wildlife, add an offline "wildlife-friendly" route
   that goes around the buffers.
5. Recommend the least disturbing route (then the fastest).
"""

import math
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import settings
from app.models import MapFeature
from app.services import external, geo
from app.services.map_service import (
    active_buffers,
    current_scenario_features,
    species_lookup,
)
from app.services.path_network import PathNetwork

SPEEDS_M_S = {"foot": 1.35, "bike": 4.2, "car": 8.0}

Zone = tuple[MapFeature, dict[str, Any]]  # (buffer feature, its footprint at street level)


def street_level_zones(features: list[MapFeature], buffers: list[MapFeature]) -> tuple[list[Zone], int]:
    """The part of each buffer that reaches the ground.

    A buffer is a sphere of calm around the nest. If the nest is `h` metres up and
    the buffer radius is `r`, people on the street are inside it only within
    sqrt(r² - h²) metres of the spot below the nest (and never if h >= r).
    Returns (zones, how many buffers were skipped because they are too high).
    """
    sites = {f.id: f for f in features if f.layer == "wildlife_site"}
    zones: list[Zone] = []
    skipped = 0
    for b in buffers:
        site = sites.get(b.parent_id) if b.parent_id else None
        height = float((site.properties or {}).get("height_m") or 0) if site else 0.0
        radius = float((b.properties or {}).get("radius_m") or 0)
        if height <= 0 or radius <= 0:
            zones.append((b, b.geometry))
        elif height >= radius:
            skipped += 1
        else:
            lon, lat = geo.centroid(b.geometry)
            zones.append((b, geo.circle(lon, lat, math.sqrt(radius**2 - height**2))))
    return zones, skipped


def _osrm_routes(start: list[float], end: list[float], waypoints: list[list[float]], profile: str, alternatives: bool) -> list[dict[str, Any]]:
    path = settings.osrm_profile_paths.get(profile, settings.osrm_profile_paths.get("foot", "routed-foot"))
    coords = ";".join(f"{lon:.6f},{lat:.6f}" for lon, lat in [start, *waypoints, end])
    url = f"{settings.osrm_base_url.rstrip('/')}/{path}/route/v1/driving/{coords}"
    params = {"overview": "full", "geometries": "geojson", "steps": "true", "alternatives": "true" if alternatives and not waypoints else "false"}
    data = external.get_json(url, params, service="osrm")
    if data.get("code") != "Ok":
        raise external.ExternalServiceError(f"OSRM answered {data.get('code')}: {data.get('message', '')}")
    out = []
    for i, r in enumerate(data.get("routes", [])):
        steps = []
        for leg in r.get("legs", []):
            for s in leg.get("steps", []):
                m = s.get("maneuver", {})
                verb = " ".join(x for x in (m.get("type"), m.get("modifier")) if x)
                name = s.get("name") or "unnamed path"
                steps.append({"instruction": f"{verb.capitalize()} onto {name}".strip(), "name": name, "distance_m": round(s.get("distance", 0.0), 1)})
        out.append({
            "id": f"osrm-{i}",
            "provider": "osrm",
            "label": "Fastest (OSRM)" if i == 0 else f"Alternative {i} (OSRM)",
            "geometry": r["geometry"],
            "distance_m": round(r.get("distance", 0.0), 1),
            "duration_s": round(r.get("duration", 0.0), 1),
            "steps": steps,
        })
    return out


def _local_routes(
    features: list[MapFeature], zones: list[Zone], start: list[float], end: list[float], waypoints: list[list[float]], profile: str,
) -> tuple[list[dict[str, Any]], list[str]]:
    layers = {"human_route"} if profile == "foot" else {"human_route", "delivery_route"}
    network = PathNetwork([f for f in features if f.layer in ("human_route", "delivery_route")])
    avoid = [network.proj.geom_to_xy(geometry) for _, geometry in zones]
    notes = []
    options = []
    for label, avoid_polys in (("Shortest (offline network)", []), ("Wildlife-friendly (offline network)", avoid)):
        points = [start, *waypoints, end]
        coords: list[list[float]] = []
        length = 0.0
        steps: list[dict[str, Any]] = []
        ok = True
        for a, b in zip(points, points[1:], strict=False):
            result = network.shortest_path(tuple(a), tuple(b), avoid=avoid_polys, mode="block", layers=layers)
            if result is None and avoid_polys:
                result = network.shortest_path(tuple(a), tuple(b), avoid=avoid_polys, mode="penalize", layers=layers)
            if result is None:
                ok = False
                break
            seg = [list(a), *result.coordinates, list(b)]
            coords += seg if not coords else seg[1:]
            length += result.length_m + geo.distance_m(geo.point(*a), geo.point(*result.coordinates[0])) + geo.distance_m(geo.point(*b), geo.point(*result.coordinates[-1]))
            for s in result.segments:
                verb = {"foot": "Walk", "bike": "Ride", "car": "Drive"}.get(profile, "Go")
                steps.append({"instruction": f"{verb} along {s['name']} for {s['length_m']:.0f} m", "name": s["name"], "distance_m": s["length_m"]})
        if not ok:
            notes.append(f"No offline route found for '{label}'.")
            continue
        options.append({
            "id": "local-shortest" if not avoid_polys else "local-wildlife",
            "provider": "local",
            "label": label,
            "geometry": {"type": "LineString", "coordinates": coords},
            "distance_m": round(length, 1),
            "duration_s": round(length / SPEEDS_M_S.get(profile, 1.35), 1),
            "steps": steps,
        })
    return options, notes


def _annotate(route: dict[str, Any], zones: list[Zone], species: dict) -> None:
    crossings = []
    total = 0.0
    for b, geometry in zones:
        inside = geo.length_inside(route["geometry"], geometry)
        if inside > 0.5:
            sp = species.get(b.species_id)
            weight = 2.0 if sp and sp.is_legally_protected else 1.0
            total += inside * weight
            crossings.append({
                "feature_id": str(b.id),
                "name": b.name,
                "species": sp.common_name if sp else None,
                "species_emoji": sp.emoji if sp else None,
                "kind": (b.properties or {}).get("kind"),
                "length_inside_m": round(inside, 1),
            })
    route["wildlife"] = {
        "crosses_buffers": crossings,
        "disturbance_score": round(min(100.0, total * 2), 1),
        "wildlife_friendly": not crossings,
    }


def _same(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return abs(a["distance_m"] - b["distance_m"]) < 1.0 and a["geometry"]["coordinates"][len(a["geometry"]["coordinates"]) // 2] == b["geometry"]["coordinates"][len(b["geometry"]["coordinates"]) // 2]


def plan_routes(
    db: Session,
    *,
    start: list[float],
    end: list[float],
    waypoints: list[list[float]] | None = None,
    profile: str = "foot",
    alternatives: bool = True,
    avoid_active_buffers: bool = True,
    provider: str = "auto",
    day: date | None = None,
) -> dict[str, Any]:
    day = day or clock.today()
    waypoints = waypoints or []
    features = current_scenario_features(db, day)
    zones, too_high = street_level_zones(features, active_buffers(features, day))
    notes: list[str] = []
    if too_high:
        notes.append(f"{too_high} active buffer(s) around high nests (rooftops, towers) do not reach street level and were ignored.")
    options: list[dict[str, Any]] = []
    provider_used = "local"

    if provider in ("auto", "osrm"):
        if not settings.enable_external_geo:
            if provider == "osrm":
                raise external.ExternalServiceError("External routing is disabled (ENABLE_EXTERNAL_GEO=false).")
            notes.append("External routing is disabled; using the offline network.")
        else:
            try:
                options = _osrm_routes(start, end, waypoints, profile, alternatives)
                provider_used = "osrm"
            except external.ExternalServiceError as exc:
                if provider == "osrm":
                    raise
                notes.append(f"OSRM unavailable ({exc}); using the offline network.")
    if not options:
        options, more = _local_routes(features, zones, start, end, waypoints, profile)
        notes += more
        if not alternatives:
            options = options[:1]

    species = species_lookup(db)
    for r in options:
        _annotate(r, zones, species)

    if provider_used == "osrm" and avoid_active_buffers and options and all(not r["wildlife"]["wildlife_friendly"] for r in options):
        local, _ = _local_routes(features, zones, start, end, waypoints, profile)
        friendly = [r for r in local if r["id"] == "local-wildlife"]
        for r in friendly:
            _annotate(r, zones, species)
            options.append(r)
            notes.append("All OSRM routes cross an active wildlife buffer, so a wildlife-friendly offline alternative was added.")

    deduped: list[dict[str, Any]] = []
    for r in options:
        if not any(_same(r, d) for d in deduped):
            deduped.append(r)
    key = (lambda r: (r["wildlife"]["disturbance_score"], r["duration_s"])) if avoid_active_buffers else (lambda r: (r["duration_s"],))
    recommended = min(deduped, key=key)["id"] if deduped else None
    return {
        "routes": deduped,
        "recommended_route_id": recommended,
        "provider_used": provider_used,
        "active_buffers_considered": len(zones),
        "date": day.isoformat(),
        "notes": notes,
    }
