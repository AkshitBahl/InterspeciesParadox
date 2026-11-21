"""Step 8: the temporary coexistence agreement.

* Generated from an accepted solution.
* Temporary by design: it ends when the sensitive season (or the works window) ends.
* The representative signs automatically if the plan respects the ecological limits.
* It becomes ACTIVE when the reporter signs. Then its map features become part
  of the "current situation" and an "agreed coexistence zone" appears.
"""

import uuid
from datetime import date, timedelta
from typing import Any

from shapely.geometry import shape
from shapely.ops import unary_union
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import (
    Agreement,
    AgreementStatus,
    Conflict,
    ConflictStatus,
    FeatureStatus,
    MapFeature,
    Solution,
    SolutionStatus,
    Species,
    User,
)
from app.services import geo, seasons
from app.services.map_service import new_feature
from app.services.negotiation_service import MIN_WILDLIFE_SCORE_TO_AGREE, wildlife_score
from app.services.representative import SIGNATURES, format_months, lower_name, site_word

PARTY_LABELS = {
    "reporter": "Reporting resident",
    "residents": "Residents",
    "building_manager": "Building manager",
    "delivery_operator": "Delivery operator",
    "contractor": "Contractor",
    "ecologist": "Ecologist",
}


class AgreementError(ValueError):
    pass


def _validity(solution: Solution, species: Species, today: date) -> tuple[date, date]:
    months = solution.valid_months or species.sensitive_months
    end = seasons.end_of_season(months, today) or today + timedelta(days=90)
    if solution.strategy == "schedule_shift" and solution.parameters.get("new_start"):
        start = date.fromisoformat(solution.parameters["new_start"])
        end = start + timedelta(days=int(solution.parameters.get("duration_days", 7)) + 14)
    end = max(today + timedelta(days=30), min(end, today + timedelta(days=365)))
    return today, end


def _review_dates(start: date, end: date) -> list[str]:
    dates = []
    day = start + timedelta(days=28)
    while day < end and len(dates) < 6:
        dates.append(day.isoformat())
        day += timedelta(days=28)
    dates.append(end.isoformat())
    return dates


def generate(db: Session, conflict: Conflict, solution: Solution) -> Agreement:
    if solution.status != SolutionStatus.ACCEPTED:
        raise AgreementError("Only an accepted solution can become an agreement.")
    existing = db.scalars(select(Agreement).where(Agreement.solution_id == solution.id)).first()
    if existing:
        return existing
    species = db.get(Species, conflict.species_id)
    rep = species.representative
    reporter = db.get(User, conflict.reporter_id)
    today = clock.today()
    valid_from, valid_until = _validity(solution, species, today)
    reviews = _review_dates(valid_from, valid_until)

    parties = [
        {"type": "human", "role": "reporter", "label": PARTY_LABELS["reporter"], "name": reporter.display_name, "user_id": str(reporter.id)},
        {"type": "representative", "role": "species_representative", "label": "Species representative",
         "name": rep.name if rep else species.common_name, "species": species.common_name},
    ]
    for role in sorted({a.get("party") for a in solution.actions} - {"reporter", None}):
        parties.append({"type": "role", "role": role, "label": PARTY_LABELS.get(role, role.replace("_", " ").title()), "name": None})

    terms = [
        {"id": f"T{i}", "party": a.get("party"), "commitment": a.get("action"), "when": a.get("when"), "cost_eur": a.get("cost_eur")}
        for i, a in enumerate(solution.actions, start=1)
    ]
    expectations = [
        {"period": p["name"], "months": format_months(p["months"]), "description": p.get("description", ""), "source": "species.sensitive_periods"}
        for p in species.sensitive_periods
    ]
    expectations.append({
        "period": "End of the sensitive season",
        "months": format_months(species.sensitive_months),
        "description": f"After {valid_until:%d %B %Y} this agreement ends and can be reviewed for next season.",
        "source": "species.sensitive_months",
    })
    monitoring = [
        {"date": d, "check": f"Is the {site_word(species)} still in use? Are all terms being kept?", "by": reporter.display_name}
        for d in reviews
    ]

    signatures = []
    w = wildlife_score(solution)
    if solution.legal_compliant and w >= MIN_WILDLIFE_SCORE_TO_AGREE:
        signatures.append({
            "party": "species_representative",
            "name": rep.name if rep else species.common_name,
            "mark": f"{rep.avatar_emoji if rep else species.emoji} ({SIGNATURES.get(species.taxon_group, 'mark')})",
            "signed_at": clock.now().isoformat(),
        })

    agreement = Agreement(
        id=uuid.uuid4(),
        conflict_id=conflict.id,
        solution_id=solution.id,
        title=f"Temporary Coexistence Agreement: {conflict.title}",
        status=AgreementStatus.DRAFT,
        valid_from=valid_from,
        valid_until=valid_until,
        review_dates=reviews,
        parties=parties,
        terms=terms,
        wildlife_expectations=expectations,
        monitoring=monitoring,
        signatures=signatures,
        coexistence_index=solution.coexistence_index,
    )
    agreement.markdown = render_markdown(agreement, conflict, solution, species)
    db.add(agreement)
    db.flush()
    return agreement


def refresh_status(agreement: Agreement, today: date | None = None) -> Agreement:
    today = today or clock.today()
    if agreement.status == AgreementStatus.ACTIVE and today > agreement.valid_until:
        agreement.status = AgreementStatus.EXPIRED
    return agreement


