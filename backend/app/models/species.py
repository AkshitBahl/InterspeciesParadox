import uuid
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, TimestampMixin


class Species(IdMixin, TimestampMixin, Base):
    """Structured ecological data. This is the *truth* the mediation engine uses.

    The funny representative never invents biology: every claim it makes is
    filled in from these fields.
    """

    __tablename__ = "species"

    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    common_name: Mapped[str] = mapped_column(String(120))
    scientific_name: Mapped[str] = mapped_column(String(120))
    taxon_group: Mapped[str] = mapped_column(String(40))  # bird | mammal | insect ...
    emoji: Mapped[str] = mapped_column(String(16), default="🐾")
    conservation_status: Mapped[str] = mapped_column(String(8))  # IUCN code: LC, NT, VU...
    population_trend: Mapped[str] = mapped_column(String(20), default="unknown")
    is_legally_protected: Mapped[bool] = mapped_column(default=False)
    legal_protection: Mapped[str] = mapped_column(Text, default="")

    # Seasonality (months are 1-12)
    active_months: Mapped[list[Any]] = mapped_column(default=list)
    sensitive_months: Mapped[list[Any]] = mapped_column(default=list)
    sensitive_periods: Mapped[list[Any]] = mapped_column(default=list)  # [{name, months, description}]
    activity_pattern: Mapped[str] = mapped_column(String(20))  # diurnal | nocturnal | crepuscular

    # Space and senses
    preferred_buffer_m: Mapped[float] = mapped_column(default=10.0)
    min_buffer_m: Mapped[float] = mapped_column(default=5.0)
    noise_sensitivity: Mapped[int] = mapped_column(default=3)  # 1-5
    light_sensitivity: Mapped[int] = mapped_column(default=3)  # 1-5
    foraging_range_m: Mapped[float] = mapped_column(default=500.0)
    movement_mode: Mapped[str] = mapped_column(String(20))  # aerial | ground | flying_insect

    diet: Mapped[list[Any]] = mapped_column(default=list)
    habitat_requirements: Mapped[list[Any]] = mapped_column(default=list)
    ecosystem_services: Mapped[list[Any]] = mapped_column(default=list)
    nuisances: Mapped[list[Any]] = mapped_column(default=list)  # what humans tend to complain about
    mitigations: Mapped[list[Any]] = mapped_column(default=list)  # structured known measures
    facts: Mapped[list[Any]] = mapped_column(default=list)  # grounded facts the persona may quote
    data_note: Mapped[str] = mapped_column(Text, default="")

    representative: Mapped["Representative | None"] = relationship(
        back_populates="species", uselist=False, cascade="all, delete-orphan"
    )


class Representative(IdMixin, TimestampMixin, Base):
    """The fictional, humorous spokes-animal of a species."""

    __tablename__ = "representatives"

    species_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"), unique=True
    )
    name: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(160))
    avatar_emoji: Mapped[str] = mapped_column(String(16))
    personality: Mapped[str] = mapped_column(Text)
    tone: Mapped[str] = mapped_column(String(200))
    catchphrases: Mapped[list[Any]] = mapped_column(default=list)
    greeting: Mapped[str] = mapped_column(Text)
    sign_off: Mapped[str] = mapped_column(String(200))
    # Template overrides: {"need.space": ["..."], "accept": ["..."], ...}
    phrasebook: Mapped[dict[str, Any]] = mapped_column(default=dict)

    species: Mapped[Species] = relationship(back_populates="representative")
