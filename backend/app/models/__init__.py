"""Import every model here so Alembic and `Base.metadata` can see all tables."""

from app.models.agreement import Agreement, AgreementStatus
from app.models.conflict import Conflict, ConflictStatus, NeedsAssessment
from app.models.map_feature import FeatureStatus, MapFeature
from app.models.negotiation import (
    MessageKind,
    NegotiationMessage,
    NegotiationSession,
    NegotiationStatus,
)
from app.models.solution import Solution, SolutionOrigin, SolutionStatus
from app.models.species import Representative, Species
from app.models.user import HumanProfile, User

__all__ = [
    "Agreement",
    "AgreementStatus",
    "Conflict",
    "ConflictStatus",
    "FeatureStatus",
    "HumanProfile",
    "MapFeature",
    "MessageKind",
    "NeedsAssessment",
    "NegotiationMessage",
    "NegotiationSession",
    "NegotiationStatus",
    "Representative",
    "Solution",
    "SolutionOrigin",
    "SolutionStatus",
    "Species",
    "User",
]
