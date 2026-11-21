import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, TimestampMixin

if TYPE_CHECKING:
    pass


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(default=True)
    is_admin: Mapped[bool] = mapped_column(default=False)

    profile: Mapped["HumanProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class HumanProfile(IdMixin, TimestampMixin, Base):
    """Step 1 of the mediation flow: who is the human and what do they care about?"""

    __tablename__ = "human_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    home_building_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("map_features.id", ondelete="SET NULL", use_alter=True), nullable=True
    )
    home_unit: Mapped[str | None] = mapped_column(String(40))
    age_group: Mapped[str | None] = mapped_column(String(20))  # child | adult | senior
    household_size: Mapped[int] = mapped_column(default=1)
    mobility_needs: Mapped[list[Any]] = mapped_column(default=list)  # e.g. ["wheelchair", "stroller"]
    allergies: Mapped[list[Any]] = mapped_column(default=list)  # e.g. ["bee_sting"]
    pets: Mapped[list[Any]] = mapped_column(default=list)
    wildlife_comfort: Mapped[int] = mapped_column(default=3)  # 1 = nervous ... 5 = loves wildlife
    noise_tolerance: Mapped[int] = mapped_column(default=3)  # 1 = needs quiet ... 5 = unbothered
    needs_night_lighting: Mapped[bool] = mapped_column(default=False)
    daily_schedule: Mapped[dict[str, Any]] = mapped_column(default=dict)
    # How much each concern matters (1-5): safety, convenience, cost, nature, quiet.
    priorities: Mapped[dict[str, Any]] = mapped_column(default=dict)
    budget_eur: Mapped[int | None] = mapped_column(nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(8), default="en")
    bio: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="profile")
