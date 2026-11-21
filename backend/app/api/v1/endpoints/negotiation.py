"""Step 7: negotiate with the species representative."""

import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession, get_or_404
from app.api.v1.endpoints.agreements import agreement_read
from app.models import Conflict, NegotiationSession, Solution, User
from app.schemas.negotiation import (
    AcceptRequest,
    AcceptResponse,
    CommentRequest,
    CounterProposalRequest,
    CounterProposalResponse,
    NegotiationMessageRead,
    NegotiationRead,
    OpenNegotiationRequest,
)
from app.schemas.solution import SolutionRead
from app.services import agreement_service, negotiation_service

router = APIRouter(prefix="/conflicts/{conflict_id}/negotiation", tags=["negotiation"])


def _read(db: DbSession, session: NegotiationSession, with_messages: bool = True) -> NegotiationRead:
    current = db.get(Solution, session.current_solution_id) if session.current_solution_id else None
    return NegotiationRead(
        id=session.id,
        conflict_id=session.conflict_id,
        status=session.status,
        rounds=session.rounds,
        current_solution_id=session.current_solution_id,
        accepted_solution_id=session.accepted_solution_id,
        current_solution=SolutionRead.model_validate(current) if current else None,
        messages=[NegotiationMessageRead.model_validate(m) for m in negotiation_service.messages(db, session)] if with_messages else [],
    )


def _session(db: DbSession, conflict: Conflict) -> NegotiationSession:
    session = negotiation_service.get_session(db, conflict)
    if session is None:
        raise HTTPException(status_code=404, detail="No negotiation yet: POST /conflicts/{id}/negotiation to open one")
    return session


def _reporter_only(conflict: Conflict, user: User) -> None:
    if user.id != conflict.reporter_id and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the reporter can accept a solution")


@router.post("", response_model=NegotiationRead, status_code=status.HTTP_201_CREATED)
def open_negotiation(conflict_id: uuid.UUID, db: DbSession, _: CurrentUser, body: OpenNegotiationRequest | None = None):
    """Open the negotiation (idempotent). The representative greets you and states its position."""
    conflict = get_or_404(db, Conflict, conflict_id, "Conflict")
    session = negotiation_service.open_session(db, conflict, body.solution_id if body else None)
    db.commit()
    return _read(db, session)


@router.get("", response_model=NegotiationRead)
def get_negotiation(conflict_id: uuid.UUID, db: DbSession):
    conflict = get_or_404(db, Conflict, conflict_id, "Conflict")
    return _read(db, _session(db, conflict))


@router.post("/messages", response_model=list[NegotiationMessageRead], status_code=status.HTTP_201_CREATED)
def send_message(conflict_id: uuid.UUID, body: CommentRequest, user: CurrentUser, db: DbSession):
    """Chat with the representative. It answers questions (when, how far, is it legal...) from the data."""
    conflict = get_or_404(db, Conflict, conflict_id, "Conflict")
    msgs = negotiation_service.post_comment(db, conflict, _session(db, conflict), user, body.message)
    db.commit()
    return msgs


@router.post("/counter-proposals", response_model=CounterProposalResponse, status_code=status.HTTP_201_CREATED)
def counter_proposal(conflict_id: uuid.UUID, body: CounterProposalRequest, user: CurrentUser, db: DbSession):
    """Revise a solution's parameters. See GET /solutions/{id}/parameters for what you can change.

    The representative answers with a verdict: accept, accept_with_concerns, counter (with its own
    offer) or reject.
    """
    conflict = get_or_404(db, Conflict, conflict_id, "Conflict")
    session = _session(db, conflict)
    try:
        result = negotiation_service.counter_proposal(db, conflict, session, user, body.solution_id, body.changes, body.message)
    except negotiation_service.NegotiationError:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.commit()
    return CounterProposalResponse(
        verdict=result["verdict"],
        revision=SolutionRead.model_validate(result["revision"]),
        counter_solution=SolutionRead.model_validate(result["counter_solution"]) if result["counter_solution"] else None,
        messages=[NegotiationMessageRead.model_validate(m) for m in result["messages"]],
        negotiation=_read(db, session, with_messages=False),
    )


@router.post("/accept", response_model=AcceptResponse)
def accept(conflict_id: uuid.UUID, body: AcceptRequest, user: CurrentUser, db: DbSession):
    """Accept a solution. By default a temporary coexistence agreement is drafted right away."""
    conflict = get_or_404(db, Conflict, conflict_id, "Conflict")
    _reporter_only(conflict, user)
    session = _session(db, conflict)
    solution = negotiation_service.accept(db, conflict, session, user, body.solution_id)
    agreement = agreement_service.generate(db, conflict, solution) if body.generate_agreement else None
    db.commit()
    return AcceptResponse(
        solution=SolutionRead.model_validate(solution),
        agreement=agreement_read(agreement) if agreement else None,
        negotiation=_read(db, session, with_messages=False),
    )
