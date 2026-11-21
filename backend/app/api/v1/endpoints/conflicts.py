"""Steps 2-6: report a conflict, assess needs, generate and compare solutions."""

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, OptionalUser, get_or_404
from app.api.v1.endpoints.species import summary as species_summary
from app.core import clock
from app.models import (
    Agreement,
    Conflict,
    ConflictStatus,
    NegotiationSession,
    Solution,
    SolutionStatus,
    Species,
    User,
)
from app.schemas.conflict import (
    AssessmentRead,
    ConflictCreate,
    ConflictDetail,
    ConflictRead,
    ConflictUpdate,
)
from app.schemas.solution import (
    GenerateRequest,
    SolutionComparison,
    SolutionRead,
    SolutionRow,
)
from app.services import conflict_service, solution_engine
from app.services.context import build_context

router = APIRouter(prefix="/conflicts", tags=["conflicts & mediation"])

NEXT_STEPS = {
    ConflictStatus.REPORTED: "Run the needs assessment: POST /conflicts/{id}/assessment",
    ConflictStatus.ASSESSED: "Generate compromise solutions: POST /conflicts/{id}/solutions/generate",
    ConflictStatus.SOLUTIONS_PROPOSED: "Compare solutions (GET /conflicts/{id}/solutions/compare) and open a negotiation",
    ConflictStatus.NEGOTIATING: "Send counter-proposals or accept a solution",
    ConflictStatus.AGREEMENT_PENDING: "Sign the agreement: POST /agreements/{agreement_id}/sign",
    ConflictStatus.AGREED: "Agreement active. Do the check-ins on the review dates.",
    ConflictStatus.CLOSED: "Closed.",
}


def _owned(conflict: Conflict, user: User) -> None:
    if conflict.reporter_id != user.id and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the reporter can do this")


def detail(db: DbSession, conflict: Conflict) -> ConflictDetail:
    species = db.get(Species, conflict.species_id)
    reporter = db.get(User, conflict.reporter_id)
    assessment = solution_engine.latest_assessment(db, conflict.id)
    count, best = db.execute(
        select(func.count(Solution.id), func.max(Solution.coexistence_index)).where(
            Solution.conflict_id == conflict.id, Solution.status != SolutionStatus.SUPERSEDED
        )
    ).one()
    session = db.scalars(select(NegotiationSession).where(NegotiationSession.conflict_id == conflict.id)).first()
    agreement = db.scalars(select(Agreement).where(Agreement.conflict_id == conflict.id).order_by(Agreement.created_at.desc())).first()
    base = ConflictRead.model_validate(conflict).model_dump()
    return ConflictDetail(
        **base,
        species=species_summary(species),
        reporter_name=reporter.display_name if reporter else "?",
        latest_assessment_id=assessment.id if assessment else None,
        solution_count=count or 0,
        best_index=best,
        negotiation_id=session.id if session else None,
        agreement_id=agreement.id if agreement else None,
        agreement_status=agreement.status if agreement else None,
        next_step=NEXT_STEPS.get(conflict.status, "").replace("{id}", str(conflict.id)).replace("{agreement_id}", str(agreement.id) if agreement else "{agreement_id}"),
    )


@router.post("", response_model=ConflictDetail, status_code=status.HTTP_201_CREATED)
def report_conflict(body: ConflictCreate, user: CurrentUser, db: DbSession) -> ConflictDetail:
    """Step 2. Report a conflict. A conflict hotspot appears on the map automatically.

    If no known nest/roost/den of that species is within 60 m, a new wildlife site
    (with its seasonal buffer) is added to the map too.
    """
    conflict = conflict_service.create_conflict(db, user, body.model_dump())
    db.commit()
    return detail(db, conflict)


