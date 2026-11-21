"""Steps 3 and 4: assess the needs of both sides, then compare them.

Step by step:
1. Wildlife needs come from the species' ecological data (buffer distance,
   sensitive months, light sensitivity...).
2. Human needs come from the reporter's profile (mobility, allergies, budget...)
   and from the activity they reported (using a door, renovating a roof...).
3. Every (human need, wildlife need) pair is checked by a few clear rules.
   A rule can say "these clash, with severity 0-1, because..." or "these are
   compatible, because...".
4. Each need gets a *baseline satisfaction*: how well it is met if nobody does
   anything. The Coexistence Index later compares solutions against it.
"""

from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from typing import Any

from app.services import representative as voice
from app.services import seasons
from app.services.context import RECURRING_ACTIVITIES, MediationContext
from app.services.representative import format_months, lower_name, site_word


@dataclass
class Need:
    key: str
    side: str  # "human" | "wildlife"
    label: str
    description: str
    category: str
    importance: int  # 1-5
    flexibility: float  # 0 = non-negotiable ... 1 = very flexible
    is_legal_requirement: bool = False
    hard: bool = False
    parameters: dict[str, Any] = field(default_factory=dict)
    sources: list[str] = field(default_factory=list)
    baseline_satisfaction: float = 1.0

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


# --- 1. Wildlife needs ---------------------------------------------------------

def wildlife_needs(ctx: MediationContext) -> list[Need]:
    s = ctx.species
    site = site_word(s)
    months = format_months(s.sensitive_months)
    protected = s.is_legally_protected
    needs = [
        Need(
            key="undisturbed_site",
            side="wildlife",
            label=f"A calm zone around the {site}",
            description=f"Keep about {s.preferred_buffer_m:g} m of calm around the {site} during {months} (never less than {s.min_buffer_m:g} m).",
            category="space",
            importance=5 if protected else 4,
            flexibility=0.3,
            is_legal_requirement=protected,
            hard=True,
            parameters={"buffer_m": s.preferred_buffer_m, "min_buffer_m": s.min_buffer_m, "months": months},
            sources=["species.preferred_buffer_m", "species.min_buffer_m", "species.sensitive_months"],
        ),
        Need(
            key="seasonal_quiet",
            side="wildlife",
            label="No disruptive works in the sensitive season",
            description=f"Avoid noisy or destructive works during {months}.",
            category="time",
            importance=5 if protected else 3,
            flexibility=0.1 if protected else 0.4,
            is_legal_requirement=protected,
            hard=protected,
            parameters={"months": months, "periods": s.sensitive_periods},
            sources=["species.sensitive_months", "species.sensitive_periods", "species.legal_protection"],
        ),
        Need(
            key="site_access",
            side="wildlife",
            label=f"Clear access to the {site}",
            description=_access_text(s.movement_mode, site),
            category="access",
            importance=4,
            flexibility=0.2,
            parameters={"min_buffer_m": s.min_buffer_m},
            sources=["species.habitat_requirements", "species.movement_mode"],
        ),
        Need(
            key="foraging_habitat",
            side="wildlife",
            label="Food nearby",
            description=f"Feeding habitat within about {s.foraging_range_m:g} m ({', '.join(s.diet)}).",
            category="food",
            importance=3,
            flexibility=0.6,
            parameters={"range_m": s.foraging_range_m},
            sources=["species.foraging_range_m", "species.diet"],
        ),
    ]
    if s.light_sensitivity >= 3:
        needs.append(
            Need(
                key="dark_skies",
                side="wildlife",
                label="Darkness at night",
                description="Keep artificial light low near the site and along commuting routes.",
                category="light",
                importance=s.light_sensitivity,
                flexibility=0.4,
                parameters={"light_sensitivity": s.light_sensitivity},
                sources=["species.light_sensitivity"],
            )
        )
    if s.noise_sensitivity >= 3:
        needs.append(
            Need(
                key="low_noise",
                side="wildlife",
                label="Low noise near the site",
                description="Loud machinery and crowds near the site cause stress.",
                category="noise",
                importance=max(2, s.noise_sensitivity - 1),
                flexibility=0.5,
                parameters={"noise_sensitivity": s.noise_sensitivity},
                sources=["species.noise_sensitivity"],
            )
        )
    if s.movement_mode == "ground":
        needs.append(
            Need(
                key="safe_passage",
                side="wildlife",
                label="Safe passage between habitats",
                description=f"Safe crossings and fence gaps along a nightly range of about {s.foraging_range_m:g} m.",
                category="movement",
                importance=4,
                flexibility=0.4,
                parameters={"range_m": s.foraging_range_m},
                sources=["species.movement_mode", "species.habitat_requirements"],
            )
        )
    return needs


