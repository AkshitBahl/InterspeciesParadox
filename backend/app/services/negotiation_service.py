"""Step 7: negotiation between humans and the species representative.

The loop, step by step:
1. A human sends a counter-proposal: "same plan, but radius 2 m instead of 6 m".
2. We rebuild the solution with those parameters and recompute the index.
3. The representative checks the result against the *ecological limits* in the
   species data (minimum distance, sensitive months, legal protection):
     * fine                         -> "accept"
     * fine, but wildlife score drops a lot -> "accept_with_concerns"
     * breaks a limit, but fixable  -> "counter" (it proposes the closest legal values)
     * breaks a limit, not fixable  -> "reject"
4. Humans can accept any proposal the representative did not reject.
"""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import (
    Conflict,
    ConflictStatus,
    MessageKind,
    NegotiationMessage,
    NegotiationSession,
    NegotiationStatus,
    Solution,
    SolutionOrigin,
    SolutionStatus,
    Species,
    User,
)
from app.services import llm_voice
from app.services import representative as voice_mod
from app.services.representative import Voice, format_months, site_word
from app.services.solution_engine import assessment_dict, build_revision, persist_draft
from app.services.strategies import STRATEGY_BY_KEY

MIN_WILDLIFE_SCORE_TO_AGREE = 50.0
CONCERN_DROP = 15.0


class NegotiationError(ValueError):
    pass


def wildlife_score(solution: Solution) -> float:
    for c in (solution.index_breakdown or {}).get("components", []):
        if c["key"] == "wildlife_wellbeing":
            return float(c["score"])
    return 0.0


def _species(db: Session, conflict: Conflict) -> Species:
    species = db.get(Species, conflict.species_id)
    assert species is not None
    return species


def _message(
    db: Session, session: NegotiationSession, *, author_type: str, author_name: str, kind: str, text: str,
    user: User | None = None, solution: Solution | None = None, payload: dict[str, Any] | None = None,
) -> NegotiationMessage:
    msg = NegotiationMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        author_type=author_type,
        author_user_id=user.id if user else None,
        author_name=author_name,
        kind=kind,
        text=text,
        solution_id=solution.id if solution else None,
        payload=payload or {},
        created_at=clock.now(),
    )
    db.add(msg)
    db.flush()
    return msg


def _rep_message(db: Session, session: NegotiationSession, statement: dict[str, Any], kind: str, solution: Solution | None, extra: dict[str, Any] | None = None) -> NegotiationMessage:
    return _message(
        db, session, author_type="representative", author_name=statement["speaker"], kind=kind,
        text=statement["text"], solution=solution, payload={"statement": statement, **(extra or {})},
    )


def get_session(db: Session, conflict: Conflict) -> NegotiationSession | None:
    return db.scalars(select(NegotiationSession).where(NegotiationSession.conflict_id == conflict.id)).first()


def open_session(db: Session, conflict: Conflict, solution_id: uuid.UUID | None = None) -> NegotiationSession:
    session = get_session(db, conflict)
    if session:
        return session
    proposed = db.scalars(
        select(Solution).where(Solution.conflict_id == conflict.id, Solution.status == SolutionStatus.PROPOSED)
        .order_by(Solution.coexistence_index.desc())
    ).all()
    if not proposed:
        raise NegotiationError("Generate solutions before opening a negotiation.")
    start = next((s for s in proposed if s.id == solution_id), proposed[0])
    session = NegotiationSession(id=uuid.uuid4(), conflict_id=conflict.id, current_solution_id=start.id)
    db.add(session)
    db.flush()
    species = _species(db, conflict)
    _message(db, session, author_type="system", author_name="Mediator", kind=MessageKind.SYSTEM,
             text=f"Negotiation opened on '{start.title}' (Coexistence Index {start.coexistence_index:.0f}).", solution=start)
    v = Voice(species, species.representative)
    if species.representative:
        v.raw(species.representative.greeting)
    v.say("need.space", seed="open")
    v.raw(f"Let's start from '{start.title}'. {start.representative_comment.get('text', '')}".strip())
    v.ground_buffer()
    v.ground_season()
    _rep_message(db, session, llm_voice.speak(v, "negotiation_opening"), MessageKind.REPRESENTATIVE_REPLY, start)
    if conflict.status in (ConflictStatus.SOLUTIONS_PROPOSED, ConflictStatus.ASSESSED):
        conflict.status = ConflictStatus.NEGOTIATING
    db.flush()
    return session


