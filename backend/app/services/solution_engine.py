"""Runs the mediation pipeline and stores results.

    assess_conflict()      -> steps 3-4 (NeedsAssessment row)
    generate_solutions()   -> step 5   (Solution rows + proposed map features)
    evaluate()             -> step 6   (Coexistence Index for a draft)
    build_revision()       -> step 7   (re-build a solution with new parameters)
"""

import uuid
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Conflict,
    ConflictStatus,
    FeatureStatus,
    MapFeature,
    NeedsAssessment,
    Solution,
    SolutionOrigin,
    SolutionStatus,
    User,
)
from app.services import coexistence_index, needs_engine, seasons
from app.services import representative as voice
from app.services.context import MediationContext, build_context
from app.services.map_service import new_feature
from app.services.strategies import STRATEGIES, STRATEGY_BY_KEY, Draft

MAX_SOLUTIONS = 5
MIN_IMPROVEMENT = 1.0  # index points a proposal must gain over the status quo


# --- steps 3-4 ----------------------------------------------------------------------

def latest_assessment(db: Session, conflict_id: uuid.UUID) -> NeedsAssessment | None:
    return db.scalars(
        select(NeedsAssessment).where(NeedsAssessment.conflict_id == conflict_id).order_by(NeedsAssessment.version.desc())
    ).first()


def assess_conflict(db: Session, conflict: Conflict, today: date | None = None) -> NeedsAssessment:
    ctx = build_context(db, conflict, today)
    result = needs_engine.assess(ctx)
    previous = latest_assessment(db, conflict.id)
    row = NeedsAssessment(
        conflict_id=conflict.id,
        version=(previous.version + 1) if previous else 1,
        assessed_for=ctx.today,
        **result,
    )
    db.add(row)
    if conflict.status == ConflictStatus.REPORTED:
        conflict.status = ConflictStatus.ASSESSED
    db.flush()
    return row


def assessment_dict(row: NeedsAssessment) -> dict[str, Any]:
    return {
        "human_needs": row.human_needs,
        "wildlife_needs": row.wildlife_needs,
        "conflicting_needs": row.conflicting_needs,
        "compatible_needs": row.compatible_needs,
    }


# --- step 6 -------------------------------------------------------------------------

def days_available(ctx: MediationContext) -> int | None:
    if ctx.is_works and ctx.planned_start:
        return max(0, (ctx.planned_start - ctx.today).days)
    if ctx.in_season:
        return 7
    nxt = seasons.next_season_start(ctx.species.sensitive_months, ctx.today)
    return (nxt - ctx.today).days if nxt else None


def evaluate(ctx: MediationContext, a: dict[str, Any], draft: Draft, weights: dict[str, float] | None = None) -> dict[str, Any]:
    needs = a["human_needs"] + a["wildlife_needs"]
    result = coexistence_index.compute_index(
        needs,
        draft.effects,
        cost_eur=draft.cost_eur,
        budget_eur=ctx.budget_eur,
        effort=draft.effort,
        implementation_days=draft.implementation_days,
        days_available=days_available(ctx),
        legal_compliant=draft.legal_compliant,
        legal_notes=draft.legal_notes if not draft.legal_compliant else [],
        hard_violations=draft.hard_violations,
        limit_violations=draft.limit_violations,
        weights=weights,
    )
    result["limit_violations"] = list(draft.limit_violations)
    return result


def status_quo(ctx: MediationContext, a: dict[str, Any]) -> dict[str, Any]:
    """What happens if nobody does anything? (The baseline every solution must beat.)"""
    from app.services.seasons import overlap_fraction

    legal = True
    notes: list[str] = []
    if ctx.is_works and ctx.planned_start and ctx.planned_end and ctx.species.is_legally_protected:
        if overlap_fraction(ctx.planned_start, ctx.planned_end, ctx.species.sensitive_months) > 0:
            legal = False
            notes.append("The works would happen during the protected season.")
    draft = Draft("status_quo", "Do nothing", "Everything stays as it is.", {}, legal_compliant=legal, legal_notes=notes)
    return evaluate(ctx, a, draft)


def index_for_solution(db: Session, solution: Solution, weights: dict[str, float] | None = None) -> dict[str, Any]:
    """Recompute the index of a stored solution (e.g. with custom weights)."""
    if not weights:
        return solution.index_breakdown
    conflict = db.get(Conflict, solution.conflict_id)
    ctx = build_context(db, conflict)
    a = _assessment_for(db, solution)
    draft = draft_from_solution(solution)
    return evaluate(ctx, a, draft, weights)


def draft_from_solution(s: Solution) -> Draft:
    return Draft(
        strategy=s.strategy,
        title=s.title,
        summary=s.summary,
        parameters=s.parameters,
        actions=s.actions,
        effects=s.need_effects,
        cost_eur=s.cost_eur,
        effort=s.effort,
        implementation_days=s.implementation_days,
        valid_months=s.valid_months,
        legal_compliant=s.legal_compliant,
        legal_notes=s.legal_notes,
        limit_violations=(s.index_breakdown or {}).get("limit_violations", []),
        hard_violations=next((g["notes"] for g in (s.index_breakdown or {}).get("gates", []) if g["type"] == "hard_human_needs"), []),
        tradeoffs=s.tradeoffs,
    )


