import uuid
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class NegotiationStatus:
    OPEN = "open"
    AGREED = "agreed"
    ABANDONED = "abandoned"


class MessageKind:
    COMMENT = "comment"
    COUNTER_PROPOSAL = "counter_proposal"
    REPRESENTATIVE_REPLY = "representative_reply"
    ACCEPT = "accept"
    REJECT = "reject"
    SYSTEM = "system"


class NegotiationSession(IdMixin, TimestampMixin, Base):
    """Step 7: humans and the species representative go back and forth."""

    __tablename__ = "negotiation_sessions"

    conflict_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conflicts.id", ondelete="CASCADE"), unique=True, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default=NegotiationStatus.OPEN)
    current_solution_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("solutions.id", ondelete="SET NULL"), nullable=True
    )
    accepted_solution_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("solutions.id", ondelete="SET NULL"), nullable=True
    )
    rounds: Mapped[int] = mapped_column(default=0)


class NegotiationMessage(IdMixin, TimestampMixin, Base):
    __tablename__ = "negotiation_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("negotiation_sessions.id", ondelete="CASCADE"), index=True
    )
    author_type: Mapped[str] = mapped_column(String(20))  # human | representative | system
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    author_name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(30))
    text: Mapped[str] = mapped_column(Text)
    solution_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("solutions.id", ondelete="SET NULL"), nullable=True
    )
    payload: Mapped[dict[str, Any]] = mapped_column(default=dict)
