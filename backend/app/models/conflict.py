import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class ConflictStatus:
    REPORTED = "reported"  # step 2
    ASSESSED = "assessed"  # steps 3-4
    SOLUTIONS_PROPOSED = "solutions_proposed"  # steps 5-6
    NEGOTIATING = "negotiating"  # step 7
    AGREEMENT_PENDING = "agreement_pending"  # a solution was accepted
    AGREED = "agreed"  # step 8: agreement signed
    CLOSED = "closed"

    ALL = (REPORTED, ASSESSED, SOLUTIONS_PROPOSED, NEGOTIATING, AGREEMENT_PENDING, AGREED, CLOSED)


class Conflict(IdMixin, TimestampMixin, Base):
    """Step 2: a human-wildlife conflict reported by a resident."""

    __tablename__ = "conflicts"

    reporter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    species_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("species.id"), index=True)
    site_feature_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("map_features.id", ondelete="SET NULL"), nullable=True
    )
    building_feature_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("map_features.id", ondelete="SET NULL"), nullable=True
    )
    hotspot_feature_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("map_features.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30), default=ConflictStatus.REPORTED, index=True)
    severity: Mapped[int] = mapped_column(default=3)  # 1-5 as felt by the reporter
    lon: Mapped[float]
    lat: Mapped[float]
    # {type, description, planned_start, planned_end, daily_hours, flexibility_weeks, budget_eur}
    human_activity: Mapped[dict[str, Any]] = mapped_column(default=dict)
    observed_on: Mapped[date | None] = mapped_column(nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(nullable=True)


class NeedsAssessment(IdMixin, TimestampMixin, Base):
    """Steps 3 and 4: what each side needs, and where those needs clash or align."""

    __tablename__ = "needs_assessments"

    conflict_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conflicts.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(default=1)
    assessed_for: Mapped[date]
    human_needs: Mapped[list[Any]] = mapped_column(default=list)
    wildlife_needs: Mapped[list[Any]] = mapped_column(default=list)
    conflicting_needs: Mapped[list[Any]] = mapped_column(default=list)
    compatible_needs: Mapped[list[Any]] = mapped_column(default=list)
    constraints: Mapped[list[Any]] = mapped_column(default=list)
    co_benefits: Mapped[list[Any]] = mapped_column(default=list)
    spatial_context: Mapped[dict[str, Any]] = mapped_column(default=dict)
    conflict_intensity: Mapped[float] = mapped_column(default=0.0)
    summary: Mapped[str] = mapped_column(Text, default="")
    representative_statement: Mapped[dict[str, Any]] = mapped_column(default=dict)
