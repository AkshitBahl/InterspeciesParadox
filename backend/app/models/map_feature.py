import uuid
from typing import Any

from sqlalchemy import Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class FeatureStatus:
    EXISTING = "existing"  # part of today's reality (seed data or added by users)
    PROPOSED = "proposed"  # belongs to a solution that is only proposed
    AGREED = "agreed"  # belongs to a signed agreement (reality while it is active)

    ALL = (EXISTING, PROPOSED, AGREED)


class MapFeature(IdMixin, TimestampMixin, Base):
    """Anything drawn on the map: buildings, nests, routes, buffers, markers...

    `geometry` is a GeoJSON geometry. The bounding box columns let us filter by
    map viewport quickly without needing PostGIS.
    """

    __tablename__ = "map_features"
    __table_args__ = (
        Index("ix_map_features_bbox", "min_lon", "min_lat", "max_lon", "max_lat"),
    )

    layer: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    geometry: Mapped[dict[str, Any]] = mapped_column()
    properties: Mapped[dict[str, Any]] = mapped_column(default=dict)
    status: Mapped[str] = mapped_column(String(20), default=FeatureStatus.EXISTING, index=True)
    active_months: Mapped[list[Any] | None] = mapped_column(nullable=True)
    is_seed: Mapped[bool] = mapped_column(default=False)

    min_lon: Mapped[float] = mapped_column(Float)
    min_lat: Mapped[float] = mapped_column(Float)
    max_lon: Mapped[float] = mapped_column(Float)
    max_lat: Mapped[float] = mapped_column(Float)

    species_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("species.id", ondelete="SET NULL"), nullable=True, index=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("map_features.id", ondelete="SET NULL"), nullable=True
    )
    replaces_feature_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("map_features.id", ondelete="SET NULL"), nullable=True
    )
    conflict_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("conflicts.id", ondelete="CASCADE", use_alter=True), nullable=True, index=True
    )
    solution_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("solutions.id", ondelete="CASCADE", use_alter=True), nullable=True, index=True
    )
    agreement_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agreements.id", ondelete="SET NULL", use_alter=True), nullable=True, index=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
