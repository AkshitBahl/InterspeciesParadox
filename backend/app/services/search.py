"""Place search: our own dataset first, then (optionally) Nominatim."""

from typing import Any

from shapely.geometry import Point
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services import external, geo
from app.services.map_service import current_scenario_features, species_lookup

NOMINATIM_MIN_INTERVAL_S = 1.0  # usage policy: max 1 request per second


def _viewbox() -> str:
    d = 0.02
    lon, lat = settings.map_center_lon, settings.map_center_lat
    return f"{lon - d},{lat + d},{lon + d},{lat - d}"


def search(db: Session, q: str, limit: int = 10, include_external: bool = True) -> dict[str, Any]:
    q_low = q.strip().lower()
    species = species_lookup(db)
    results: list[dict[str, Any]] = []
    for f in current_scenario_features(db):
        sp = species.get(f.species_id)
        haystack = " ".join(filter(None, [f.name, f.description, sp.common_name if sp else None, sp.scientific_name if sp else None])).lower()
        if q_low and q_low in haystack:
            lon, lat = geo.centroid(f.geometry)
            results.append({
                "name": f.name,
                "display_name": f"{f.name} · {f.layer.replace('_', ' ')}",
                "lon": round(lon, 7),
                "lat": round(lat, 7),
                "source": "local",
                "feature_id": str(f.id),
                "layer": f.layer,
                "type": f.layer,
            })
    results.sort(key=lambda r: (not r["name"].lower().startswith(q_low), r["name"]))
    results = results[:limit]
    notes: list[str] = []
    if include_external and settings.enable_external_geo and len(results) < limit:
        try:
            data = external.get_json(
                f"{settings.nominatim_base_url.rstrip('/')}/search",
                {"q": q, "format": "jsonv2", "limit": limit - len(results), "viewbox": _viewbox(), "bounded": 0},
                min_interval_s=NOMINATIM_MIN_INTERVAL_S,
                service="nominatim",
            )
            for item in data:
                results.append({
                    "name": item.get("name") or item.get("display_name", "").split(",")[0],
                    "display_name": item.get("display_name"),
                    "lon": float(item["lon"]),
                    "lat": float(item["lat"]),
                    "source": "nominatim",
                    "feature_id": None,
                    "layer": None,
                    "type": item.get("type"),
                })
        except external.ExternalServiceError as exc:
            notes.append(f"Nominatim unavailable: {exc}")
    return {"query": q, "results": results, "notes": notes, "attribution": "Search data © OpenStreetMap contributors"}


# When several features are "right here" (e.g. a door inside a building inside a
# buffer), the most specific one wins.
_SPECIFICITY = [
    "entrance", "wildlife_site", "point_of_interest", "resident", "wildlife", "intervention", "conflict_hotspot",
    "building", "human_route", "delivery_route", "wildlife_corridor", "barrier", "habitat_zone", "ecological_buffer", "agreed_zone",
]
HERE_M = 1.0


def reverse(db: Session, lon: float, lat: float) -> dict[str, Any]:
    proj = geo.LocalProjection(lon, lat)
    here = Point(0, 0)
    rank = {layer: i for i, layer in enumerate(_SPECIFICITY)}
    candidates = []
    for f in current_scenario_features(db):
        d = proj.geom_to_xy(f.geometry).distance(here)
        if d <= 40:
            candidates.append((0.0 if d <= HERE_M else d, rank.get(f.layer, len(rank)), f.name, d, f))
    candidates.sort(key=lambda c: c[:3])
    local = None
    if candidates:
        _, _, _, d, f = candidates[0]
        local = {"feature_id": str(f.id), "name": f.name, "layer": f.layer, "distance_m": round(d, 1)}
    also_here = [{"feature_id": str(c[4].id), "name": c[4].name, "layer": c[4].layer} for c in candidates[1:6] if c[0] == 0.0]
    address = None
    notes: list[str] = []
    if settings.enable_external_geo:
        try:
            data = external.get_json(
                f"{settings.nominatim_base_url.rstrip('/')}/reverse",
                {"lat": lat, "lon": lon, "format": "jsonv2"},
                min_interval_s=NOMINATIM_MIN_INTERVAL_S,
                service="nominatim",
            )
            address = data.get("display_name")
        except external.ExternalServiceError as exc:
            notes.append(f"Nominatim unavailable: {exc}")
    return {"lon": lon, "lat": lat, "nearest_feature": local, "also_here": also_here, "address": address, "notes": notes}
