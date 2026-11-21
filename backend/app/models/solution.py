import uuid
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class SolutionStatus:
    PROPOSED = "proposed"
    SUPERSEDED = "superseded"  # a newer revision replaced it during negotiation
    ACCEPTED = "accepted"
    REJECTED = "rejected"

    ALL = (PROPOSED, SUPERSEDED, ACCEPTED, REJECTED)


class SolutionOrigin:
    GENERATED = "generated"  # created by the mediation engine
    HUMAN_REVISION = "human_revision"  # a human counter-proposal
    REPRESENTATIVE_COUNTER = "representative_counter"  # the species' counter-offer


class Solution(IdMixin, TimestampMixin, Base):
    """Step 5 (and 7): one feasible compromise, with its Coexistence Index (step 6)."""

    __tablename__ = "solutions"

    conflict_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conflicts.id", ondelete="CASCADE"), index=True)
    assessment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("needs_assessments.id", ondelete="SET NULL"), nullable=True
    )
    parent_solution_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("solutions.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    strategy: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(default=1)
    status: Mapped[str] = mapped_column(String(20), default=SolutionStatus.PROPOSED, index=True)
    origin: Mapped[str] = mapped_column(String(30), default=SolutionOrigin.GENERATED)

    parameters: Mapped[dict[str, Any]] = mapped_column(default=dict)
    actions: Mapped[list[Any]] = mapped_column(default=list)
    need_effects: Mapped[dict[str, Any]] = mapped_column(default=dict)
    valid_months: Mapped[list[Any]] = mapped_column(default=list)
    cost_eur: Mapped[int] = mapped_column(default=0)
    effort: Mapped[str] = mapped_column(String(10), default="low")  # low | medium | high
    implementation_days: Mapped[int] = mapped_column(default=1)
    legal_compliant: Mapped[bool] = mapped_column(default=True)
    legal_notes: Mapped[list[Any]] = mapped_column(default=list)
    tradeoffs: Mapped[list[Any]] = mapped_column(default=list)

    coexistence_index: Mapped[float] = mapped_column(default=0.0, index=True)
    index_breakdown: Mapped[dict[str, Any]] = mapped_column(default=dict)
    representative_comment: Mapped[dict[str, Any]] = mapped_column(default=dict)
    notes: Mapped[str | None] = mapped_column(Text)
