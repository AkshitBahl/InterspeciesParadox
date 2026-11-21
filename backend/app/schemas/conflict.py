import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import ORMModel, PointGeometry, Statement
from app.schemas.species import SpeciesSummary

ActivityType = Literal[
    "entrance_use", "commute", "deliveries", "space_use",
    "renovation", "rooftop_maintenance", "garden_works", "event", "construction", "other",
]

CONFLICT_CATEGORIES = [
    "nest_near_entrance", "roost_in_renovation", "pollinators_on_balcony", "rooftop_works",
    "movement_vs_mobility", "den_near_play_area", "noise_or_light", "other",
]


class HumanActivity(BaseModel):
    """What the humans need to do that clashes with the animals."""

    type: ActivityType = "other"
    description: str | None = Field(None, max_length=300)
    planned_start: date | None = None
    planned_end: date | None = None
    daily_hours: list[str] = Field(default_factory=list, examples=[["07:30-09:00"]])
    flexibility_weeks: int = Field(0, ge=0, le=104, description="How many weeks the activity could be moved")
    budget_eur: int | None = Field(None, ge=0)

    @field_validator("daily_hours")
    @classmethod
    def _hours(cls, value: list[str]) -> list[str]:
        for item in value:
            parts = item.split("-")
            if len(parts) != 2 or not all(len(p) == 5 and p[2] == ":" for p in parts):
                raise ValueError("daily_hours items look like '07:30-09:00'")
        return value

    @model_validator(mode="after")
    def _dates(self) -> "HumanActivity":
        if self.planned_start and self.planned_end and self.planned_end < self.planned_start:
            raise ValueError("planned_end must be on or after planned_start")
        return self


class ConflictCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field("", max_length=4000)
    species_slug: str | None = Field(None, examples=["house-martin"])
    species_id: uuid.UUID | None = None
    category: str = Field("other", description=f"One of {CONFLICT_CATEGORIES}")
    severity: int = Field(3, ge=1, le=5)
    location: PointGeometry | None = Field(None, description="GeoJSON Point where the conflict happens")
    site_feature_id: uuid.UUID | None = Field(None, description="Existing wildlife_site map feature (nest, roost...)")
    building_feature_id: uuid.UUID | None = None
    human_activity: HumanActivity = Field(default_factory=HumanActivity)
    observed_on: date | None = None

    @model_validator(mode="after")
    def _required(self) -> "ConflictCreate":
        if not self.species_slug and not self.species_id:
            raise ValueError("Give species_slug or species_id")
        if not self.location and not self.site_feature_id:
            raise ValueError("Give a location or a site_feature_id")
        return self


class ConflictUpdate(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=200)
    description: str | None = Field(None, max_length=4000)
    category: str | None = None
    severity: int | None = Field(None, ge=1, le=5)
    human_activity: HumanActivity | None = None


class ConflictRead(ORMModel):
    id: uuid.UUID
    reporter_id: uuid.UUID
    species_id: uuid.UUID
    site_feature_id: uuid.UUID | None
    building_feature_id: uuid.UUID | None
    hotspot_feature_id: uuid.UUID | None
    title: str
    description: str
    category: str
    status: str
    severity: int
    lon: float
    lat: float
    human_activity: dict[str, Any]
    observed_on: date | None
    created_at: datetime
    updated_at: datetime


class ConflictDetail(ConflictRead):
    species: SpeciesSummary
    reporter_name: str
    latest_assessment_id: uuid.UUID | None = None
    solution_count: int = 0
    best_index: float | None = None
    negotiation_id: uuid.UUID | None = None
    agreement_id: uuid.UUID | None = None
    agreement_status: str | None = None
    next_step: str = Field(description="A friendly hint for the UI about what to do next")


class Need(BaseModel):
    key: str
    side: Literal["human", "wildlife"]
    label: str
    description: str
    category: str
    importance: int
    flexibility: float
    is_legal_requirement: bool
    hard: bool
    parameters: dict[str, Any]
    sources: list[str]
    baseline_satisfaction: float


class NeedPair(BaseModel):
    type: Literal["conflict", "compatible"]
    human_need: str
    wildlife_need: str
    severity: float
    explanation: str
    evidence: dict[str, Any] = {}


class AssessmentRead(ORMModel):
    id: uuid.UUID
    conflict_id: uuid.UUID
    version: int
    assessed_for: date
    human_needs: list[Need]
    wildlife_needs: list[Need]
    conflicting_needs: list[NeedPair]
    compatible_needs: list[NeedPair]
    constraints: list[dict[str, Any]]
    co_benefits: list[dict[str, Any]]
    spatial_context: dict[str, Any]
    conflict_intensity: float
    summary: str
    representative_statement: Statement
    created_at: datetime
