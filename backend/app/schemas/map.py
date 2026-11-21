import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import Geometry


class FeatureCreate(BaseModel):
    """Add something to the map: a human, an animal, a nest, a path..."""

    layer: str = Field(examples=["resident"])
    name: str = Field(min_length=1, max_length=200, examples=["Me, walking my dog"])
    description: str | None = Field(None, max_length=2000)
    geometry: Geometry | None = Field(None, description="GeoJSON geometry [lon, lat]")
    location_feature_id: uuid.UUID | None = Field(
        None, description="Place it on an existing dataset location instead (uses that feature's centre)"
    )
    species_slug: str | None = Field(None, description="For animals, nests and corridors")
    properties: dict[str, Any] = Field(default_factory=dict, examples=[{"emoji": "🐕"}])
    active_months: list[int] | None = None
    parent_id: uuid.UUID | None = None

    @field_validator("active_months")
    @classmethod
    def _months(cls, value: list[int] | None) -> list[int] | None:
        if value and any(m < 1 or m > 12 for m in value):
            raise ValueError("months are 1-12")
        return value

    @model_validator(mode="after")
    def _where(self) -> "FeatureCreate":
        if self.geometry is None and self.location_feature_id is None:
            raise ValueError("Give a geometry or a location_feature_id")
        return self


class FeatureUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    geometry: Geometry | None = None
    properties: dict[str, Any] | None = Field(None, description="Merged into the existing properties")
    active_months: list[int] | None = None


class LayerInfo(BaseModel):
    key: str
    label: str
    emoji: str
    geometry: str
    color: str
    description: str
    order: int
    seasonal: bool = False
    user_editable: bool = False
    feature_count: int = 0


class MapConfig(BaseModel):
    neighbourhood: dict[str, Any]
    today: str
    center: list[float]
    zoom: float
    pitch: float
    bearing: float
    bounds: list[float]
    basemap_style_url: str
    alternative_basemaps: dict[str, str]
    attribution: str
    sources: dict[str, str]
    layers: list[LayerInfo]
    maplibre_layers: list[dict[str, Any]]
    palette: dict[str, str]


class ExportRequest(BaseModel):
    bbox: list[float] | None = Field(None, description="[min_lon, min_lat, max_lon, max_lat]")
    polygon: Geometry | None = Field(None, description="A drawn GeoJSON Polygon")
    conflict_id: uuid.UUID | None = None
    solution_id: uuid.UUID | None = None
    scenario: Literal["current", "proposed"] = "current"
    extra_features: dict[str, Any] | None = Field(
        None, description="Unsaved user-drawn GeoJSON Feature or FeatureCollection (e.g. marked intervention zones)"
    )
    question: str | None = Field(None, max_length=2000, description="Optional task for the LLM, appended at the end")
    include_geojson: bool = False
    title: str | None = Field(None, max_length=200)


class ExportResponse(BaseModel):
    title: str
    markdown: str
    summary: dict[str, Any]
    geojson: dict[str, Any] | None = None


class AnimationTrack(BaseModel):
    id: str
    feature_id: str
    label: str
    kind: str
    layer: str
    emoji: str
    species_slug: str | None
    scenario_role: str
    coordinates: list[list[float]]
    length_m: float
    duration_ms: int
    loop: bool
    start_delay_ms: int
    keyframes: list[list[float]]


class AnimationsResponse(BaseModel):
    scenario: str
    solution_id: uuid.UUID | None
    note: str
    tracks: list[AnimationTrack]


class ScenarioComparison(BaseModel):
    solution_id: uuid.UUID
    solution_title: str
    coexistence_index: float
    current: dict[str, Any]
    proposed: dict[str, Any]
    added: list[str]
    replaced: list[str]


class Coordinate(BaseModel):
    lon: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)

    def pair(self) -> list[float]:
        return [self.lon, self.lat]


class RouteRequest(BaseModel):
    start: Coordinate
    end: Coordinate
    waypoints: list[Coordinate] = Field(default_factory=list, max_length=10)
    profile: Literal["foot", "bike", "car"] = "foot"
    alternatives: bool = True
    avoid_active_buffers: bool = True
    provider: Literal["auto", "osrm", "local"] = "auto"


class RouteStep(BaseModel):
    instruction: str
    name: str
    distance_m: float


class RouteOption(BaseModel):
    id: str
    provider: str
    label: str
    geometry: dict[str, Any]
    distance_m: float
    duration_s: float
    steps: list[RouteStep]
    wildlife: dict[str, Any]


class RouteResponse(BaseModel):
    routes: list[RouteOption]
    recommended_route_id: str | None
    provider_used: str
    active_buffers_considered: int
    date: str
    notes: list[str]


class SearchResult(BaseModel):
    name: str
    display_name: str | None
    lon: float
    lat: float
    source: Literal["local", "nominatim"]
    feature_id: str | None = None
    layer: str | None = None
    type: str | None = None


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    notes: list[str]
    attribution: str
