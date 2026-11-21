import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class RepresentativeRead(ORMModel):
    name: str
    title: str
    avatar_emoji: str
    personality: str
    tone: str
    catchphrases: list[str]
    greeting: str
    sign_off: str


class SpeciesSummary(ORMModel):
    id: uuid.UUID
    slug: str
    common_name: str
    scientific_name: str
    taxon_group: str
    emoji: str
    conservation_status: str
    is_legally_protected: bool
    sensitive_now: bool = False
    representative_name: str | None = None


class SpeciesRead(ORMModel):
    id: uuid.UUID
    slug: str
    common_name: str
    scientific_name: str
    taxon_group: str
    emoji: str
    conservation_status: str
    population_trend: str
    is_legally_protected: bool
    legal_protection: str
    active_months: list[int]
    sensitive_months: list[int]
    sensitive_periods: list[dict[str, Any]]
    activity_pattern: str
    preferred_buffer_m: float
    min_buffer_m: float
    noise_sensitivity: int
    light_sensitivity: int
    foraging_range_m: float
    movement_mode: str
    diet: list[str]
    habitat_requirements: list[str]
    ecosystem_services: list[str]
    nuisances: list[str]
    mitigations: list[dict[str, Any]]
    facts: list[str]
    data_note: str
    sensitive_now: bool = False
    representative: RepresentativeRead | None = None


class CalendarMonth(BaseModel):
    month: int
    name: str
    active: bool
    sensitive: bool
    periods: list[str]


class SpeciesCalendar(BaseModel):
    species: str
    today_month: int
    months: list[CalendarMonth]


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000, examples=["When will you leave?"])
