"""Species data and their humorous representatives."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import DbSession
from app.core import clock
from app.models import Species
from app.schemas.common import Statement
from app.schemas.species import (
    AskRequest,
    CalendarMonth,
    SpeciesCalendar,
    SpeciesRead,
    SpeciesSummary,
)
from app.services import representative as voice
from app.services.representative import MONTHS

router = APIRouter(prefix="/species", tags=["species & representatives"])


def _get(db: DbSession, slug: str) -> Species:
    species = db.scalars(select(Species).where(Species.slug == slug)).first()
    if species is None:
        raise HTTPException(status_code=404, detail="Species not found")
    return species


def summary(species: Species) -> SpeciesSummary:
    item = SpeciesSummary.model_validate(species)
    item.sensitive_now = clock.today().month in species.sensitive_months
    item.representative_name = species.representative.name if species.representative else None
    return item


@router.get("", response_model=list[SpeciesSummary])
def list_species(db: DbSession) -> list[SpeciesSummary]:
    return [summary(s) for s in db.scalars(select(Species).order_by(Species.common_name))]


@router.get("/{slug}", response_model=SpeciesRead)
def get_species(slug: str, db: DbSession) -> SpeciesRead:
    species = _get(db, slug)
    item = SpeciesRead.model_validate(species)
    item.sensitive_now = clock.today().month in species.sensitive_months
    return item


@router.get("/{slug}/calendar", response_model=SpeciesCalendar)
def species_calendar(slug: str, db: DbSession) -> SpeciesCalendar:
    """Month by month: when is the species around, and when is it sensitive?"""
    s = _get(db, slug)
    months = [
        CalendarMonth(
            month=m,
            name=MONTHS[m - 1],
            active=m in s.active_months,
            sensitive=m in s.sensitive_months,
            periods=[p["name"] for p in s.sensitive_periods if m in p["months"]],
        )
        for m in range(1, 13)
    ]
    return SpeciesCalendar(species=s.common_name, today_month=clock.today().month, months=months)


@router.get("/{slug}/representative", response_model=Statement)
def representative_introduction(slug: str, db: DbSession) -> dict:
    """The representative introduces itself (personality is fictional, facts are grounded)."""
    s = _get(db, slug)
    return voice.introduction(s, s.representative)


@router.post("/{slug}/representative/ask", response_model=Statement)
def ask_representative(slug: str, body: AskRequest, db: DbSession) -> dict:
    """Ask the representative anything. It answers in character, using only structured data."""
    s = _get(db, slug)
    return voice.answer_question(s, s.representative, body.question)
