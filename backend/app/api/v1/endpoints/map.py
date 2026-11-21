"""The map API for the MapLibre frontend.

Typical frontend flow:
1. GET /map/config                -> centre, zoom, basemap style, layer styles
2. GET /map/features              -> one GeoJSON FeatureCollection with every layer
3. GET /map/scenarios/{id}/compare -> toggle "Current situation" / "Proposed solution"
4. GET /map/animations?solution_id -> moving birds, residents and delivery robots
5. POST /map/export/markdown      -> LLM-readable brief of a selected area
"""

import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, get_or_404
from app.core import clock
from app.core.config import settings
from app.models import FeatureStatus, MapFeature, Solution, Species
from app.schemas.map import (
    AnimationsResponse,
    ExportRequest,
    ExportResponse,
    FeatureCreate,
    FeatureUpdate,
    LayerInfo,
    MapConfig,
    ScenarioComparison,
)
from app.seed.brussels_dataset import NEIGHBOURHOOD
from app.services import animations, geo, markdown_export
from app.services.conflict_service import buffer_for_site
from app.services.layers import (
    LAYER_KEYS,
    LAYERS,
    PALETTE,
    USER_EDITABLE_LAYERS,
    maplibre_layers,
)
from app.services.map_service import (
    current_scenario_features,
    feature_collection,
    feature_to_geojson,
    filter_features,
    new_feature,
    proposed_scenario_features,
    set_bbox,
    species_lookup,
)

router = APIRouter(prefix="/map", tags=["map"])

BASEMAPS = {
    "liberty": "https://tiles.openfreemap.org/styles/liberty",
    "bright": "https://tiles.openfreemap.org/styles/bright",
    "positron": "https://tiles.openfreemap.org/styles/positron",
}


def _parse_bbox(bbox: str | None) -> tuple[float, float, float, float] | None:
    if not bbox:
        return None
    try:
        parts = tuple(float(x) for x in bbox.split(","))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="bbox must be 'min_lon,min_lat,max_lon,max_lat'") from exc
    if len(parts) != 4 or parts[0] >= parts[2] or parts[1] >= parts[3]:
        raise HTTPException(status_code=422, detail="bbox must be 'min_lon,min_lat,max_lon,max_lat'")
    return parts  # type: ignore[return-value]


def _layers(layers: str | None) -> set[str] | None:
    if not layers:
        return None
    keys = {k.strip() for k in layers.split(",") if k.strip()}
    unknown = keys - LAYER_KEYS
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown layers {sorted(unknown)}. Known: {sorted(LAYER_KEYS)}")
    return keys


@router.get("/config", response_model=MapConfig)
def map_config(db: DbSession) -> MapConfig:
    """Everything the frontend needs to set up MapLibre GL JS."""
    features = current_scenario_features(db)
    counts: dict[str, int] = {}
    for f in features:
        counts[f.layer] = counts.get(f.layer, 0) + 1
    if features:
        bounds = [min(f.min_lon for f in features), min(f.min_lat for f in features), max(f.max_lon for f in features), max(f.max_lat for f in features)]
    else:
        c = (settings.map_center_lon, settings.map_center_lat)
        bounds = [c[0] - 0.005, c[1] - 0.004, c[0] + 0.005, c[1] + 0.004]
    prefix = settings.api_v1_prefix
    return MapConfig(
        neighbourhood=NEIGHBOURHOOD,
        today=clock.today().isoformat(),
        center=[settings.map_center_lon, settings.map_center_lat],
        zoom=settings.map_default_zoom,
        pitch=settings.map_pitch,
        bearing=settings.map_bearing,
        bounds=[round(b, 6) for b in bounds],
        basemap_style_url=settings.basemap_style_url,
        alternative_basemaps=BASEMAPS,
        attribution="© OpenStreetMap contributors · OpenFreeMap · Dummy 2126 dataset",
        sources={
            "features": f"{prefix}/map/features",
            "scenario": f"{prefix}/map/scenarios/{{solution_id}}",
            "compare": f"{prefix}/map/scenarios/{{solution_id}}/compare",
            "animations": f"{prefix}/map/animations",
            "export_markdown": f"{prefix}/map/export/markdown",
            "route": f"{prefix}/geo/route",
            "search": f"{prefix}/geo/search",
        },
        layers=[LayerInfo(**layer, feature_count=counts.get(layer["key"], 0)) for layer in LAYERS],
        maplibre_layers=maplibre_layers("paradox"),
        palette=PALETTE,
    )


@router.get("/layers", response_model=list[LayerInfo])
def list_layers(db: DbSession) -> list[LayerInfo]:
    counts: dict[str, int] = {}
    for f in current_scenario_features(db):
        counts[f.layer] = counts.get(f.layer, 0) + 1
    return [LayerInfo(**layer, feature_count=counts.get(layer["key"], 0)) for layer in LAYERS]


