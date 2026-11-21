import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.solution import SolutionRead


class NegotiationMessageRead(ORMModel):
    id: uuid.UUID
    author_type: str
    author_name: str
    author_user_id: uuid.UUID | None
    kind: str
    text: str
    solution_id: uuid.UUID | None
    payload: dict[str, Any]
    created_at: datetime


class NegotiationRead(BaseModel):
    id: uuid.UUID
    conflict_id: uuid.UUID
    status: str
    rounds: int
    current_solution_id: uuid.UUID | None
    accepted_solution_id: uuid.UUID | None
    current_solution: SolutionRead | None = None
    messages: list[NegotiationMessageRead] = []


class OpenNegotiationRequest(BaseModel):
    solution_id: uuid.UUID | None = Field(None, description="Start from this solution (default: best index)")


class CommentRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000, examples=["How long will you stay above our door?"])


class CounterProposalRequest(BaseModel):
    solution_id: uuid.UUID
    changes: dict[str, Any] = Field(min_length=1, examples=[{"radius_m": 2}])
    message: str | None = Field(None, max_length=2000)


class CounterProposalResponse(BaseModel):
    verdict: Literal["accept", "accept_with_concerns", "counter", "reject"]
    revision: SolutionRead
    counter_solution: SolutionRead | None
    messages: list[NegotiationMessageRead]
    negotiation: NegotiationRead


class AcceptRequest(BaseModel):
    solution_id: uuid.UUID
    generate_agreement: bool = True


class AgreementRead(ORMModel):
    id: uuid.UUID
    conflict_id: uuid.UUID
    solution_id: uuid.UUID
    title: str
    status: str
    valid_from: date
    valid_until: date
    days_remaining: int = 0
    review_dates: list[str]
    parties: list[dict[str, Any]]
    terms: list[dict[str, Any]]
    wildlife_expectations: list[dict[str, Any]]
    monitoring: list[dict[str, Any]]
    signatures: list[dict[str, Any]]
    coexistence_index: float
    markdown: str
    terminated_reason: str | None
    created_at: datetime


class AcceptResponse(BaseModel):
    solution: SolutionRead
    agreement: AgreementRead | None
    negotiation: NegotiationRead


class SignRequest(BaseModel):
    role: str | None = Field(None, description="Your role if you are not the reporter, e.g. 'building_manager'")


class TerminateRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)