def messages(db: Session, session: NegotiationSession) -> list[NegotiationMessage]:
    return list(
        db.scalars(select(NegotiationMessage).where(NegotiationMessage.session_id == session.id).order_by(NegotiationMessage.created_at))
    )


def _require_open(session: NegotiationSession) -> None:
    if session.status != NegotiationStatus.OPEN:
        raise NegotiationError(f"This negotiation is {session.status}.")


def post_comment(db: Session, conflict: Conflict, session: NegotiationSession, user: User, text: str) -> list[NegotiationMessage]:
    _require_open(session)
    species = _species(db, conflict)
    human = _message(db, session, author_type="human", author_name=user.display_name, kind=MessageKind.COMMENT, text=text, user=user)
    answer = llm_voice.answer(voice_mod.answer_question(species, species.representative, text), species, species.representative, text)
    reply = _rep_message(db, session, answer, MessageKind.REPRESENTATIVE_REPLY, None)
    return [human, reply]


def _describe(params: dict[str, Any], specs: dict[str, Any]) -> str:
    parts = []
    for name, value in params.items():
        spec = specs.get(name)
        label = spec.label.lower() if spec else name.replace("_", " ")
        unit = f" {spec.unit}" if spec and spec.unit else ""
        if isinstance(value, bool):
            parts.append(f"{label}: {'yes' if value else 'no'}")
        elif isinstance(value, float):
            parts.append(f"{label} {value:g}{unit}")
        else:
            parts.append(f"{label} {value}{unit}")
    return ", ".join(parts)


def counter_proposal(
    db: Session, conflict: Conflict, session: NegotiationSession, user: User,
    solution_id: uuid.UUID, changes: dict[str, Any], message: str | None = None,
) -> dict[str, Any]:
    _require_open(session)
    if not changes:
        raise NegotiationError("Tell us what to change, e.g. {\"radius_m\": 4}.")
    parent = db.get(Solution, solution_id)
    if parent is None or parent.conflict_id != conflict.id:
        raise NegotiationError("That solution does not belong to this conflict.")
    if parent.status not in (SolutionStatus.PROPOSED, SolutionStatus.SUPERSEDED):
        raise NegotiationError(f"That solution is {parent.status} and cannot be revised.")

    ctx, assessment, draft, params = build_revision(db, parent, changes)
    strategy = STRATEGY_BY_KEY[parent.strategy]
    specs = {s.name: s for s in strategy.param_specs(ctx)}
    species = ctx.species
    session.rounds += 1

    human_text = message or f"Counter-proposal: {_describe(changes, specs)}."
    revision = persist_draft(db, ctx, assessment, draft, origin=SolutionOrigin.HUMAN_REVISION, parent=parent, user=user)
    if parent.status == SolutionStatus.PROPOSED:
        parent.status = SolutionStatus.SUPERSEDED
    human_msg = _message(db, session, author_type="human", author_name=user.display_name, kind=MessageKind.COUNTER_PROPOSAL,
                         text=human_text, user=user, solution=revision, payload={"changes": changes, "parent_solution_id": str(parent.id)})

    v = Voice(species, species.representative)
    old_w, new_w = wildlife_score(parent), wildlife_score(revision)
    counter = None
    if draft.limit_violations or not draft.legal_compliant:
        repaired = strategy.repair(ctx, assessment_dict(assessment), params)
        counter_draft = strategy.build(ctx, assessment_dict(assessment), repaired) if repaired else None
        if counter_draft and not counter_draft.limit_violations and counter_draft.legal_compliant:
            counter = persist_draft(db, ctx, assessment, counter_draft, origin=SolutionOrigin.REPRESENTATIVE_COUNTER, parent=revision)
            revision.status = SolutionStatus.REJECTED
            offer_changes = {k: v_ for k, v_ in repaired.items() if params.get(k) != v_}
            concern = (draft.limit_violations or draft.legal_notes or ["That goes past what the data allows."])[0]
            v.say("counter", seed=str(session.rounds), concern=concern, offer=_describe(offer_changes, specs) or counter.title)
            verdict = "counter"
            session.current_solution_id = counter.id
        else:
            revision.status = SolutionStatus.REJECTED
            v.say("reject", seed=str(session.rounds), reason=" ".join(draft.limit_violations + draft.legal_notes[:1]))
            verdict = "reject"
        for violation in draft.limit_violations:
            v.ground(violation, "strategy.limit_check", None)
        v.ground_buffer()
        v.ground_season()
        v.ground_legal()
    elif new_w < old_w - CONCERN_DROP:
        v.say("concerns", seed=str(session.rounds), old=f"{old_w:.0f}", new=f"{new_w:.0f}")
        verdict = "accept_with_concerns"
        session.current_solution_id = revision.id
    else:
        fact = species.facts[session.rounds % len(species.facts)] if species.facts else ""
        v.say("accept", seed=str(session.rounds), fact=fact)
        if fact:
            v.ground(fact, "species.facts", None)
        verdict = "accept"
        session.current_solution_id = revision.id
    v.ground(f"Wildlife wellbeing: {old_w:.0f} -> {new_w:.0f}", "coexistence_index.wildlife_wellbeing", {"before": old_w, "after": new_w})

    reply = _rep_message(db, session, llm_voice.speak(v, "negotiation_reply"), MessageKind.REPRESENTATIVE_REPLY, counter or revision,
                         {"verdict": verdict, "revision_id": str(revision.id), "counter_solution_id": str(counter.id) if counter else None})
    db.flush()
    return {
        "verdict": verdict,
        "revision": revision,
        "counter_solution": counter,
        "messages": [human_msg, reply],
        "session": session,
    }