def _access_text(mode: str, site: str) -> str:
    return {
        "aerial": f"Keep the flight path into the {site} open (no scaffolding, nets or blocked eaves).",
        "ground": f"Keep the way into the {site} open (no blocked gaps, sheds or fences).",
        "flying_insect": f"Keep the entrance holes of the {site} uncovered and sunny.",
    }.get(mode, f"Keep the way into the {site} open.")


# --- 2. Human needs -------------------------------------------------------------

def human_needs(ctx: MediationContext) -> list[Need]:
    a, p, s = ctx.activity, ctx.profile, ctx.species
    kind = ctx.activity_type
    needs: list[Need] = []
    priorities = (p.priorities if p else {}) or {}
    used = ctx.spatial.get("used_entrance") or {}

    if kind in ("entrance_use", "commute"):
        needs.append(
            Need(
                key="access_route",
                side="human",
                label="Convenient daily access",
                description=f"Use {used.get('name', 'the usual route')} every day without long detours.",
                category="access",
                importance=5 if kind == "entrance_use" else 4,
                flexibility=0.5 if ctx.spatial.get("alternative_entrances") else 0.2,
                parameters={"entrance": used.get("name"), "daily_hours": a.get("daily_hours", [])},
                sources=["conflict.human_activity.type", "map.entrance"],
            )
        )
    if kind == "deliveries":
        needs.append(
            Need(
                key="delivery_access",
                side="human",
                label="Reliable deliveries",
                description="Deliveries keep reaching homes on time.",
                category="access",
                importance=4,
                flexibility=0.5,
                parameters={"daily_hours": a.get("daily_hours", [])},
                sources=["conflict.human_activity"],
            )
        )
    if ctx.is_works:
        start, end = ctx.planned_start, ctx.planned_end
        needs.append(
            Need(
                key="works_schedule",
                side="human",
                label="Get the work done on time",
                description=(
                    f"Carry out {a.get('description') or kind.replace('_', ' ')}"
                    + (f" from {start} to {end}" if start and end else "")
                    + f", with {ctx.flexibility_weeks} weeks of flexibility."
                ),
                category="time",
                importance=4,
                flexibility=min(1.0, ctx.flexibility_weeks / 12),
                parameters={
                    "planned_start": start.isoformat() if start else None,
                    "planned_end": end.isoformat() if end else None,
                    "flexibility_weeks": ctx.flexibility_weeks,
                },
                sources=["conflict.human_activity.planned_start", "conflict.human_activity.flexibility_weeks"],
            )
        )
    if kind == "space_use":
        needs.append(
            Need(
                key="space_use",
                side="human",
                label="Use my outdoor space",
                description=f"Keep using {a.get('description') or 'the shared space'} comfortably.",
                category="space",
                importance=4,
                flexibility=0.4,
                parameters={"space": a.get("description")},
                sources=["conflict.human_activity"],
            )
        )

    if p and p.mobility_needs and kind in ("entrance_use", "commute", "space_use"):
        needs.append(
            Need(
                key="step_free_access",
                side="human",
                label="Step-free access",
                description=f"Needs step-free routes ({', '.join(p.mobility_needs)}).",
                category="access",
                importance=5,
                flexibility=0.0,
                hard=True,
                parameters={"mobility_needs": p.mobility_needs},
                sources=["profile.mobility_needs"],
            )
        )
    if p and "bee_sting" in (p.allergies or []) and s.taxon_group == "insect":
        needs.append(
            Need(
                key="sting_safety",
                side="human",
                label="Feel safe from stings",
                description="Has a bee-sting allergy and wants to avoid close contact.",
                category="safety",
                importance=5,
                flexibility=0.2,
                parameters={"allergies": p.allergies},
                sources=["profile.allergies"],
            )
        )
    elif p and p.wildlife_comfort <= 2:
        needs.append(
            Need(
                key="peace_of_mind",
                side="human",
                label="Feel at ease near wildlife",
                description="Feels nervous about animals close to home.",
                category="safety",
                importance=6 - p.wildlife_comfort,
                flexibility=0.4,
                parameters={"wildlife_comfort": p.wildlife_comfort},
                sources=["profile.wildlife_comfort"],
            )
        )
    if s.nuisances and kind in ("entrance_use", "space_use", "commute"):
        needs.append(
            Need(
                key="nuisance_free",
                side="human",
                label="A clean, pleasant space",
                description=f"No {', '.join(s.nuisances)} where people walk or sit.",
                category="comfort",
                importance=3,
                flexibility=0.5,
                parameters={"nuisances": s.nuisances},
                sources=["species.nuisances"],
            )
        )
    if (p and p.needs_night_lighting) or ctx.spatial.get("lit_routes_nearby") and s.light_sensitivity >= 4:
        needs.append(
            Need(
                key="night_lighting",
                side="human",
                label="Feel safe after dark",
                description="Wants paths and doors lit at night.",
                category="light",
                importance=4 if p and p.needs_night_lighting else 3,
                flexibility=0.5,
                sources=["profile.needs_night_lighting", "map.human_route.lighting"],
            )
        )
    if ctx.budget_eur is not None:
        needs.append(
            Need(
                key="budget_limit",
                side="human",
                label="Stay within budget",
                description=f"Keep extra costs under {ctx.budget_eur} EUR.",
                category="cost",
                importance=int(priorities.get("cost", 3)),
                flexibility=0.3,
                parameters={"budget_eur": ctx.budget_eur},
                sources=["conflict.human_activity.budget_eur", "profile.budget_eur"],
            )
        )
    if p and (int(priorities.get("nature", 3)) >= 4 or p.wildlife_comfort >= 4):
        needs.append(
            Need(
                key="green_living",
                side="human",
                label="A greener neighbourhood",
                description="Enjoys nature and wants more of it around home.",
                category="nature",
                importance=2,
                flexibility=1.0,
                sources=["profile.priorities.nature", "profile.wildlife_comfort"],
            )
        )
    return needs