@router.get("/features")
def get_features(
    db: DbSession,
    layers: str | None = Query(None, description="Comma-separated layer keys, e.g. 'building,wildlife_site'"),
    bbox: str | None = Query(None, description="min_lon,min_lat,max_lon,max_lat"),
    species: str | None = Query(None, description="species slug"),
    conflict_id: uuid.UUID | None = None,
    active_on: date | None = Query(None, description="Only features active on this date (seasonal buffers)"),
    scenario: Literal["current", "proposed"] = "current",
    solution_id: uuid.UUID | None = Query(None, description="Required for the proposed scenario"),
) -> dict:
    """GeoJSON FeatureCollection for MapLibre. Every feature has `properties.layer`."""
    roles: dict[uuid.UUID, str] = {}
    if scenario == "proposed":
        if solution_id is None:
            raise HTTPException(status_code=422, detail="solution_id is required for the proposed scenario")
        solution = get_or_404(db, Solution, solution_id, "Solution")
        feats, added, _ = proposed_scenario_features(db, solution)
        roles = {f.id: "proposed" for f in added}
    else:
        feats = current_scenario_features(db)
    species_id = None
    if species:
        sp = db.scalars(select(Species).where(Species.slug == species)).first()
        if sp is None:
            raise HTTPException(status_code=404, detail="Species not found")
        species_id = sp.id
    feats = filter_features(feats, layers=_layers(layers), bbox=_parse_bbox(bbox), species_id=species_id, conflict_id=conflict_id, active_on=active_on)
    return feature_collection(db, feats, roles=roles, metadata={"scenario": scenario, "solution_id": str(solution_id) if solution_id else None, "count": len(feats), "date": clock.today().isoformat()})


@router.get("/locations")
def dataset_locations(db: DbSession) -> list[dict]:
    """Named places in the dummy dataset where you can drop new humans or animals
    (pass one as `location_feature_id` to POST /map/features)."""
    out = []
    for f in current_scenario_features(db):
        if f.layer in ("building", "entrance", "point_of_interest", "habitat_zone", "wildlife_site") and f.is_seed:
            lon, lat = geo.centroid(f.geometry)
            out.append({"feature_id": str(f.id), "name": f.name, "layer": f.layer, "lon": round(lon, 7), "lat": round(lat, 7)})
    return sorted(out, key=lambda x: (x["layer"], x["name"]))


@router.get("/features/{feature_id}")
def get_feature(feature_id: uuid.UUID, db: DbSession) -> dict:
    feature = get_or_404(db, MapFeature, feature_id, "Map feature")
    return feature_to_geojson(feature, species=species_lookup(db))


@router.post("/features", status_code=status.HTTP_201_CREATED)
def create_feature(body: FeatureCreate, user: CurrentUser, db: DbSession) -> dict:
    """Add your own interactive element: a resident, an animal, a nest, a path, a habitat...

    Adding a `wildlife_site` (with a species) also adds its seasonal ecological buffer.
    """
    if body.layer not in USER_EDITABLE_LAYERS:
        raise HTTPException(status_code=422, detail=f"Layer '{body.layer}' is managed by the system. You can add: {sorted(USER_EDITABLE_LAYERS)}")
    geometry = body.geometry
    if geometry is None:
        anchor = get_or_404(db, MapFeature, body.location_feature_id, "Location feature")
        geometry = geo.point(*geo.centroid(anchor.geometry))
    species = None
    if body.species_slug:
        species = db.scalars(select(Species).where(Species.slug == body.species_slug)).first()
        if species is None:
            raise HTTPException(status_code=404, detail="Species not found")
    if body.layer == "wildlife_site" and species is None:
        raise HTTPException(status_code=422, detail="A wildlife_site needs a species_slug")
    feature = new_feature(
        body.layer, body.name, geometry, properties=body.properties, description=body.description,
        active_months=body.active_months, species_id=species.id if species else None,
        parent_id=body.parent_id, created_by_id=user.id,
    )
    db.add(feature)
    db.flush()
    if body.layer == "wildlife_site" and species:
        db.add(buffer_for_site(species, feature, user))
    db.commit()
    return feature_to_geojson(feature, species=species_lookup(db))


def _editable(feature: MapFeature, user) -> None:
    if feature.is_seed and not user.is_admin:
        raise HTTPException(status_code=403, detail="Dataset features can only be changed by an admin")
    if feature.status != FeatureStatus.EXISTING:
        raise HTTPException(status_code=409, detail="Features from solutions and agreements are managed by the mediation engine")
    if not feature.is_seed and feature.created_by_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="You can only change features you created")


@router.patch("/features/{feature_id}")
def update_feature(feature_id: uuid.UUID, body: FeatureUpdate, user: CurrentUser, db: DbSession) -> dict:
    """Move or edit a feature you created (e.g. drag a resident marker)."""
    feature = get_or_404(db, MapFeature, feature_id, "Map feature")
    _editable(feature, user)
    data = body.model_dump(exclude_unset=True)
    if "properties" in data and data["properties"] is not None:
        data["properties"] = {**(feature.properties or {}), **data["properties"]}
    for key, value in data.items():
        setattr(feature, key, value)
    if "geometry" in data:
        set_bbox(feature)
    db.commit()
    return feature_to_geojson(feature, species=species_lookup(db))


