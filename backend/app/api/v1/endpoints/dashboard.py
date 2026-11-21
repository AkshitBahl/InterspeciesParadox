"""One call for the dashboard page."""

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import DbSession, OptionalUser
from app.core import clock
from app.models import (
    Agreement,
    AgreementStatus,
    Conflict,
    ConflictStatus,
    Solution,
    SolutionStatus,
    Species,
)
from app.services import agreement_service, seasons
from app.services.representative import format_months

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: DbSession, user: OptionalUser) -> dict:
    today = clock.today()
    conflicts = list(db.scalars(select(Conflict)))
    by_status = {s: 0 for s in ConflictStatus.ALL}
    for c in conflicts:
        by_status[c.status] = by_status.get(c.status, 0) + 1
    agreements = [agreement_service.refresh_status(a) for a in db.scalars(select(Agreement))]
    db.commit()
    active = [a for a in agreements if a.status == AgreementStatus.ACTIVE]
    best = list(db.scalars(
        select(Solution).where(Solution.status.in_([SolutionStatus.PROPOSED, SolutionStatus.ACCEPTED])).order_by(Solution.coexistence_index.desc()).limit(5)
    ))
    accepted = [s.coexistence_index for s in db.scalars(select(Solution).where(Solution.status == SolutionStatus.ACCEPTED))]
    seasons_now = []
    for s in db.scalars(select(Species).order_by(Species.common_name)):
        sensitive = today.month in s.sensitive_months
        change = seasons.end_of_season(s.sensitive_months, today) if sensitive else seasons.next_season_start(s.sensitive_months, today)
        seasons_now.append({
            "species": s.common_name, "slug": s.slug, "emoji": s.emoji, "sensitive_now": sensitive,
            "sensitive_months": format_months(s.sensitive_months),
            "next_change": change.isoformat() if change else None,
            "message": (f"Sensitive until {change:%d %b}" if sensitive else f"Sensitive again from {change:%d %b}") if change else "",
        })
    mine = []
    if user:
        mine = [{"id": str(c.id), "title": c.title, "status": c.status} for c in conflicts if c.reporter_id == user.id]
    return {
        "today": today.isoformat(),
        "conflicts_total": len(conflicts),
        "conflicts_by_status": by_status,
        "active_agreements": len(active),
        "agreements_ending_soon": [
            {"id": str(a.id), "title": a.title, "valid_until": a.valid_until.isoformat()} for a in active if (a.valid_until - today).days <= 30
        ],
        "average_accepted_index": round(sum(accepted) / len(accepted), 1) if accepted else None,
        "top_solutions": [{"id": str(s.id), "conflict_id": str(s.conflict_id), "title": s.title, "index": s.coexistence_index, "status": s.status} for s in best],
        "seasons": seasons_now,
        "my_conflicts": mine,
    }