# --- 3. Pair rules ----------------------------------------------------------------

Rule = Callable[[Need, Need, MediationContext], dict[str, Any] | None]


def _pair(kind: str, h: Need, w: Need, severity: float, explanation: str, **evidence: Any) -> dict[str, Any]:
    return {
        "type": kind,
        "human_need": h.key,
        "wildlife_need": w.key,
        "severity": round(max(0.0, min(1.0, severity)), 2),
        "explanation": explanation,
        "evidence": evidence,
    }


def _season_note(ctx: MediationContext) -> str:
    months = format_months(ctx.species.sensitive_months)
    return f"(sensitive season {months}, {'active now' if ctx.in_season else 'not active today'})"


def rule_access_vs_site(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if h.key not in ("access_route", "delivery_access") or w.key != "undisturbed_site":
        return None
    sp = ctx.spatial
    buffer_m = sp["buffer_m"]
    site = site_word(ctx.species)
    if h.key == "access_route" and sp.get("used_entrance"):
        d = sp["used_entrance"]["distance_m"]
        name = sp["used_entrance"]["name"]
    else:
        layer = "delivery_route" if h.key == "delivery_access" else "human_route"
        routes = [r for r in sp["routes_in_buffer"] if r["layer"] == layer]
        if not routes:
            return None
        d, name = routes[0]["distance_m"], routes[0]["name"]
    if d >= buffer_m:
        return None
    return _pair(
        "conflict", h, w, max(0.3, 1 - d / buffer_m),
        f"{name} is only {d:.1f} m from the {site}, inside the {buffer_m:g} m quiet zone {_season_note(ctx)}.",
        distance_m=d, buffer_m=buffer_m,
    )


def rule_access_vs_flightpath(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if h.key != "access_route" or w.key != "site_access":
        return None
    used = ctx.spatial.get("used_entrance")
    if not used or used["distance_m"] >= ctx.species.min_buffer_m * 1.5:
        return None
    return _pair(
        "conflict", h, w, 0.5,
        f"People pass right under the way in and out of the {site_word(ctx.species)} ({used['distance_m']:.1f} m).",
        distance_m=used["distance_m"],
    )


def rule_crossing(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if w.key != "safe_passage" or h.key not in ("delivery_access", "access_route"):
        return None
    layer = "delivery_route" if h.key == "delivery_access" else "human_route"
    hits = [c for c in ctx.spatial["corridor_crossings"] if c["route_layer"] == layer]
    if not hits:
        return None
    night = ctx.species.activity_pattern in ("nocturnal", "crepuscular")
    hours = ctx.activity.get("daily_hours") or [hits[0].get("route_hours")]
    at_night = any(_is_night(hr) for hr in hours if hr)
    severity = 0.8 if (night and at_night) else 0.45
    return _pair(
        "conflict", h, w, severity,
        f"{hits[0]['route_name']} crosses {hits[0]['corridor_name']}"
        + (" at night, exactly when the animals are on the move." if night and at_night else "."),
        crossings=len(hits),
    )


def _is_night(hours: str) -> bool:
    """'21:00-06:00' -> True if any part of the range is between 21:00 and 06:00."""
    try:
        start, end = hours.split("-")
        sh, eh = int(start.split(":")[0]), int(end.split(":")[0])
    except (ValueError, AttributeError):
        return False
    if sh > eh:  # wraps midnight
        return True
    return sh >= 21 or sh < 6 or eh > 21 or eh <= 6


def rule_works_vs_season(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if h.key != "works_schedule" or w.key not in ("seasonal_quiet", "undisturbed_site", "low_noise"):
        return None
    start, end = ctx.planned_start, ctx.planned_end
    if not start or not end:
        return None
    frac = seasons.overlap_fraction(start, end, ctx.species.sensitive_months)
    d = ctx.spatial["activity_distance_m"]
    near = d <= max(2 * ctx.species.preferred_buffer_m, 20)
    if frac <= 0 or (w.key != "seasonal_quiet" and not near):
        return None
    if w.key == "undisturbed_site":
        severity = frac * max(0.4, 1 - d / max(ctx.species.preferred_buffer_m * 2, 1))
        text = f"The works happen {d:.0f} m from the {site_word(ctx.species)} while it is in use."
    elif w.key == "low_noise":
        severity = 0.5 * frac
        text = "Machinery noise during the works will stress the animals."
    else:
        severity = max(frac, 0.6 if ctx.species.is_legally_protected else 0.3) if near else frac * 0.5
        text = (
            f"The planned works ({start} to {end}) fall {frac:.0%} inside the sensitive season "
            f"({format_months(ctx.species.sensitive_months)})."
        )
    return _pair("conflict", h, w, severity, text, overlap_fraction=round(frac, 2), distance_m=d)


def rule_space_vs_site(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if h.key != "space_use" or w.key != "undisturbed_site":
        return None
    d = ctx.spatial["activity_distance_m"]
    reach = max(ctx.species.preferred_buffer_m * 4, 6)
    if d > reach:
        return None
    return _pair(
        "conflict", h, w, 0.6 if d < ctx.species.preferred_buffer_m * 2 else 0.4,
        f"The space people want to use is {d:.1f} m from the {site_word(ctx.species)}.",
        distance_m=d,
    )


def rule_fear_vs_site(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if w.key != "undisturbed_site" or h.key not in ("sting_safety", "peace_of_mind"):
        return None
    if h.key == "sting_safety":
        low = getattr(ctx.species, "sting_risk", None) == "very_low" or "sting" in " ".join(ctx.species.facts).lower()
        return _pair(
            "conflict", h, w, 0.45 if low else 0.8,
            "A sting allergy makes living close to the nest stressful"
            + (", even though the ecological data says stings are very rare." if low else "."),
        )
    comfort = (ctx.profile.wildlife_comfort if ctx.profile else 3) or 3
    return _pair("conflict", h, w, 0.2 * (4 - comfort), "Living this close to wild animals makes the resident uneasy.")


def rule_nuisance(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if h.key != "nuisance_free" or w.key != "undisturbed_site":
        return None
    d = ctx.spatial["activity_distance_m"]
    if d > ctx.species.preferred_buffer_m * 4:
        return None
    return _pair(
        "conflict", h, w, 0.4,
        f"Residents are bothered by {', '.join(ctx.species.nuisances)} near where they walk or sit.",
    )


def rule_light(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if h.key != "night_lighting" or w.key != "dark_skies":
        return None
    lit = ctx.spatial["lit_routes_nearby"]
    return _pair(
        "conflict", h, w, ctx.species.light_sensitivity / 5 * (0.8 if lit else 0.5),
        "Humans want bright lights at night, but this species avoids lit areas"
        + (f" ({lit[0]['name']} is lit brightly {lit[0]['distance_m']:.0f} m away)." if lit else "."),
        lit_routes=len(lit),
    )


# Compatibility rules ------------------------------------------------------------

def compat_green(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if h.key != "green_living" or w.key != "foraging_habitat":
        return None
    return _pair(
        "compatible", h, w, 0.0,
        f"Both sides want more greenery: native plants feed the {lower_name(ctx.species)} ({', '.join(ctx.species.diet)}).",
    )


def compat_flexible_schedule(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if h.key != "works_schedule" or w.key != "seasonal_quiet" or not ctx.planned_start or not ctx.planned_end:
        return None
    duration = (ctx.planned_end - ctx.planned_start).days + 1
    window = seasons.next_window_outside(ctx.species.sensitive_months, max(ctx.planned_start, ctx.today), duration)
    if window is None:
        return None
    delay_weeks = max(0, (window - ctx.planned_start).days) / 7
    if delay_weeks > ctx.flexibility_weeks:
        return None
    return _pair(
        "compatible", h, w, 0.0,
        f"The {ctx.flexibility_weeks} weeks of flexibility are enough to start on {window}, outside the sensitive season.",
        window_start=window.isoformat(), delay_weeks=round(delay_weeks, 1),
    )


def compat_alternative_entrance(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if h.key != "access_route" or w.key != "undisturbed_site" or not ctx.spatial.get("alternative_entrances"):
        return None
    alt = ctx.spatial["alternative_entrances"][0]
    steps = "" if alt.get("step_free", True) else f" (note: {alt.get('note') or 'not step-free'})"
    return _pair(
        "compatible", h, w, 0.0,
        f"{alt['name']} is {alt['distance_m']:.0f} m from the {site_word(ctx.species)}, outside the quiet zone{steps}.",
        alternative_entrance=alt["id"],
    )


def compat_nuisance_mitigation(h: Need, w: Need, ctx: MediationContext) -> dict[str, Any] | None:
    if h.key != "nuisance_free" or w.key != "undisturbed_site":
        return None
    fixes = [m for m in ctx.species.mitigations if m.get("solves_nuisance") in ctx.species.nuisances]
    if not fixes:
        return None
    return _pair(
        "compatible", h, w, 0.0,
        f"A {fixes[0]['label'].lower()} solves the {fixes[0]['solves_nuisance']} problem without touching the {site_word(ctx.species)}.",
        mitigation=fixes[0]["key"],
    )


RULES: list[Rule] = [
    rule_access_vs_site,
    rule_access_vs_flightpath,
    rule_crossing,
    rule_works_vs_season,
    rule_space_vs_site,
    rule_fear_vs_site,
    rule_nuisance,
    rule_light,
    compat_green,
    compat_flexible_schedule,
    compat_alternative_entrance,
    compat_nuisance_mitigation,
]


# --- 4. Put it together -------------------------------------------------------------

def assess(ctx: MediationContext) -> dict[str, Any]:
    humans = human_needs(ctx)
    animals = wildlife_needs(ctx)
    pairs = [result for h in humans for w in animals for rule in RULES if (result := rule(h, w, ctx))]
    conflicts = sorted([p for p in pairs if p["type"] == "conflict"], key=lambda p: -p["severity"])
    compatible = [p for p in pairs if p["type"] == "compatible"]

    # Baseline satisfaction = 1 - worst conflict that touches the need.
    for need in humans + animals:
        field_name = "human_need" if need.side == "human" else "wildlife_need"
        worst = max((c["severity"] for c in conflicts if c[field_name] == need.key), default=0.0)
        need.baseline_satisfaction = round(1 - worst, 2)
    # Doing nothing about works in a protected season is the worst outcome for wildlife.
    if ctx.is_works and any(c["wildlife_need"] == "seasonal_quiet" for c in conflicts) and ctx.species.is_legally_protected:
        for need in animals:
            if need.key in ("seasonal_quiet", "undisturbed_site"):
                need.baseline_satisfaction = min(need.baseline_satisfaction, 0.2)

    constraints = _constraints(ctx, humans)
    co_benefits = [
        {"benefit": text, "source": "species.ecosystem_services"} for text in ctx.species.ecosystem_services
    ]
    intensity = round(max((c["severity"] for c in conflicts), default=0.0), 2)
    summary = _summary(ctx, conflicts, compatible, intensity)
    statement = voice.needs_statement(ctx.species, ctx.representative, [n.as_dict() for n in animals], conflicts, compatible)
    return {
        "human_needs": [n.as_dict() for n in humans],
        "wildlife_needs": [n.as_dict() for n in animals],
        "conflicting_needs": conflicts,
        "compatible_needs": compatible,
        "constraints": constraints,
        "co_benefits": co_benefits,
        "spatial_context": ctx.spatial,
        "conflict_intensity": intensity,
        "summary": summary,
        "representative_statement": statement,
    }


def _constraints(ctx: MediationContext, humans: list[Need]) -> list[dict[str, Any]]:
    s = ctx.species
    out = []
    if s.is_legally_protected:
        out.append({"type": "legal", "text": s.legal_protection, "source": "species.legal_protection"})
    out.append(
        {
            "type": "ecological_minimum",
            "text": f"Never closer than {s.min_buffer_m:g} m to the {site_word(s)} during {format_months(s.sensitive_months)}.",
            "source": "species.min_buffer_m",
        }
    )
    for need in humans:
        if need.hard:
            out.append({"type": "accessibility", "text": need.description, "source": need.sources[0]})
        if need.key == "budget_limit":
            out.append({"type": "budget", "text": need.description, "source": need.sources[0]})
    return out


def _summary(ctx: MediationContext, conflicts: list[dict], compatible: list[dict], intensity: float) -> str:
    s = ctx.species
    level = "high" if intensity >= 0.7 else "moderate" if intensity >= 0.4 else "low"
    season = "is active right now" if ctx.in_season else "is not active today"
    parts = [
        f"{len(conflicts)} clashing and {len(compatible)} compatible need pairs found. Conflict intensity is {level} ({intensity:.2f}).",
        f"The {lower_name(s)} sensitive season ({format_months(s.sensitive_months)}) {season}.",
    ]
    if conflicts:
        parts.append(f"Main issue: {conflicts[0]['explanation']}")
    if compatible:
        parts.append(f"Common ground: {compatible[0]['explanation']}")
    if ctx.activity_type in RECURRING_ACTIVITIES:
        parts.append("Because the human activity happens every day, the fix must work all season long.")
    return " ".join(parts)