@router.delete("/features/{feature_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feature(feature_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    feature = get_or_404(db, MapFeature, feature_id, "Map feature")
    _editable(feature, user)
    for child in db.scalars(select(MapFeature).where(MapFeature.parent_id == feature.id, MapFeature.layer == "ecological_buffer")):
        db.delete(child)
    db.delete(feature)
    db.commit()


@router.get("/scenarios/{solution_id}")
def proposed_scenario(solution_id: uuid.UUID, db: DbSession) -> dict:
    """The map as it would look with this solution. New features have `scenario_role: "proposed"`."""
    solution = get_or_404(db, Solution, solution_id, "Solution")
    feats, added, replaced = proposed_scenario_features(db, solution)
    return feature_collection(
        db, feats, roles={f.id: "proposed" for f in added},
        metadata={"scenario": "proposed", "solution_id": str(solution.id), "solution_title": solution.title,
                  "coexistence_index": solution.coexistence_index, "replaced_feature_ids": [str(f.id) for f in replaced]},
    )


@router.get("/scenarios/{solution_id}/compare", response_model=ScenarioComparison)
def compare_scenarios(
    solution_id: uuid.UUID, db: DbSession, conflict_area_only: bool = Query(True, description="Only features near the conflict")
) -> ScenarioComparison:
    """Both scenarios in one call, for a 'Current situation / Proposed solution' toggle.

    In `current`, features that the proposal replaces are marked `scenario_role: "replaced"`
    (so you can fade them out); in `proposed`, new ones are marked `"proposed"`.
    """
    solution = get_or_404(db, Solution, solution_id, "Solution")
    current = current_scenario_features(db)
    proposed, added, replaced = proposed_scenario_features(db, solution)
    if conflict_area_only:
        from app.models import Conflict

        conflict = db.get(Conflict, solution.conflict_id)
        area = geo.circle(conflict.lon, conflict.lat, 200)
        box = geo.bbox(area)
        current = filter_features(current, bbox=box)
        proposed = filter_features(proposed, bbox=box)
    return ScenarioComparison(
        solution_id=solution.id,
        solution_title=solution.title,
        coexistence_index=solution.coexistence_index,
        current=feature_collection(db, current, roles={f.id: "replaced" for f in replaced}),
        proposed=feature_collection(db, proposed, roles={f.id: "proposed" for f in added}),
        added=[str(f.id) for f in added],
        replaced=[str(f.id) for f in replaced],
    )


@router.get("/animations", response_model=AnimationsResponse)
def get_animations(
    db: DbSession,
    solution_id: uuid.UUID | None = Query(None, description="Animate the proposed scenario of this solution"),
    include_streets: bool = False,
) -> AnimationsResponse:
    """Moving objects: wildlife along corridors, residents on journeys, delivery bikes/robots."""
    species = species_lookup(db)
    if solution_id:
        solution = get_or_404(db, Solution, solution_id, "Solution")
        feats, added, _ = proposed_scenario_features(db, solution)
        tracks = animations.build_tracks(feats, species, roles={f.id: "proposed" for f in added}, include_streets=include_streets)
        scenario = "proposed"
    else:
        tracks = animations.build_tracks(current_scenario_features(db), species, include_streets=include_streets)
        scenario = "current"
    return AnimationsResponse(
        scenario=scenario, solution_id=solution_id, tracks=tracks,
        note="Speeds are accelerated for the demo. Animate with turf.along() on `coordinates`, or step through `keyframes`.",
    )


@router.post("/export/markdown", response_model=ExportResponse)
def export_markdown(body: ExportRequest, db: DbSession) -> dict:
    """Turn a map area into an LLM-readable Markdown brief + structured JSON (no screenshots needed)."""
    return markdown_export.export_area(db, **body.model_dump())


@router.get("/export/markdown", response_class=PlainTextResponse)
def export_markdown_text(
    db: DbSession,
    bbox: str | None = None,
    conflict_id: uuid.UUID | None = None,
    solution_id: uuid.UUID | None = None,
    scenario: Literal["current", "proposed"] = "current",
) -> PlainTextResponse:
    """Same as the POST version but returns raw Markdown (easy to download or paste)."""
    box = _parse_bbox(bbox)
    result = markdown_export.export_area(db, bbox=list(box) if box else None, conflict_id=conflict_id, solution_id=solution_id, scenario=scenario)
    return PlainTextResponse(result["markdown"], media_type="text/markdown; charset=utf-8")


@router.get("/export/geojson")
def export_geojson(
    db: DbSession, scenario: Literal["current", "proposed"] = "current", solution_id: uuid.UUID | None = None
) -> dict:
    """The full dataset as a downloadable GeoJSON file."""
    if scenario == "proposed":
        if solution_id is None:
            raise HTTPException(status_code=422, detail="solution_id is required for the proposed scenario")
        feats, added, _ = proposed_scenario_features(db, get_or_404(db, Solution, solution_id, "Solution"))
        return feature_collection(db, feats, roles={f.id: "proposed" for f in added})
    return feature_collection(db, current_scenario_features(db), metadata={"neighbourhood": NEIGHBOURHOOD})
