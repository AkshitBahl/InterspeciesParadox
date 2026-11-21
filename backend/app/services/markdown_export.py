"""Export a map area as Markdown for an LLM (plus a structured JSON summary).

Why not a screenshot? An LLM reads facts much better than pixels. So we turn
the real geometry into plain statements: "the main entrance is 4.0 m from the
house martin nest, inside its 6 m seasonal buffer (active now)".

Steps:
1. Decide the area: a bbox, a drawn polygon, or the area around a conflict.
2. Collect features in that area for the chosen scenario (current or proposed),
   plus any unsaved features the user just drew (`extra_features`).
3. Measure the important relationships (wildlife site <-> doors and routes,
   routes <-> buffers and corridors).
4. Write Markdown sections + a JSON summary with the same facts.
"""

import uuid
from datetime import date
from typing import Any

from shapely.geometry import shape
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import Agreement, Conflict, MapFeature, Solution, Species
from app.services import geo
from app.services.map_service import (
    current_scenario_features,
    is_active_on,
    proposed_scenario_features,
    species_lookup,
)
from app.services.representative import format_months
from app.services.solution_engine import latest_assessment

CONFLICT_AREA_RADIUS_M = 90.0


class ExportError(ValueError):
    pass


def _item(f: MapFeature, species: dict[uuid.UUID, Species], role: str = "current") -> dict[str, Any]:
    sp = species.get(f.species_id)
    return {
        "id": str(f.id),
        "layer": f.layer,
        "name": f.name,
        "description": f.description,
        "geometry": f.geometry,
        "properties": f.properties or {},
        "species": sp,
        "active_months": f.active_months,
        "status": f.status,
        "role": role,
        "parent_id": str(f.parent_id) if f.parent_id else None,
    }