def sign(db: Session, agreement: Agreement, user: User, role: str | None = None) -> Agreement:
    refresh_status(agreement)
    if agreement.status in (AgreementStatus.EXPIRED, AgreementStatus.TERMINATED):
        raise AgreementError(f"This agreement is {agreement.status}.")
    conflict = db.get(Conflict, agreement.conflict_id)
    is_reporter = user.id == conflict.reporter_id
    party = "reporter" if is_reporter else (role or "neighbour")
    if any(s.get("user_id") == str(user.id) for s in agreement.signatures):
        raise AgreementError("You already signed this agreement.")
    agreement.signatures = [
        *agreement.signatures,
        {"party": party, "name": user.display_name, "user_id": str(user.id), "mark": "✍️", "signed_at": clock.now().isoformat()},
    ]
    rep_signed = any(s["party"] == "species_representative" for s in agreement.signatures)
    if is_reporter and rep_signed and agreement.status == AgreementStatus.DRAFT:
        activate(db, agreement, conflict)
    agreement.markdown = render_markdown(agreement, conflict, db.get(Solution, agreement.solution_id), db.get(Species, conflict.species_id))
    db.flush()
    return agreement


def activate(db: Session, agreement: Agreement, conflict: Conflict) -> None:
    agreement.status = AgreementStatus.ACTIVE
    conflict.status = ConflictStatus.AGREED
    features = list(db.scalars(select(MapFeature).where(MapFeature.solution_id == agreement.solution_id)))
    for f in features:
        f.status = FeatureStatus.AGREED
        f.agreement_id = agreement.id
    polygons = [shape(f.geometry) for f in features if f.geometry["type"] in ("Polygon", "MultiPolygon")]
    species = db.get(Species, conflict.species_id)
    if polygons:
        zone_geom = geo.validate_geometry(dict(unary_union(polygons).convex_hull.__geo_interface__))
    else:
        zone_geom = geo.circle(conflict.lon, conflict.lat, species.preferred_buffer_m)
    db.add(
        new_feature(
            "agreed_zone",
            f"Agreed coexistence zone: {conflict.title}",
            zone_geom,
            properties={"valid_from": agreement.valid_from.isoformat(), "valid_until": agreement.valid_until.isoformat(), "coexistence_index": agreement.coexistence_index},
            status=FeatureStatus.AGREED,
            species_id=conflict.species_id,
            conflict_id=conflict.id,
            solution_id=agreement.solution_id,
            agreement_id=agreement.id,
        )
    )
    db.flush()


def terminate(db: Session, agreement: Agreement, user: User, reason: str) -> Agreement:
    conflict = db.get(Conflict, agreement.conflict_id)
    if user.id != conflict.reporter_id and not user.is_admin:
        raise AgreementError("Only the reporter or an admin can end an agreement early.")
    if agreement.status in (AgreementStatus.TERMINATED, AgreementStatus.EXPIRED):
        raise AgreementError(f"This agreement is already {agreement.status}.")
    agreement.status = AgreementStatus.TERMINATED
    agreement.terminated_reason = reason
    conflict.status = ConflictStatus.CLOSED
    conflict.closed_at = clock.now()
    agreement.markdown = render_markdown(agreement, conflict, db.get(Solution, agreement.solution_id), db.get(Species, conflict.species_id))
    db.flush()
    return agreement


def render_markdown(agreement: Agreement, conflict: Conflict, solution: Solution, species: Species) -> str:
    rep = species.representative
    breakdown = solution.index_breakdown or {}
    lines = [
        f"# {agreement.title}",
        "",
        f"**Status:** {agreement.status}  ",
        f"**Valid:** {agreement.valid_from:%d %B %Y} to {agreement.valid_until:%d %B %Y} (temporary)  ",
        f"**Coexistence Index:** {solution.coexistence_index:.0f}/100 ({breakdown.get('grade', '')} {breakdown.get('emoji', '')})",
        "",
        "## Parties",
    ]
    for p in agreement.parties:
        who = p.get("name") or "to be named"
        extra = f" for the {p['species']}" if p.get("species") else ""
        lines.append(f"- **{p['label']}**: {who}{extra}")
    lines += [
        "",
        "## Why this agreement exists",
        conflict.description or conflict.title,
        "",
        f"## The plan: {solution.title}",
        solution.summary,
        "",
        "## Commitments",
    ]
    for t in agreement.terms:
        cost = f" (about {t['cost_eur']} EUR)" if t.get("cost_eur") else ""
        lines.append(f"- **{t['id']}** · {PARTY_LABELS.get(t['party'], t['party'])}: {t['commitment']} _When: {t['when']}_{cost}")
    lines += ["", f"## What to expect from the {lower_name(species)}"]
    for e in agreement.wildlife_expectations:
        lines.append(f"- **{e['period']}** ({e['months']}): {e['description']}")
    lines += ["", "## Check-ins"]
    for m in agreement.monitoring:
        lines.append(f"- {m['date']}: {m['check']}")
    if solution.legal_notes:
        lines += ["", "## Legal notes"] + [f"- {n}" for n in solution.legal_notes]
    lines += ["", "## Signatures"]
    for s in agreement.signatures:
        lines.append(f"- {s['name']} ({s['party']}) {s.get('mark', '')} on {s['signed_at'][:10]}")
    if agreement.status == AgreementStatus.TERMINATED:
        lines += ["", f"_Ended early: {agreement.terminated_reason}_"]
    if rep:
        lines += ["", f"> {rep.sign_off} ({rep.name}, {rep.title})"]
    lines += ["", f"_{species.data_note}_" if species.data_note else ""]
    return "\n".join(lines).strip() + "\n"


def summary(agreement: Agreement) -> dict[str, Any]:
    return {"id": str(agreement.id), "title": agreement.title, "status": agreement.status, "valid_until": agreement.valid_until.isoformat()}
