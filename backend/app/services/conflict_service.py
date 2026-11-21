"""Step 2: reporting a conflict (and linking it to the map)."""

import uuid
from typing import Any

from shapely.geometry import Point
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Conflict,
    ConflictStatus,
    FeatureStatus,
    MapFeature,
    Species,
    User,
)
from app.services import geo
from app.services.map_service import new_feature

SITE_SEARCH_RADIUS_M = 60.0


class ConflictError(ValueError):
    pass


def resolve_species(db: Session, species_slug: str | None, species_id: uuid.UUID | None) -> Species:
    species = None
    if species_id:
        species = db.get(Species, species_id)
    elif species_slug:
        species = db.scalars(select(Species).where(Species.slug == species_slug)).first()
    if species is None:
        raise ConflictError("Unknown species. Use GET /species to see the options.")
    return species


def create_wildlife_site(
    db: Session, species: Species, lon: float, lat: float, *, name: str | None = None,
    user: User | None = None, properties: dict[str, Any] | None = None,
) -> MapFeature:
    """Add a new nest/roost/den to the map, with its seasonal ecological buffer."""
    site = new_feature(
        "wildlife_site",
        name or f"{species.common_name} site (reported)",
        geo.point(lon, lat),
        properties={"site_type": "nest", **(properties or {}), "reported": True},
        species_id=species.id,
        created_by_id=user.id if user else None,
    )
    db.add(site)
    db.flush()
    db.add(buffer_for_site(species, site, user))
    return site


def buffer_for_site(species: Species, site: MapFeature, user: User | None = None, is_seed: bool = False) -> MapFeature:
    lon, lat = geo.centroid(site.geometry)
    return new_feature(
        "ecological_buffer",
        f"Recommended buffer: {species.common_name} ({species.preferred_buffer_m:g} m)",
        geo.circle(lon, lat, species.preferred_buffer_m),
        properties={
            "kind": "recommended_buffer",
            "radius_m": species.preferred_buffer_m,
            "min_radius_m": species.min_buffer_m,
            "site_id": str(site.id),
        },
        active_months=list(species.sensitive_months),
        species_id=species.id,
        parent_id=site.id,
        created_by_id=user.id if user else None,
        is_seed=is_seed,
    )


def _nearest(db: Session, layer: str, lon: float, lat: float, radius: float, species_id: uuid.UUID | None = None) -> MapFeature | None:
    proj = geo.LocalProjection(lon, lat)
    here = Point(0, 0)
    query = select(MapFeature).where(MapFeature.layer == layer, MapFeature.status == FeatureStatus.EXISTING)
    if species_id:
        query = query.where(MapFeature.species_id == species_id)
    best, best_d = None, radius
    for f in db.scalars(query):
        d = proj.geom_to_xy(f.geometry).distance(here)
        if d <= best_d:
            best, best_d = f, d
    return best


def create_conflict(db: Session, reporter: User, data: dict[str, Any]) -> Conflict:
    species = resolve_species(db, data.get("species_slug"), data.get("species_id"))

    site = None
    if data.get("site_feature_id"):
        site = db.get(MapFeature, data["site_feature_id"])
        if site is None or site.layer != "wildlife_site":
            raise ConflictError("site_feature_id must be a wildlife_site feature")
    location = data.get("location")
    if location:
        geo.validate_geometry(location)
        lon, lat = geo.centroid(location)
    elif site:
        lon, lat = geo.centroid(site.geometry)
    else:
        raise ConflictError("Give a location (GeoJSON Point) or a site_feature_id")

    if site is None:
        site = _nearest(db, "wildlife_site", lon, lat, SITE_SEARCH_RADIUS_M, species.id)
    if site is None:
        site = create_wildlife_site(db, species, lon, lat, user=reporter)

    building = None
    if data.get("building_feature_id"):
        building = db.get(MapFeature, data["building_feature_id"])
    if building is None:
        building = _nearest(db, "building", lon, lat, 30.0)

    conflict = Conflict(
        id=uuid.uuid4(),
        reporter_id=reporter.id,
        species_id=species.id,
        site_feature_id=site.id,
        building_feature_id=building.id if building else None,
        title=data["title"],
        description=data.get("description") or "",
        category=data.get("category") or "other",
        severity=int(data.get("severity") or 3),
        lon=lon,
        lat=lat,
        human_activity=_jsonable(data.get("human_activity") or {"type": "other"}),
        observed_on=data.get("observed_on"),
        status=ConflictStatus.REPORTED,
    )
    db.add(conflict)
    db.flush()
    hotspot = new_feature(
        "conflict_hotspot",
        data["title"],
        geo.point(lon, lat),
        properties={"severity": conflict.severity, "category": conflict.category, "emoji": "🟠"},
        species_id=species.id,
        conflict_id=conflict.id,
        created_by_id=reporter.id,
    )
    db.add(hotspot)
    db.flush()
    conflict.hotspot_feature_id = hotspot.id
    db.flush()
    return conflict


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value