def _extra_items(extra: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not extra:
        return []
    feats = extra.get("features", []) if extra.get("type") == "FeatureCollection" else [extra]
    out = []
    for i, f in enumerate(feats):
        props = f.get("properties") or {}
        geom = geo.validate_geometry(f.get("geometry"))
        out.append({
            "id": f"drawn-{i + 1}",
            "layer": props.get("layer", "drawn"),
            "name": props.get("name", f"User-drawn feature {i + 1}"),
            "description": props.get("description"),
            "geometry": geom,
            "properties": props,
            "species": None,
            "active_months": props.get("active_months"),
            "status": "drawn",
            "role": "drawn",
            "parent_id": None,
        })
    return out


def _fmt_coord(geometry: dict[str, Any]) -> str:
    lon, lat = geo.centroid(geometry)
    return f"[{lon:.5f}, {lat:.5f}]"


def _area(db: Session, bbox: list[float] | None, polygon: dict[str, Any] | None, conflict: Conflict | None, features: list[MapFeature]) -> tuple[dict[str, Any], str]:
    if polygon:
        return geo.validate_geometry(polygon), "user-drawn polygon"
    if bbox:
        if len(bbox) != 4 or bbox[0] >= bbox[2] or bbox[1] >= bbox[3]:
            raise ExportError("bbox must be [min_lon, min_lat, max_lon, max_lat]")
        return geo.bbox_polygon(*bbox), "bounding box"
    if conflict:
        return geo.circle(conflict.lon, conflict.lat, CONFLICT_AREA_RADIUS_M), f"{CONFLICT_AREA_RADIUS_M:.0f} m around the conflict"
    minx = min(f.min_lon for f in features)
    miny = min(f.min_lat for f in features)
    maxx = max(f.max_lon for f in features)
    maxy = max(f.max_lat for f in features)
    return geo.bbox_polygon(minx, miny, maxx, maxy), "whole dataset"


def export_area(
    db: Session,
    *,
    bbox: list[float] | None = None,
    polygon: dict[str, Any] | None = None,
    conflict_id: uuid.UUID | None = None,
    solution_id: uuid.UUID | None = None,
    scenario: str = "current",
    extra_features: dict[str, Any] | None = None,
    question: str | None = None,
    include_geojson: bool = False,
    title: str | None = None,
) -> dict[str, Any]:
    today = clock.today()
    species = species_lookup(db)
    conflict = db.get(Conflict, conflict_id) if conflict_id else None
    if conflict_id and conflict is None:
        raise ExportError("Conflict not found")
    solution = db.get(Solution, solution_id) if solution_id else None
    if solution_id and solution is None:
        raise ExportError("Solution not found")
    if solution and conflict is None:
        conflict = db.get(Conflict, solution.conflict_id)

    roles: dict[uuid.UUID, str] = {}
    replaced: list[MapFeature] = []
    if scenario == "proposed":
        if solution is None:
            raise ExportError("A proposed scenario needs a solution_id")
        feats, added, replaced = proposed_scenario_features(db, solution, today)
        roles = {f.id: "proposed" for f in added}
    else:
        feats = current_scenario_features(db, today)

    area, area_kind = _area(db, bbox, polygon, conflict, feats)
    area_shape = shape(area)
    inside = [f for f in feats if shape(f.geometry).intersects(area_shape)]
    items = [_item(f, species, roles.get(f.id, "current")) for f in inside] + _extra_items(extra_features)
    by_layer: dict[str, list[dict[str, Any]]] = {}
    for it in items:
        by_layer.setdefault(it["layer"], []).append(it)

    proj = geo.projection_near(area)
    lon_c, lat_c = geo.centroid(area)
    title = title or (f"Area brief: {conflict.title}" if conflict else "Area brief: Ixelles Ponds Eco-District")

    md: list[str] = [
        f"# {title}",
        "",
        f"_Generated for {today:%d %B %Y} (simulation date). Coordinates are WGS84 [longitude, latitude]; distances in metres._",
        "",
        "## Area",
        f"- Selection: {area_kind}",
        f"- Centre: [{lon_c:.5f}, {lat_c:.5f}]",
        f"- Size: about {geo.area_m2(area, proj):,.0f} m²",
        f"- Scenario: **{scenario}**" + (f" (solution: {solution.title}, Coexistence Index {solution.coexistence_index:.0f})" if solution and scenario == "proposed" else ""),
        "",
        "## What is here",
    ]
    for layer, rows in sorted(by_layer.items()):
        md.append(f"- {len(rows)} × {layer.replace('_', ' ')}")

    # Wildlife sites and their relationships ------------------------------------------------
    sites = by_layer.get("wildlife_site", [])
    entrances = by_layer.get("entrance", [])
    journeys = [r for layer in ("human_route", "delivery_route") for r in by_layer.get(layer, []) if r["properties"].get("kind") != "street"]
    buffers = by_layer.get("ecological_buffer", []) + by_layer.get("agreed_zone", [])
    corridors = by_layer.get("wildlife_corridor", [])
    relationships: list[dict[str, Any]] = []
    site_rows = []
    if sites:
        md += ["", "## Wildlife homes", "| Name | Species | Protected | Sensitive season | Active today | Preferred / minimum distance | Location |", "|---|---|---|---|---|---|---|"]
    for s in sites:
        sp: Species | None = s["species"]
        active = bool(sp and today.month in sp.sensitive_months)
        md.append(
            f"| {s['name']} | {sp.common_name if sp else '?'} | {'yes' if sp and sp.is_legally_protected else 'no'} | "
            f"{format_months(sp.sensitive_months) if sp else '?'} | {'**yes**' if active else 'no'} | "
            f"{f'{sp.preferred_buffer_m:g} m / {sp.min_buffer_m:g} m' if sp else '?'} | {_fmt_coord(s['geometry'])} |"
        )
        site_rows.append({"id": s["id"], "name": s["name"], "species": sp.slug if sp else None, "sensitive_now": active})
        if not sp:
            continue
        for target in entrances + journeys + [r for r in items if r["role"] == "drawn"]:
            d = geo.distance_m(s["geometry"], target["geometry"], proj)
            if d > max(sp.preferred_buffer_m * 4, 40):
                continue
            inside_pref = d < sp.preferred_buffer_m
            inside_min = d < sp.min_buffer_m
            relationships.append({
                "from": s["name"], "to": target["name"], "to_layer": target["layer"], "distance_m": round(d, 1),
                "inside_preferred_buffer": inside_pref, "inside_minimum_buffer": inside_min, "season_active": active,
            })

    if relationships:
        md += ["", "## Spatial relationships"]
        for r in sorted(relationships, key=lambda r: r["distance_m"]):
            flag = (" (**inside the minimum distance**)" if r["inside_minimum_buffer"] else " (inside the preferred buffer)" if r["inside_preferred_buffer"] else "")
            season = " Sensitive season is active today." if r["season_active"] and r["inside_preferred_buffer"] else ""
            md.append(f"- {r['to']} ({r['to_layer'].replace('_', ' ')}) is {r['distance_m']:.1f} m from {r['from']}{flag}.{season}")

    # Routes ----------------------------------------------------------------------------
    route_rows = []
    if journeys:
        md += ["", "## Routes", "| Name | Type | Length | Hours | Crosses active buffers | Crosses ground or dark-sky corridors |", "|---|---|---|---|---|---|"]
    for r in journeys:
        length = geo.length_m(r["geometry"], proj)
        crossing_buffers = [
            b["name"] for b in buffers
            if is_active_on_item(b, today) and geo.length_inside(r["geometry"], b["geometry"], proj) > 0.5
        ]
        # Flight paths pass overhead; only ground corridors (and dark bat routes) are real crossings.
        crossing_corridors = [
            c["name"] for c in corridors
            if (c["species"] is None or c["species"].movement_mode == "ground" or c["properties"].get("needs_darkness"))
            and geo.intersects(r["geometry"], c["geometry"])
        ]
        hours = r["properties"].get("operating_hours") or ", ".join(r["properties"].get("daily_hours", [])) or "-"
        md.append(f"| {r['name']}{' *(proposed)*' if r['role'] == 'proposed' else ''} | {r['layer'].replace('_', ' ')} | {length:.0f} m | {hours} | {', '.join(crossing_buffers) or '-'} | {', '.join(crossing_corridors) or '-'} |")
        route_rows.append({"id": r["id"], "name": r["name"], "layer": r["layer"], "length_m": round(length, 1), "crosses_buffers": crossing_buffers, "crosses_corridors": crossing_corridors, "role": r["role"]})

    # Zones -----------------------------------------------------------------------------
    zone_layers = ("habitat_zone", "ecological_buffer", "agreed_zone")
    zones = [z for layer in zone_layers for z in by_layer.get(layer, [])]
    if zones:
        md += ["", "## Habitat zones and buffers"]
        for z in zones:
            months = f", active {format_months(z['active_months'])}" if z.get("active_months") else ""
            now = " (active today)" if is_active_on_item(z, today) and z.get("active_months") else ""
            md.append(f"- **{z['name']}** ({z['layer'].replace('_', ' ')}{months}){now}: about {geo.area_m2(z['geometry'], proj):,.0f} m²." + (f" {z['description']}" if z.get("description") else ""))

    # Buildings & people ---------------------------------------------------------------------
    if by_layer.get("building"):
        md += ["", "## Buildings"]
        for b in by_layer["building"]:
            props = b["properties"]
            doors = [e["name"] + (" (step-free)" if e["properties"].get("step_free", True) else f" ({e['properties'].get('access_note', 'has steps')})") for e in entrances if e["parent_id"] == b["id"]]
            md.append(f"- **{b['name']}**: {props.get('use', 'building')}, {props.get('height_m', '?')} m tall." + (f" Entrances: {'; '.join(doors)}." if doors else ""))
    for layer, heading in (("resident", "People on the map"), ("wildlife", "Animals on the map"), ("point_of_interest", "Points of interest")):
        if by_layer.get(layer):
            md += ["", f"## {heading}"] + [f"- {p['name']} at {_fmt_coord(p['geometry'])}" for p in by_layer[layer]]

    # Interventions -----------------------------------------------------------------------
    interventions = by_layer.get("intervention", []) + by_layer.get("barrier", [])
    if interventions:
        md += ["", "## Interventions" + (" (proposed)" if scenario == "proposed" else "")]
        for i in interventions:
            md.append(f"- {i['name']} ({i['layer']}) at {_fmt_coord(i['geometry'])}{' *(proposed)*' if i['role'] == 'proposed' else ''}")
    if replaced:
        md += ["", "## Replaced in this proposal"] + [f"- {f.name} ({f.layer.replace('_', ' ')})" for f in replaced]

    drawn = [r for r in items if r["role"] == "drawn"]
    if drawn:
        md += ["", "## Marked by the user (not saved)"] + [f"- {d['name']} ({d['layer']}) at {_fmt_coord(d['geometry'])}" for d in drawn]

    # Conflicts ---------------------------------------------------------------------------
    conflicts = _conflicts_in_area(db, area_shape) if not conflict else [conflict]
    conflict_rows = []
    if conflicts:
        md += ["", "## Conflicts"]
    for c in conflicts:
        sp = species.get(c.species_id)
        md += ["", f"### {c.title}", f"- Status: {c.status}; species: {sp.common_name if sp else '?'}; severity {c.severity}/5", f"- Human activity: {c.human_activity.get('type', 'other')}" + (f" ({c.human_activity.get('description')})" if c.human_activity.get("description") else "")]
        a = latest_assessment(db, c.id)
        if a:
            md.append(f"- Assessment: {a.summary}")
            for p in a.conflicting_needs[:4]:
                md.append(f"  - Clash ({p['severity']:.2f}): {p['explanation']}")
            for p in a.compatible_needs[:3]:
                md.append(f"  - Common ground: {p['explanation']}")
        best = db.scalars(select(Solution).where(Solution.conflict_id == c.id).order_by(Solution.coexistence_index.desc())).first()
        if best:
            md.append(f"- Best solution so far: {best.title} (index {best.coexistence_index:.0f}, status {best.status})")
        ag = db.scalars(select(Agreement).where(Agreement.conflict_id == c.id).order_by(Agreement.created_at.desc())).first()
        if ag:
            md.append(f"- Agreement: {ag.status}, valid {ag.valid_from} to {ag.valid_until}")
        conflict_rows.append({"id": str(c.id), "title": c.title, "status": c.status, "species": sp.slug if sp else None, "best_index": best.coexistence_index if best else None})

    md += ["", "## Notes for the reader", "- Biological values come from a structured species dataset (demo values; verify with a local ecologist).", "- Species representatives are fictional characters; their facts come from that dataset."]
    if question:
        md += ["", "## Task", question, "", "Answer using only the facts above. If something is missing, say so."]

    summary = {
        "title": title,
        "date": today.isoformat(),
        "scenario": scenario,
        "area": {"kind": area_kind, "geometry": area, "area_m2": round(geo.area_m2(area, proj), 1), "centre": [round(lon_c, 6), round(lat_c, 6)]},
        "counts": {k: len(v) for k, v in by_layer.items()},
        "wildlife_sites": site_rows,
        "relationships": relationships,
        "routes": route_rows,
        "conflicts": conflict_rows,
    }
    geojson = None
    if include_geojson:
        geojson = {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "id": it["id"], "geometry": it["geometry"], "properties": {"name": it["name"], "layer": it["layer"], "role": it["role"]}}
                for it in items
            ],
        }
    return {"title": title, "markdown": "\n".join(md) + "\n", "summary": summary, "geojson": geojson}


def is_active_on_item(item: dict[str, Any], day: date) -> bool:
    months = item.get("active_months")
    return not months or day.month in months


def _conflicts_in_area(db: Session, area_shape: Any) -> list[Conflict]:
    from shapely.geometry import Point

    return [c for c in db.scalars(select(Conflict).order_by(Conflict.created_at)) if area_shape.contains(Point(c.lon, c.lat))]


__all__ = ["ExportError", "export_area", "is_active_on"]
