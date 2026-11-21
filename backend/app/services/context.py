"""Everything the mediation engine needs to know about one conflict, in one object.

`build_context` loads the conflict, the species, the reporter's profile and the
map features around the wildlife site, then pre-computes the spatial facts
(distances, routes inside the quiet zone, corridor crossings...).
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from shapely.geometry import Point
from sqlalchemy.orm import Session

from app.core import clock
from app.models import Conflict, HumanProfile, MapFeature, Representative, Species, User
from app.services import geo
from app.services.map_service import current_scenario_features

WORK_ACTIVITIES = {"renovation", "rooftop_maintenance", "garden_works", "event", "construction"}
RECURRING_ACTIVITIES = {"entrance_use", "commute", "deliveries", "space_use"}
ACTIVITY_TYPES = sorted(WORK_ACTIVITIES | RECURRING_ACTIVITIES | {"other"})

CONTEXT_RADIUS_M = 160.0


@dataclass
class NearbyFeature:
    feature: MapFeature
    distance_m: float

    def brief(self, **extra: Any) -> dict[str, Any]:
        return {
            "id": str(self.feature.id),
            "name": self.feature.name,
            "layer": self.feature.layer,
            "distance_m": round(self.distance_m, 1),
            **extra,
        }


@dataclass
class MediationContext:
    conflict: Conflict
    species: Species
    representative: Representative | None
    reporter: User
    profile: HumanProfile | None
    today: date
    site_lonlat: tuple[float, float]
    activity_lonlat: tuple[float, float]
    site_feature: MapFeature | None
    features: list[MapFeature]
    network_features: list[MapFeature]
    proj: geo.LocalProjection
    spatial: dict[str, Any] = field(default_factory=dict)

    # --- convenience -------------------------------------------------------------
    @property
    def activity(self) -> dict[str, Any]:
        return self.conflict.human_activity or {}

    @property
    def activity_type(self) -> str:
        return self.activity.get("type", "other")

    @property
    def is_works(self) -> bool:
        return self.activity_type in WORK_ACTIVITIES

    @property
    def planned_start(self) -> date | None:
        return _as_date(self.activity.get("planned_start"))

    @property
    def planned_end(self) -> date | None:
        end = _as_date(self.activity.get("planned_end"))
        if end is None and self.planned_start is not None:
            return self.planned_start + timedelta(days=max(1, int(self.activity.get("duration_days", 7))) - 1)
        return end

    @property
    def flexibility_weeks(self) -> int:
        return int(self.activity.get("flexibility_weeks") or 0)

    @property
    def budget_eur(self) -> int | None:
        budget = self.activity.get("budget_eur")
        if budget is None and self.profile is not None:
            budget = self.profile.budget_eur
        return int(budget) if budget is not None else None

    @property
    def in_season(self) -> bool:
        return self.today.month in (self.species.sensitive_months or [])

    @property
    def site_point_xy(self) -> Point:
        return Point(self.proj.to_xy(*self.site_lonlat))

    @property
    def activity_point_xy(self) -> Point:
        return Point(self.proj.to_xy(*self.activity_lonlat))

    def xy(self, feature: MapFeature):
        return self.proj.geom_to_xy(feature.geometry)

    def distance_to_site(self, feature: MapFeature) -> float:
        return float(self.xy(feature).distance(self.site_point_xy))

    def layer(self, *layers: str) -> list[NearbyFeature]:
        items = [NearbyFeature(f, self.distance_to_site(f)) for f in self.features if f.layer in layers]
        return sorted(items, key=lambda n: n.distance_m)

    def journeys(self, *layers: str) -> list[NearbyFeature]:
        """Named routes people/vehicles actually travel (not plain street segments)."""
        return [n for n in self.layer(*layers) if (n.feature.properties or {}).get("kind") != "street"]

    def corridors(self) -> list[MapFeature]:
        return [f for f in self.features if f.layer == "wildlife_corridor" and f.species_id == self.species.id]


def _as_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def build_context(db: Session, conflict: Conflict, today: date | None = None) -> MediationContext:
    today = today or clock.today()
    species = db.get(Species, conflict.species_id)
    assert species is not None
    rep = species.representative
    reporter = db.get(User, conflict.reporter_id)
    assert reporter is not None
    profile = reporter.profile

    site_feature = db.get(MapFeature, conflict.site_feature_id) if conflict.site_feature_id else None
    site_lonlat = geo.centroid(site_feature.geometry) if site_feature else (conflict.lon, conflict.lat)
    activity_lonlat = (conflict.lon, conflict.lat)
    proj = geo.LocalProjection(*site_lonlat)

    # Map features in a box around the site, then precise distance filtering.
    dlat = CONTEXT_RADIUS_M / geo.M_PER_DEG_LAT
    dlon = CONTEXT_RADIUS_M / proj.m_per_deg_lon
    box = (site_lonlat[0] - dlon, site_lonlat[1] - dlat, site_lonlat[0] + dlon, site_lonlat[1] + dlat)
    scenario = current_scenario_features(db, today=today)
    site_xy = Point(proj.to_xy(*site_lonlat))
    nearby = [
        f
        for f in scenario
        if f.max_lon >= box[0] and f.min_lon <= box[2] and f.max_lat >= box[1] and f.min_lat <= box[3]
        and proj.geom_to_xy(f.geometry).distance(site_xy) <= CONTEXT_RADIUS_M
    ]
    network = [f for f in scenario if f.layer in ("human_route", "delivery_route")]

    ctx = MediationContext(
        conflict=conflict,
        species=species,
        representative=rep,
        reporter=reporter,
        profile=profile,
        today=today,
        site_lonlat=site_lonlat,
        activity_lonlat=activity_lonlat,
        site_feature=site_feature,
        features=nearby,
        network_features=network,
        proj=proj,
    )
    ctx.spatial = compute_spatial_facts(ctx)
    return ctx


def compute_spatial_facts(ctx: MediationContext) -> dict[str, Any]:
    s = ctx.species
    buffer_m, min_m = s.preferred_buffer_m, s.min_buffer_m
    quiet_zone = ctx.site_point_xy.buffer(buffer_m)

    entrances = ctx.layer("entrance")
    nearest_entrance = entrances[0] if entrances else None
    # The entrance the reporter's activity uses: nearest to the activity point.
    used_entrance = None
    if entrances:
        used_entrance = min(entrances, key=lambda n: ctx.xy(n.feature).distance(ctx.activity_point_xy))
    entrances_in_buffer = [n for n in entrances if n.distance_m < buffer_m]

    alternatives: list[NearbyFeature] = []
    if used_entrance is not None and used_entrance.distance_m < buffer_m:
        parent = used_entrance.feature.parent_id
        alternatives = [
            n for n in entrances
            if n.feature.id != used_entrance.feature.id
            and n.distance_m >= buffer_m
            and (parent is None or n.feature.parent_id == parent)
        ]

    routes_in_buffer = []
    for n in ctx.journeys("human_route", "delivery_route"):
        inside = ctx.xy(n.feature).intersection(quiet_zone).length
        if n.distance_m < buffer_m:
            routes_in_buffer.append(n.brief(length_inside_m=round(inside, 1)))

    lit_routes = [
        n.brief(lighting=(n.feature.properties or {}).get("lighting"))
        for n in ctx.layer("human_route", "delivery_route")
        if (n.feature.properties or {}).get("lighting") == "bright" and n.distance_m <= 45
    ]

    crossings = []
    for corridor in ctx.corridors():
        cxy = ctx.xy(corridor)
        for n in ctx.journeys("human_route", "delivery_route"):
            inter = cxy.intersection(ctx.xy(n.feature))
            if not inter.is_empty:
                p = inter.representative_point()
                lon, lat = ctx.proj.to_lonlat(p.x, p.y)
                crossings.append(
                    {
                        "corridor_id": str(corridor.id),
                        "corridor_name": corridor.name,
                        "route_id": str(n.feature.id),
                        "route_name": n.feature.name,
                        "route_layer": n.feature.layer,
                        "route_hours": (n.feature.properties or {}).get("operating_hours"),
                        "lon": round(lon, 7),
                        "lat": round(lat, 7),
                    }
                )

    activity_distance = float(ctx.activity_point_xy.distance(ctx.site_point_xy))

    def entrance_brief(n: NearbyFeature | None) -> dict[str, Any] | None:
        if n is None:
            return None
        props = n.feature.properties or {}
        return n.brief(step_free=props.get("step_free", True), note=props.get("access_note"))

    return {
        "site": {
            "feature_id": str(ctx.site_feature.id) if ctx.site_feature else None,
            "name": ctx.site_feature.name if ctx.site_feature else f"{s.common_name} site",
            "lon": round(ctx.site_lonlat[0], 7),
            "lat": round(ctx.site_lonlat[1], 7),
        },
        "buffer_m": buffer_m,
        "min_buffer_m": min_m,
        "in_season": ctx.in_season,
        "activity_distance_m": round(activity_distance, 1),
        "nearest_entrance": entrance_brief(nearest_entrance),
        "used_entrance": entrance_brief(used_entrance),
        "entrances_in_buffer": [entrance_brief(n) for n in entrances_in_buffer],
        "alternative_entrances": [entrance_brief(n) for n in alternatives],
        "routes_in_buffer": routes_in_buffer,
        "lit_routes_nearby": lit_routes,
        "corridor_crossings": crossings,
        "nearby_counts": _counts(ctx.features),
    }


def _counts(features: list[MapFeature]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for f in features:
        counts[f.layer] = counts.get(f.layer, 0) + 1
    return counts