def accept(
    db: Session, conflict: Conflict, session: NegotiationSession, user: User, solution_id: uuid.UUID
) -> Solution:
    _require_open(session)
    solution = db.get(Solution, solution_id)
    if solution is None or solution.conflict_id != conflict.id:
        raise NegotiationError("That solution does not belong to this conflict.")
    if solution.status not in (SolutionStatus.PROPOSED, SolutionStatus.SUPERSEDED):
        raise NegotiationError(f"That solution is {solution.status}; pick a proposed one.")
    if not solution.legal_compliant:
        raise NegotiationError("This solution breaks a legal protection rule, so it cannot be accepted.")
    species = _species(db, conflict)
    if wildlife_score(solution) < MIN_WILDLIFE_SCORE_TO_AGREE:
        raise NegotiationError(
            f"{species.representative.name if species.representative else 'The representative'} will not agree: "
            f"wildlife wellbeing is only {wildlife_score(solution):.0f}/100 (minimum {MIN_WILDLIFE_SCORE_TO_AGREE:.0f})."
        )
    solution.status = SolutionStatus.ACCEPTED
    for other in db.scalars(select(Solution).where(Solution.conflict_id == conflict.id, Solution.id != solution.id, Solution.status == SolutionStatus.PROPOSED)):
        other.status = SolutionStatus.REJECTED
    session.status = NegotiationStatus.AGREED
    session.accepted_solution_id = solution.id
    session.current_solution_id = solution.id
    conflict.status = ConflictStatus.AGREEMENT_PENDING
    _message(db, session, author_type="human", author_name=user.display_name, kind=MessageKind.ACCEPT,
             text=f"I accept '{solution.title}'.", user=user, solution=solution)
    v = Voice(species, species.representative)
    v.say("accept", seed="final", fact=species.facts[0] if species.facts else "")
    v.raw(f"Remember: our sensitive months are {format_months(species.sensitive_months)}, and I'll be watching from my {site_word(species)}.")
    v.ground_season()
    _rep_message(db, session, llm_voice.speak(v, "negotiation_accept"), MessageKind.REPRESENTATIVE_REPLY, solution)
    db.flush()
    return solution
