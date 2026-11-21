import uuid
from datetime import date
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class AgreementStatus:
    DRAFT = "draft"  # generated, waiting for the human signature
    ACTIVE = "active"  # signed and within its validity window
    EXPIRED = "expired"  # past valid_until
    TERMINATED = "terminated"  # ended early

    ALL = (DRAFT, ACTIVE, EXPIRED, TERMINATED)


class Agreement(IdMixin, TimestampMixin, Base):
    """Step 8: a *temporary* coexistence agreement between humans and a species."""

    __tablename__ = "agreements"

    conflict_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conflicts.id", ondelete="CASCADE"), index=True)
    solution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("solutions.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default=AgreementStatus.DRAFT, index=True)
    valid_from: Mapped[date]
    valid_until: Mapped[date]
    review_dates: Mapped[list[Any]] = mapped_column(default=list)
    parties: Mapped[list[Any]] = mapped_column(default=list)
    terms: Mapped[list[Any]] = mapped_column(default=list)
    wildlife_expectations: Mapped[list[Any]] = mapped_column(default=list)
    monitoring: Mapped[list[Any]] = mapped_column(default=list)
    signatures: Mapped[list[Any]] = mapped_column(default=list)
    coexistence_index: Mapped[float] = mapped_column(default=0.0)
    markdown: Mapped[str] = mapped_column(Text, default="")
    terminated_reason: Mapped[str | None] = mapped_column(Text)
