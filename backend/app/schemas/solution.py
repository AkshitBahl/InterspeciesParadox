import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel, Statement


class IndexComponent(BaseModel):
    key: str
    label: str
    score: float
    weight: float
    contribution: float
    explanation: str


class NeedScore(BaseModel):
    key: str
    side: str
    label: str
    importance: int
    baseline: float
    satisfaction: float
    change: float
    reason: str


class Gate(BaseModel):
    type: str
    passed: bool
    cap: float | None = None
    notes: list[str] = []


class CoexistenceIndex(BaseModel):
    """The full, transparent breakdown of a Coexistence Index."""

    index: float
    raw_index: float
    grade: str
    emoji: str
    formula: str
    weights: dict[str, float]
    components: list[IndexComponent]
    needs: list[NeedScore]
    feasibility_details: dict[str, Any]
    gates: list[Gate]
    limit_violations: list[str] = []


class SolutionAction(BaseModel):
    party: str | None = None
    action: str
    when: str | None = None
    cost_eur: int | None = None


class SolutionRead(ORMModel):
    id: uuid.UUID
    conflict_id: uuid.UUID
    parent_solution_id: uuid.UUID | None
    strategy: str
    title: str
    summary: str
    version: int
    status: str
    origin: str
    parameters: dict[str, Any]
    actions: list[SolutionAction]
    valid_months: list[int]
    cost_eur: int
    effort: str
    implementation_days: int
    legal_compliant: bool
    legal_notes: list[str]
    tradeoffs: list[str]
    coexistence_index: float
    index_breakdown: CoexistenceIndex
    representative_comment: Statement
    created_at: datetime


class SolutionRow(BaseModel):
    id: uuid.UUID | None
    title: str
    strategy: str
    status: str
    index: float
    grade: str
    emoji: str
    wildlife: float
    human: float
    feasibility: float
    balance: float
    cost_eur: int
    legal_compliant: bool
    improvement_over_status_quo: float


class SolutionComparison(BaseModel):
    conflict_id: uuid.UUID
    date: date
    status_quo: CoexistenceIndex
    solutions: list[SolutionRow]
    recommended_solution_id: uuid.UUID | None
    explanation: str


class ParameterSpec(BaseModel):
    name: str
    type: str
    label: str
    unit: str | None = None
    minimum: float | None = None
    maximum: float | None = None
    choices: list[str] | None = None
    ecological_minimum: float | None = None
    description: str = ""
    current_value: Any = None


class GenerateRequest(BaseModel):
    max_solutions: int = Field(5, ge=1, le=7)


class WhatIfRequest(BaseModel):
    """Preview a change without saving it."""

    changes: dict[str, Any] = Field(min_length=1, examples=[{"radius_m": 4}])


class WhatIfResponse(BaseModel):
    parameters: dict[str, Any]
    title: str
    coexistence_index: CoexistenceIndex
    limit_violations: list[str]
    legal_compliant: bool
    would_representative_accept: Literal["accept", "accept_with_concerns", "counter", "reject"]
