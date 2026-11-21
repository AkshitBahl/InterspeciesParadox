"""Single solutions: details, custom-weight index, negotiable knobs, what-if preview."""

import uuid

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import DbSession, get_or_404
from app.models import Solution
from app.schemas.solution import (
    CoexistenceIndex,
    ParameterSpec,
    SolutionRead,
    WhatIfRequest,
    WhatIfResponse,
)
from app.services import solution_engine
from app.services.negotiation_service import CONCERN_DROP
from app.services.strategies import STRATEGY_BY_KEY

router = APIRouter(prefix="/solutions", tags=["solutions & coexistence index"])


@router.get("/{solution_id}", response_model=SolutionRead)
def get_solution(solution_id: uuid.UUID, db: DbSession):
    return get_or_404(db, Solution, solution_id, "Solution")


@router.get("/{solution_id}/coexistence-index", response_model=CoexistenceIndex)
def coexistence_index(
    solution_id: uuid.UUID,
    db: DbSession,
    wildlife: float | None = Query(None, ge=0, description="Custom weight (weights are re-normalised to sum to 1)"),
    human: float | None = Query(None, ge=0),
    feasibility: float | None = Query(None, ge=0),
    balance: float | None = Query(None, ge=0),
):
    """The transparent breakdown. Pass custom weights to see how priorities change the score."""
    solution = get_or_404(db, Solution, solution_id, "Solution")
    weights = {k: v for k, v in {"wildlife": wildlife, "human": human, "feasibility": feasibility, "balance": balance}.items() if v is not None}
    return solution_engine.index_for_solution(db, solution, weights or None)


@router.get("/{solution_id}/parameters", response_model=list[ParameterSpec])
def negotiable_parameters(solution_id: uuid.UUID, db: DbSession):
    """The knobs humans can change in a counter-proposal, with current values and ecological minimums."""
    return solution_engine.negotiable_parameters(db, get_or_404(db, Solution, solution_id, "Solution"))


@router.post("/{solution_id}/what-if", response_model=WhatIfResponse)
def what_if(solution_id: uuid.UUID, body: WhatIfRequest, db: DbSession) -> WhatIfResponse:
    """Preview a change (e.g. a smaller radius) without saving anything: great for a live slider."""
    solution = get_or_404(db, Solution, solution_id, "Solution")
    try:
        ctx, assessment, draft, params = solution_engine.build_revision(db, solution, body.changes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    a = solution_engine.assessment_dict(assessment)
    index = solution_engine.evaluate(ctx, a, draft)
    old_w = next(c["score"] for c in solution.index_breakdown["components"] if c["key"] == "wildlife_wellbeing")
    new_w = next(c["score"] for c in index["components"] if c["key"] == "wildlife_wellbeing")
    if draft.limit_violations or not draft.legal_compliant:
        repaired = STRATEGY_BY_KEY[solution.strategy].repair(ctx, a, params)
        verdict = "counter" if repaired else "reject"
    elif new_w < old_w - CONCERN_DROP:
        verdict = "accept_with_concerns"
    else:
        verdict = "accept"
    return WhatIfResponse(
        parameters=params, title=draft.title, coexistence_index=index, limit_violations=draft.limit_violations,
        legal_compliant=draft.legal_compliant, would_representative_accept=verdict,
    )