@router.get("", response_model=list[ConflictDetail])
def list_conflicts(
    db: DbSession,
    user: OptionalUser,
    status_: str | None = Query(None, alias="status"),
    species: str | None = Query(None, description="species slug"),
    mine: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[ConflictDetail]:
    query = select(Conflict).order_by(Conflict.created_at.desc())
    if status_:
        query = query.where(Conflict.status == status_)
    if species:
        query = query.join(Species, Species.id == Conflict.species_id).where(Species.slug == species)
    if mine:
        if user is None:
            raise HTTPException(status_code=401, detail="Log in to filter your own conflicts")
        query = query.where(Conflict.reporter_id == user.id)
    return [detail(db, c) for c in db.scalars(query.limit(limit).offset(offset))]


@router.get("/{conflict_id}", response_model=ConflictDetail)
def get_conflict(conflict_id: uuid.UUID, db: DbSession) -> ConflictDetail:
    return detail(db, get_or_404(db, Conflict, conflict_id, "Conflict"))


@router.patch("/{conflict_id}", response_model=ConflictDetail)
def update_conflict(conflict_id: uuid.UUID, body: ConflictUpdate, user: CurrentUser, db: DbSession) -> ConflictDetail:
    """Edit the report. Changing the human activity resets the mediation to 'reported'."""
    conflict = get_or_404(db, Conflict, conflict_id, "Conflict")
    _owned(conflict, user)
    data = body.model_dump(exclude_unset=True, mode="json")
    for key, value in data.items():
        setattr(conflict, key, value)
    if "human_activity" in data and conflict.status in (ConflictStatus.ASSESSED, ConflictStatus.SOLUTIONS_PROPOSED):
        conflict.status = ConflictStatus.REPORTED
    db.commit()
    return detail(db, conflict)


@router.delete("/{conflict_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conflict(conflict_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    conflict = get_or_404(db, Conflict, conflict_id, "Conflict")
    _owned(conflict, user)
    if conflict.status == ConflictStatus.AGREED:
        raise HTTPException(status_code=409, detail="This conflict has an active agreement; terminate it first")
    db.delete(conflict)
    db.commit()


# --- Steps 3-4 ---------------------------------------------------------------------

@router.post("/{conflict_id}/assessment", response_model=AssessmentRead, status_code=status.HTTP_201_CREATED)
def run_assessment(conflict_id: uuid.UUID, db: DbSession, _: CurrentUser):
    """Steps 3-4. Work out both sides' needs and where they clash or align."""
    conflict = get_or_404(db, Conflict, conflict_id, "Conflict")
    row = solution_engine.assess_conflict(db, conflict)
    db.commit()
    return row


@router.get("/{conflict_id}/assessment", response_model=AssessmentRead)
def get_assessment(conflict_id: uuid.UUID, db: DbSession):
    get_or_404(db, Conflict, conflict_id, "Conflict")
    row = solution_engine.latest_assessment(db, conflict_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No assessment yet: POST to this URL to run one")
    return row


# --- Steps 5-6 ---------------------------------------------------------------------

@router.post("/{conflict_id}/solutions/generate", response_model=list[SolutionRead], status_code=status.HTTP_201_CREATED)
def generate(conflict_id: uuid.UUID, user: CurrentUser, db: DbSession, body: GenerateRequest | None = None):
    """Step 5. Generate compromise solutions (runs the assessment first if needed).

    Each solution comes with its Coexistence Index (step 6) and its own proposed
    map layer (see GET /map/scenarios/{solution_id}).
    """
    conflict = get_or_404(db, Conflict, conflict_id, "Conflict")
    if conflict.status in (ConflictStatus.AGREEMENT_PENDING, ConflictStatus.AGREED, ConflictStatus.CLOSED):
        raise HTTPException(status_code=409, detail=f"This conflict is already {conflict.status}")
    sols = solution_engine.generate_solutions(db, conflict, user, max_solutions=(body.max_solutions if body else 5))
    db.commit()
    return sols


@router.get("/{conflict_id}/solutions", response_model=list[SolutionRead])
def list_solutions(conflict_id: uuid.UUID, db: DbSession, include_history: bool = False):
    """Solutions sorted by Coexistence Index. `include_history` also shows superseded revisions."""
    get_or_404(db, Conflict, conflict_id, "Conflict")
    query = select(Solution).where(Solution.conflict_id == conflict_id)
    if not include_history:
        query = query.where(Solution.status != SolutionStatus.SUPERSEDED)
    return list(db.scalars(query.order_by(Solution.coexistence_index.desc(), Solution.created_at)))


@router.get("/{conflict_id}/solutions/compare", response_model=SolutionComparison)
def compare_solutions(conflict_id: uuid.UUID, db: DbSession) -> SolutionComparison:
    """Step 6. Side-by-side comparison against 'do nothing', with a recommendation."""
    conflict = get_or_404(db, Conflict, conflict_id, "Conflict")
    assessment = solution_engine.latest_assessment(db, conflict.id)
    if assessment is None:
        raise HTTPException(status_code=409, detail="Run the assessment first")
    ctx = build_context(db, conflict)
    sq = solution_engine.status_quo(ctx, solution_engine.assessment_dict(assessment))
    rows = []
    sols = db.scalars(
        select(Solution).where(Solution.conflict_id == conflict.id, Solution.status.in_([SolutionStatus.PROPOSED, SolutionStatus.ACCEPTED]))
        .order_by(Solution.coexistence_index.desc())
    ).all()
    for s in sols:
        comp = {c["key"]: c["score"] for c in s.index_breakdown["components"]}
        rows.append(SolutionRow(
            id=s.id, title=s.title, strategy=s.strategy, status=s.status, index=s.coexistence_index,
            grade=s.index_breakdown["grade"], emoji=s.index_breakdown["emoji"],
            wildlife=comp["wildlife_wellbeing"], human=comp["human_wellbeing"], feasibility=comp["feasibility"], balance=comp["balance"],
            cost_eur=s.cost_eur, legal_compliant=s.legal_compliant,
            improvement_over_status_quo=round(s.coexistence_index - sq["index"], 1),
        ))
    best = next((r for r in rows if r.legal_compliant), None)
    explanation = (
        f"'{best.title}' scores {best.index:.0f}, which is {best.improvement_over_status_quo:+.0f} points versus doing nothing ({sq['index']:.0f})."
        if best else "No legal solution yet: generate solutions first."
    )
    return SolutionComparison(
        conflict_id=conflict.id, date=clock.today(), status_quo=sq, solutions=rows,
        recommended_solution_id=best.id if best else None, explanation=explanation,
    )
