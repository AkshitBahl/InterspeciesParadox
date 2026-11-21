"""Step 6: the Coexistence Index, a transparent 0-100 score for a solution.

The recipe (every number is returned so the UI can show its working):

    Wildlife wellbeing  = importance-weighted average of how well each wildlife need is met
    Human wellbeing     = the same for human needs
    Feasibility         = 40% cost vs budget + 30% time to implement + 30% effort
    Balance             = 100 - |Wildlife - Human|   (punishes one-sided "wins")

    Index = 0.30 x Wildlife + 0.30 x Human + 0.20 x Feasibility + 0.20 x Balance

Three safety gates can cap the result:
    * breaks a legal protection rule                      -> capped at 39
    * breaks an ecological minimum (e.g. too close to a den) -> capped at 49
    * breaks a hard human need (e.g. no step-free access)  -> capped at 49
"""

from typing import Any

DEFAULT_WEIGHTS = {"wildlife": 0.30, "human": 0.30, "feasibility": 0.20, "balance": 0.20}
LEGAL_CAP = 39.0
ECOLOGICAL_CAP = 49.0
HARD_CAP = 49.0
EFFORT_SCORES = {"low": 100.0, "medium": 75.0, "high": 50.0}

GRADES = [
    (80, "Thriving together", "🌿"),
    (65, "Good neighbours", "🤝"),
    (50, "Fragile truce", "⚖️"),
    (0, "Conflict persists", "⚠️"),
]


def grade(index: float) -> tuple[str, str]:
    for threshold, label, emoji in GRADES:
        if index >= threshold:
            return label, emoji
    return GRADES[-1][1], GRADES[-1][2]


def normalise_weights(weights: dict[str, float] | None) -> dict[str, float]:
    merged = dict(DEFAULT_WEIGHTS)
    if weights:
        merged.update({k: max(0.0, float(v)) for k, v in weights.items() if k in DEFAULT_WEIGHTS and v is not None})
    total = sum(merged.values()) or 1.0
    return {k: round(v / total, 4) for k, v in merged.items()}


def side_score(needs: list[dict[str, Any]], effects: dict[str, Any], side: str) -> tuple[float, list[dict[str, Any]]]:
    rows = []
    total_w = 0.0
    total = 0.0
    for need in needs:
        if need["side"] != side:
            continue
        baseline = float(need.get("baseline_satisfaction", 1.0))
        effect = effects.get(need["key"])
        sat = float(effect["satisfaction"]) if effect else baseline
        sat = max(0.0, min(1.0, sat))
        reason = effect["reason"] if effect else "Not changed by this solution."
        w = float(need["importance"])
        total_w += w
        total += w * sat
        rows.append(
            {
                "key": need["key"],
                "side": side,
                "label": need["label"],
                "importance": need["importance"],
                "baseline": round(baseline, 2),
                "satisfaction": round(sat, 2),
                "change": round(sat - baseline, 2),
                "reason": reason,
            }
        )
    score = 100.0 * total / total_w if total_w else 100.0
    return round(score, 1), rows


def feasibility_score(
    cost_eur: int, budget_eur: int | None, implementation_days: int, days_available: int | None, effort: str
) -> dict[str, Any]:
    if budget_eur is None:
        cost = 100.0 if cost_eur <= 500 else max(20.0, 100.0 - (cost_eur - 500) / 25)
    elif cost_eur <= budget_eur:
        cost = 100.0
    else:
        cost = max(0.0, 100.0 * (1 - (cost_eur - budget_eur) / max(budget_eur, 1)))
    if days_available is None:
        time = 100.0 if implementation_days <= 3 else max(40.0, 100.0 - 5 * (implementation_days - 3))
    elif implementation_days <= days_available:
        time = 100.0
    else:
        time = max(0.0, 100.0 - 10 * (implementation_days - days_available))
    effort_s = EFFORT_SCORES.get(effort, 75.0)
    total = 0.4 * cost + 0.3 * time + 0.3 * effort_s
    return {
        "score": round(total, 1),
        "cost_score": round(cost, 1),
        "time_score": round(time, 1),
        "effort_score": effort_s,
        "cost_eur": cost_eur,
        "budget_eur": budget_eur,
        "implementation_days": implementation_days,
        "days_available": days_available,
        "effort": effort,
    }


def compute_index(
    needs: list[dict[str, Any]],
    effects: dict[str, Any],
    *,
    cost_eur: int,
    budget_eur: int | None,
    effort: str,
    implementation_days: int,
    days_available: int | None,
    legal_compliant: bool,
    legal_notes: list[str] | None = None,
    hard_violations: list[str] | None = None,
    limit_violations: list[str] | None = None,
    weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    w = normalise_weights(weights)
    wildlife, wildlife_rows = side_score(needs, effects, "wildlife")
    human, human_rows = side_score(needs, effects, "human")
    feas = feasibility_score(cost_eur, budget_eur, implementation_days, days_available, effort)
    balance = round(100.0 - abs(wildlife - human), 1)

    components = [
        {
            "key": "wildlife_wellbeing",
            "label": "Wildlife wellbeing",
            "score": wildlife,
            "weight": w["wildlife"],
            "explanation": f"Importance-weighted average of {len(wildlife_rows)} wildlife needs.",
        },
        {
            "key": "human_wellbeing",
            "label": "Human wellbeing",
            "score": human,
            "weight": w["human"],
            "explanation": f"Importance-weighted average of {len(human_rows)} human needs.",
        },
        {
            "key": "feasibility",
            "label": "Feasibility",
            "score": feas["score"],
            "weight": w["feasibility"],
            "explanation": (
                f"Cost {feas['cost_score']:.0f}/100 ({cost_eur} EUR"
                + (f" vs {budget_eur} EUR budget" if budget_eur is not None else "")
                + f"), time {feas['time_score']:.0f}/100, effort {feas['effort_score']:.0f}/100 ({effort})."
            ),
        },
        {
            "key": "balance",
            "label": "Balance (fairness)",
            "score": balance,
            "weight": w["balance"],
            "explanation": "100 minus the gap between wildlife and human wellbeing.",
        },
    ]
    for c in components:
        c["contribution"] = round(c["score"] * c["weight"], 1)
    raw = round(sum(c["score"] * c["weight"] for c in components), 1)

    gates = []
    index = raw
    gates.append(
        {
            "type": "legal_protection",
            "passed": legal_compliant,
            "cap": None if legal_compliant else LEGAL_CAP,
            "notes": legal_notes or [],
        }
    )
    if not legal_compliant:
        index = min(index, LEGAL_CAP)
    limits = limit_violations or []
    gates.append({"type": "ecological_minimum", "passed": not limits, "cap": ECOLOGICAL_CAP if limits else None, "notes": limits})
    if limits:
        index = min(index, ECOLOGICAL_CAP)
    hard = hard_violations or []
    gates.append({"type": "hard_human_needs", "passed": not hard, "cap": HARD_CAP if hard else None, "notes": hard})
    if hard:
        index = min(index, HARD_CAP)

    label, emoji = grade(index)
    return {
        "index": round(index, 1),
        "raw_index": raw,
        "grade": label,
        "emoji": emoji,
        "formula": (
            f"Index = {w['wildlife']:.2f}×Wildlife + {w['human']:.2f}×Human + "
            f"{w['feasibility']:.2f}×Feasibility + {w['balance']:.2f}×Balance"
        ),
        "weights": w,
        "components": components,
        "needs": wildlife_rows + human_rows,
        "feasibility_details": feas,
        "gates": gates,
    }
