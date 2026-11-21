"""Step 8: temporary coexistence agreements."""

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, get_or_404
from app.core import clock
from app.models import Agreement, Conflict, ConflictStatus, Solution, SolutionStatus
from app.schemas.negotiation import AgreementRead, SignRequest, TerminateRequest
from app.services import agreement_service

router = APIRouter(tags=["agreements"])


def agreement_read(agreement: Agreement) -> AgreementRead:
    agreement_service.refresh_status(agreement)
    item = AgreementRead.model_validate(agreement)
    item.days_remaining = max(0, (agreement.valid_until - clock.today()).days)
    return item


@router.post("/conflicts/{conflict_id}/agreement", response_model=AgreementRead, status_code=status.HTTP_201_CREATED)
def create_agreement(conflict_id: uuid.UUID, user: CurrentUser, db: DbSession):
    """Draft the agreement from the accepted solution (if accept didn't already do it)."""
    conflict = get_or_404(db, Conflict, conflict_id, "Conflict")
    if user.id != conflict.reporter_id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Only the reporter can do this")
    solution = db.scalars(select(Solution).where(Solution.conflict_id == conflict.id, Solution.status == SolutionStatus.ACCEPTED)).first()
    if solution is None:
        raise HTTPException(status_code=409, detail="Accept a solution first (POST /conflicts/{id}/negotiation/accept)")
    agreement = agreement_service.generate(db, conflict, solution)
    db.commit()
    return agreement_read(agreement)


@router.get("/agreements", response_model=list[AgreementRead])
def list_agreements(db: DbSession, status_: str | None = Query(None, alias="status")):
    query = select(Agreement).order_by(Agreement.created_at.desc())
    rows = [agreement_read(a) for a in db.scalars(query)]
    db.commit()  # persists lazy 'expired' status updates
    return [r for r in rows if status_ is None or r.status == status_]


@router.get("/agreements/{agreement_id}", response_model=AgreementRead)
def get_agreement(agreement_id: uuid.UUID, db: DbSession):
    item = agreement_read(get_or_404(db, Agreement, agreement_id, "Agreement"))
    db.commit()
    return item


@router.get("/agreements/{agreement_id}/markdown", response_class=PlainTextResponse)
def agreement_markdown(agreement_id: uuid.UUID, db: DbSession) -> PlainTextResponse:
    """The agreement as a Markdown document (print it or share it)."""
    agreement = get_or_404(db, Agreement, agreement_id, "Agreement")
    return PlainTextResponse(agreement.markdown, media_type="text/markdown; charset=utf-8")


@router.post("/agreements/{agreement_id}/sign", response_model=AgreementRead)
def sign_agreement(agreement_id: uuid.UUID, user: CurrentUser, db: DbSession, body: SignRequest | None = None):
    """Sign. When the reporter signs (the representative signs automatically), it becomes ACTIVE
    and its zones appear on the map as 'agreed coexistence zones'."""
    agreement = get_or_404(db, Agreement, agreement_id, "Agreement")
    agreement_service.sign(db, agreement, user, body.role if body else None)
    db.commit()
    return agreement_read(agreement)


@router.post("/agreements/{agreement_id}/terminate", response_model=AgreementRead)
def terminate_agreement(agreement_id: uuid.UUID, body: TerminateRequest, user: CurrentUser, db: DbSession):
    agreement = get_or_404(db, Agreement, agreement_id, "Agreement")
    agreement_service.terminate(db, agreement, user, body.reason)
    db.commit()
    return agreement_read(agreement)


__all__ = ["router", "agreement_read", "ConflictStatus"]