def _assessment_for(db: Session, solution: Solution) -> dict[str, Any]:
    row = db.get(NeedsAssessment, solution.assessment_id) if solution.assessment_id else latest_assessment(db, solution.conflict_id)
    if row is None:
        raise ValueError("This conflict has no needs assessment yet")
    return assessment_dict(row)


# --- step 5 -------------------------------------------------------------------------

def persist_draft(
    db: Session,
    ctx: MediationContext,
    assessment: NeedsAssessment,
    draft: Draft,
    *,
    origin: str = SolutionOrigin.GENERATED,
    parent: Solution | None = None,
    user: User | None = None,
) -> Solution:
    a = assessment_dict(assessment)
    breakdown = evaluate(ctx, a, draft)
    wildlife_score = next(c["score"] for c in breakdown["components"] if c["key"] == "wildlife_wellbeing")
    comment = voice.solution_comment(
        ctx.species, ctx.representative, breakdown["index"], wildlife_score, draft.legal_compliant, draft.legal_notes
    )
    solution = Solution(
        id=uuid.uuid4(),
        conflict_id=ctx.conflict.id,
        assessment_id=assessment.id,
        parent_solution_id=parent.id if parent else None,
        created_by_id=user.id if user else None,
        strategy=draft.strategy,
        title=draft.title,
        summary=draft.summary,
        version=(parent.version + 1) if parent else 1,
        status=SolutionStatus.PROPOSED,
        origin=origin,
        parameters=_jsonable(draft.parameters),
        actions=draft.actions,
        need_effects=draft.effects,
        valid_months=draft.valid_months,
        cost_eur=int(draft.cost_eur),
        effort=draft.effort,
        implementation_days=int(draft.implementation_days),
        legal_compliant=draft.legal_compliant,
        legal_notes=draft.legal_notes,
        tradeoffs=draft.tradeoffs,
        coexistence_index=breakdown["index"],
        index_breakdown=breakdown,
        representative_comment=comment,
    )
    db.add(solution)
    db.flush()
    for spec in draft.map_features:
        db.add(
            new_feature(
                spec["layer"],
                spec["name"],
                spec["geometry"],
                properties=_jsonable(spec.get("properties") or {}),
                status=FeatureStatus.PROPOSED,
                active_months=spec.get("active_months"),
                species_id=spec.get("species_id"),
                replaces_feature_id=spec.get("replaces_feature_id"),
                conflict_id=ctx.conflict.id,
                solution_id=solution.id,
                created_by_id=user.id if user else None,
            )
        )
    db.flush()
    return solution


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if isinstance(value, (date,)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def generate_solutions(
    db: Session, conflict: Conflict, user: User | None = None, max_solutions: int = MAX_SOLUTIONS
) -> list[Solution]:
    assessment = latest_assessment(db, conflict.id) or assess_conflict(db, conflict)
    ctx = build_context(db, conflict)
    a = assessment_dict(assessment)

    # Replace earlier generated, still-open proposals.
    old = db.scalars(
        select(Solution).where(
            Solution.conflict_id == conflict.id,
            Solution.status == SolutionStatus.PROPOSED,
        )
    ).all()
    for s in old:
        s.status = SolutionStatus.SUPERSEDED
        for f in db.scalars(select(MapFeature).where(MapFeature.solution_id == s.id)):
            db.delete(f)

    drafts = []
    for strategy in STRATEGIES:
        if strategy.applicable(ctx, a):
            draft = strategy.build(ctx, a, strategy.default_params(ctx, a))
            drafts.append((evaluate(ctx, a, draft)["index"], draft))
    drafts.sort(key=lambda item: -item[0])
    # Only propose ideas that beat "doing nothing" by at least one point
    # (but always show the best one, so the user is never left empty-handed).
    baseline = status_quo(ctx, a)["index"]
    drafts = [item for item in drafts if item[0] >= baseline + MIN_IMPROVEMENT] or drafts[:1]
    saved = [persist_draft(db, ctx, assessment, d, user=user) for _, d in drafts[:max_solutions]]
    if conflict.status in (ConflictStatus.REPORTED, ConflictStatus.ASSESSED):
        conflict.status = ConflictStatus.SOLUTIONS_PROPOSED
    db.flush()
    return saved


# --- step 7 helpers -----------------------------------------------------------------------

def build_revision(
    db: Session, solution: Solution, changes: dict[str, Any]
) -> tuple[MediationContext, NeedsAssessment, Draft, dict[str, Any]]:
    """Validate parameter changes and rebuild the solution as a new draft."""
    strategy = STRATEGY_BY_KEY.get(solution.strategy)
    if strategy is None:
        raise ValueError(f"Unknown strategy {solution.strategy}")
    conflict = db.get(Conflict, solution.conflict_id)
    ctx = build_context(db, conflict)
    assessment = db.get(NeedsAssessment, solution.assessment_id) if solution.assessment_id else latest_assessment(db, conflict.id)
    clean = strategy.validate(ctx, changes)
    params = {**solution.parameters, **clean}
    draft = strategy.build(ctx, assessment_dict(assessment), params)
    return ctx, assessment, draft, params


def negotiable_parameters(db: Session, solution: Solution) -> list[dict[str, Any]]:
    strategy = STRATEGY_BY_KEY.get(solution.strategy)
    if strategy is None:
        return []
    ctx = build_context(db, db.get(Conflict, solution.conflict_id))
    out = []
    for spec in strategy.param_specs(ctx):
        item = spec.as_dict()
        item["current_value"] = solution.parameters.get(spec.name)
        out.append(item)
    return out
