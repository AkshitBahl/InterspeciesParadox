"""Map features and scenarios.

Scenario rules (simple version):
* CURRENT situation  = existing features
                       + features of *active* agreements
                       - features those agreements replace (e.g. an old route)
* PROPOSED situation = current situation
                       + the features of one solution
                       - the features that solution replaces
"""

import uuid
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import (
    Agreement,
    AgreementStatus,
    FeatureStatus,
    MapFeature,
    Solution,
    Species,
)
from app.services import geo
from app.services.layers import LAYERS, simplestyle


def set_bbox(feature: MapFeature) -> None:
    feature.min_lon, feature.min_lat, feature.max_lon, feature.max_lat = geo.bbox(feature.geometry)


def new_feature(
    layer: str,
    name: str,
    geometry: dict[str, Any],
    *,
    properties: dict[str, Any] | None = None,
    status: str = FeatureStatus.EXISTING,
    description: str | None = None,
    active_months: list[int] | None = None,
    species_id: uuid.UUID | None = None,
    parent_id: uuid.UUID | None = None,
    replaces_feature_id: uuid.UUID | None = None,
    conflict_id: uuid.UUID | None = None,
    solution_id: uuid.UUID | None = None,
    agreement_id: uuid.UUID | None = None,
    created_by_id: uuid.UUID | None = None,
    is_seed: bool = False,
) -> MapFeature:
    feature = MapFeature(
        id=uuid.uuid4(),
        layer=layer,
        name=name,
        description=description,
        geometry=geo.validate_geometry(geometry),
        properties=properties or {},
        status=status,
        active_months=active_months,
        species_id=species_id,
        parent_id=parent_id,
        replaces_feature_id=replaces_feature_id,
        conflict_id=conflict_id,
        solution_id=solution_id,
        agreement_id=agreement_id,
        created_by_id=created_by_id,
        is_seed=is_seed,
    )
    set_bbox(feature)
    return feature


def active_agreement_ids(db: Session, today: date | None = None) -> set[uuid.UUID]:
    today = today or clock.today()
    rows = db.scalars(
        select(Agreement.id).where(
            Agreement.status == AgreementStatus.ACTIVE,
            Agreement.valid_from <= today,
            Agreement.valid_until >= today,
        )
    )
    return set(rows)


def current_scenario_features(db: Session, today: date | None = None) -> list[MapFeature]:
    active = active_agreement_ids(db, today)
    features = list(db.scalars(select(MapFeature).where(MapFeature.status != FeatureStatus.PROPOSED)))
    agreed = [f for f in features if f.status == FeatureStatus.AGREED and f.agreement_id in active]
    replaced = {f.replaces_feature_id for f in agreed if f.replaces_feature_id}
    existing = [f for f in features if f.status == FeatureStatus.EXISTING and f.id not in replaced]
    return existing + agreed


def solution_features(db: Session, solution_id: uuid.UUID) -> list[MapFeature]:
    return list(db.scalars(select(MapFeature).where(MapFeature.solution_id == solution_id)))


def proposed_scenario_features(
    db: Session, solution: Solution, today: date | None = None
) -> tuple[list[MapFeature], list[MapFeature], list[MapFeature]]:
    """Returns (scenario, added, replaced)."""
    current = current_scenario_features(db, today)
    added = [f for f in solution_features(db, solution.id) if f.id not in {c.id for c in current}]
    replaced_ids = {f.replaces_feature_id for f in added if f.replaces_feature_id}
    replaced = [f for f in current if f.id in replaced_ids]
    scenario = [f for f in current if f.id not in replaced_ids] + added
    return scenario, added, replaced


def species_lookup(db: Session) -> dict[uuid.UUID, Species]:
    return {s.id: s for s in db.scalars(select(Species))}


_LAYER_EMOJI = {layer["key"]: layer["emoji"] for layer in LAYERS}


def is_active_on(feature: MapFeature, day: date) -> bool:
    return not feature.active_months or day.month in feature.active_months


def feature_to_geojson(
    feature: MapFeature,
    *,
    today: date | None = None,
    species: dict[uuid.UUID, Species] | None = None,
    scenario_role: str | None = None,
    with_simplestyle: bool = False,
) -> dict[str, Any]:
    today = today or clock.today()
    sp = species.get(feature.species_id) if species and feature.species_id else None
    props = dict(feature.properties or {})
    props.setdefault("emoji", sp.emoji if sp and feature.layer in ("wildlife_site", "wildlife") else _LAYER_EMOJI.get(feature.layer, "📍"))
    props.update(
        {
            "id": str(feature.id),
            "layer": feature.layer,
            "name": feature.name,
            "description": feature.description,
            "status": feature.status,
            "active_months": feature.active_months,
            "active_now": is_active_on(feature, today),
            "species_id": str(feature.species_id) if feature.species_id else None,
            "species_slug": sp.slug if sp else None,
            "species_name": sp.common_name if sp else None,
            "parent_id": str(feature.parent_id) if feature.parent_id else None,
            "replaces_feature_id": str(feature.replaces_feature_id) if feature.replaces_feature_id else None,
            "conflict_id": str(feature.conflict_id) if feature.conflict_id else None,
            "solution_id": str(feature.solution_id) if feature.solution_id else None,
            "agreement_id": str(feature.agreement_id) if feature.agreement_id else None,
            "created_by_id": str(feature.created_by_id) if feature.created_by_id else None,
            "is_seed": feature.is_seed,
        }
    )
    if scenario_role:
        props["scenario_role"] = scenario_role
    if with_simplestyle:
        props.update(simplestyle(feature.layer, feature.geometry["type"], props))
    return {"type": "Feature", "id": str(feature.id), "geometry": feature.geometry, "properties": props}


def feature_collection(
    db: Session,
    features: list[MapFeature],
    *,
    today: date | None = None,
    roles: dict[uuid.UUID, str] | None = None,
    metadata: dict[str, Any] | None = None,
    with_simplestyle: bool = False,
) -> dict[str, Any]:
    today = today or clock.today()
    species = species_lookup(db)
    order = {layer["key"]: layer["order"] for layer in LAYERS}
    features = sorted(features, key=lambda f: (order.get(f.layer, 99), f.name))
    fc: dict[str, Any] = {
        "type": "FeatureCollection",
        "features": [
            feature_to_geojson(f, today=today, species=species, scenario_role=(roles or {}).get(f.id), with_simplestyle=with_simplestyle)
            for f in features
        ],
    }
    if metadata:
        fc["metadata"] = metadata
    return fc


def filter_features(
    features: list[MapFeature],
    *,
    layers: set[str] | None = None,
    bbox: tuple[float, float, float, float] | None = None,
    species_id: uuid.UUID | None = None,
    conflict_id: uuid.UUID | None = None,
    active_on: date | None = None,
) -> list[MapFeature]:
    out = []
    for f in features:
        if layers and f.layer not in layers:
            continue
        if bbox and (f.max_lon < bbox[0] or f.min_lon > bbox[2] or f.max_lat < bbox[1] or f.min_lat > bbox[3]):
            continue
        if species_id and f.species_id != species_id:
            continue
        if conflict_id and f.conflict_id != conflict_id:
            continue
        if active_on and not is_active_on(f, active_on):
            continue
        out.append(f)
    return out


def active_buffers(features: list[MapFeature], day: date) -> list[MapFeature]:
    return [f for f in features if f.layer in ("ecological_buffer", "agreed_zone") and is_active_on(f, day)]
