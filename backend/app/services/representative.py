"""The species representative's voice.

How it stays honest:
1. The *personality* (name, jokes, tone) comes from the Representative row.
2. Every *number or biological claim* is filled into a template from the
   Species row (buffer distance, sensitive months, diet...).
3. Each statement returns a `grounding` list that says exactly which data field
   each claim came from, so the UI can show "based on: breeding season May-Sep".

No language model is needed: templates are deterministic and testable.
"""

import hashlib
from typing import Any

from app.models import Representative, Species

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]
MONTHS_SHORT = [m[:3] for m in MONTHS]

DISCLAIMER = "The personality is fictional. Biological facts come from structured ecological data."

DEFAULT_PHRASEBOOK: dict[str, list[str]] = {
    "need.space": [
        "I need about {buffer_m} m of calm around my {site} during {months}. Below {min_buffer_m} m it stops working for us.",
    ],
    "need.time": [
        "{months} is our sensitive season. Big, noisy works then are a no-go for us.",
    ],
    "need.access": [
        "Please keep the way in and out of my {site} clear. A blocked door is no door at all.",
    ],
    "need.light": [
        "Bright lights near my home or my route are a real problem for me. Darker is kinder.",
    ],
    "need.noise": [
        "Loud noise close to my home really stresses my family.",
    ],
    "need.food": [
        "I eat {diet}, and I find it within about {range_m} m of home. Keep that menu growing!",
    ],
    "need.movement": [
        "I travel up to {range_m} m at night. I need safe crossings and gaps to get around.",
    ],
    "conflict": ["The sticking point, as I see it: {conflict}"],
    "compatible": ["Good news though: {compatible}"],
    "solution.high": ["A Coexistence Index of {index}? That's a neighbourhood I'd raise my young in."],
    "solution.mid": ["{index} out of 100. Not bad. I can live with it."],
    "solution.low": ["{index} out of 100. Hmm. That works for you much more than for us."],
    "accept": ["Deal! {fact}"],
    "concerns": [
        "I'll accept, but my wildlife score went from {old} to {new}. Please keep the rest of the plan exactly as promised.",
    ],
    "counter": ["I can't agree to that as it stands. {concern} My counter-offer: {offer}."],
    "reject": ["I can't agree to that. {reason}"],
    "sign": ["Signed with a {signature}. See you at the first review on {review}."],
    "refuse_sign": ["I won't sign a plan that leaves us at {score} out of 100."],
    "comment": ["Noted! {catchphrase}"],
    # Route negotiation (someone wants to walk, ride or drive past the home).
    "route.objection": ["Hold on! Your route runs {inside_m} m through the quiet zone around my {site}, and in {months} we need calm."],
    "route.thanks": ["The detour is only {extra_m} m longer, {extra_min}. Take it and we're good neighbours. {catchphrase}"],
    "route.too_long": ["I know the detour is {extra_m} m longer. Fine, use the short way, but please {conditions}."],
    "route.conditions": ["There's no way around my {site}, so pass by, but please {conditions}."],
}

SIGNATURES = {"bird": "feather", "mammal": "paw print", "insect": "tiny pollen smudge"}


def format_months(months: list[int] | None, short: bool = False) -> str:
    """[5,6,7,8,9] -> 'May-September'; [11,12,1,2,3] -> 'November-March'."""
    if not months:
        return "no particular months"
    names = MONTHS_SHORT if short else MONTHS
    present = sorted(set(int(m) for m in months))
    if len(present) == 12:
        return "all year"
    # Build circular runs of consecutive months.
    runs: list[list[int]] = []
    for m in present:
        if runs and m == runs[-1][-1] + 1:
            runs[-1].append(m)
        else:
            runs.append([m])
    if len(runs) > 1 and runs[0][0] == 1 and runs[-1][-1] == 12:
        runs[0] = runs.pop() + runs[0]
    parts = []
    for run in runs:
        if len(run) == 1:
            parts.append(names[run[0] - 1])
        else:
            parts.append(f"{names[run[0] - 1]}–{names[run[-1] - 1]}")
    return " and ".join(parts) if len(parts) <= 2 else ", ".join(parts[:-1]) + " and " + parts[-1]


SITE_WORDS = {"bat": "roost", "fox": "den"}


def site_word(species: Species) -> str:
    """'nest', 'roost' or 'den', for nicer sentences."""
    name = species.common_name.lower()
    for keyword, word in SITE_WORDS.items():
        if keyword in name:
            return word
    return "nest"


def _pick(options: list[str], seed: str) -> str:
    digest = hashlib.sha256(seed.encode()).digest()
    return options[digest[0] % len(options)]


def lower_name(species: Species) -> str:
    """'House martin' -> 'house martin', but 'European hedgehog' keeps its capital."""
    first, _, rest = species.common_name.partition(" ")
    word = first if first in {"European", "Eurasian"} else first.lower()
    return f"{word} {rest}".strip()


class _SafeDict(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


class Voice:
    """Speaks for one species. Collects lines and their grounding as it goes."""

    def __init__(self, species: Species, representative: Representative | None) -> None:
        self.species = species
        self.rep = representative
        self.lines: list[str] = []
        self.grounding: list[dict[str, Any]] = []

    # --- template plumbing -----------------------------------------------------
    def base_values(self) -> dict[str, Any]:
        s = self.species
        return {
            "species": s.common_name,
            "name": self.rep.name if self.rep else s.common_name,
            "site": site_word(s),
            "buffer_m": _num(s.preferred_buffer_m),
            "min_buffer_m": _num(s.min_buffer_m),
            "months": format_months(s.sensitive_months),
            "range_m": _num(s.foraging_range_m),
            "diet": ", ".join(s.diet) if s.diet else "whatever I can find",
            "fact": s.facts[0] if s.facts else "",
            "catchphrase": (self.rep.catchphrases[0] if self.rep and self.rep.catchphrases else ""),
            "signature": SIGNATURES.get(s.taxon_group, "mark"),
        }

    def template(self, key: str) -> list[str]:
        if self.rep and key in (self.rep.phrasebook or {}):
            return self.rep.phrasebook[key]
        return DEFAULT_PHRASEBOOK.get(key, ["{" + key + "}"])

    def say(self, key: str, seed: str = "", **values: Any) -> str:
        data = _SafeDict(self.base_values())
        data.update(values)
        line = _pick(self.template(key), f"{self.species.slug}:{key}:{seed}").format_map(data)
        self.lines.append(line)
        return line

    def ground(self, claim: str, source: str, value: Any) -> None:
        entry = {"claim": claim, "source": source, "value": value}
        if entry not in self.grounding:
            self.grounding.append(entry)

    def raw(self, line: str) -> None:
        self.lines.append(line)

    def statement(self, context: str) -> dict[str, Any]:
        return {
            "speaker": self.rep.name if self.rep else self.species.common_name,
            "title": self.rep.title if self.rep else None,
            "avatar": self.rep.avatar_emoji if self.rep else self.species.emoji,
            "species": self.species.common_name,
            "context": context,
            "lines": list(self.lines),
            "text": " ".join(self.lines),
            "grounding": list(self.grounding),
            "disclaimer": DISCLAIMER,
        }

    # --- standard groundings ----------------------------------------------------
    def ground_buffer(self) -> None:
        s = self.species
        self.ground(f"Preferred quiet distance: {_num(s.preferred_buffer_m)} m", "species.preferred_buffer_m", s.preferred_buffer_m)
        self.ground(f"Absolute minimum distance: {_num(s.min_buffer_m)} m", "species.min_buffer_m", s.min_buffer_m)

    def ground_season(self) -> None:
        s = self.species
        self.ground(f"Sensitive months: {format_months(s.sensitive_months)}", "species.sensitive_months", s.sensitive_months)

    def ground_legal(self) -> None:
        s = self.species
        if s.legal_protection:
            self.ground(s.legal_protection, "species.legal_protection", s.is_legally_protected)


def _num(value: float) -> str:
    return f"{value:g}"


# --- Ready-made statements ------------------------------------------------------

NEED_KEY_TO_PHRASE = {
    "undisturbed_site": "need.space",
    "seasonal_quiet": "need.time",
    "site_access": "need.access",
    "dark_skies": "need.light",
    "low_noise": "need.noise",
    "foraging_habitat": "need.food",
    "safe_passage": "need.movement",
}


def introduction(species: Species, rep: Representative | None) -> dict[str, Any]:
    voice = Voice(species, rep)
    voice.raw(rep.greeting if rep else f"Hello, I represent the {species.common_name}.")
    voice.say("need.space", seed="intro")
    voice.say("need.time", seed="intro")
    if species.facts:
        voice.raw(f"Fun fact: {species.facts[-1]}")
        voice.ground(species.facts[-1], "species.facts", None)
    voice.ground_buffer()
    voice.ground_season()
    voice.ground_legal()
    if rep:
        voice.raw(rep.sign_off)
    return voice.statement("introduction")


def needs_statement(
    species: Species,
    rep: Representative | None,
    wildlife_needs: list[dict[str, Any]],
    conflicts: list[dict[str, Any]],
    compatibilities: list[dict[str, Any]],
) -> dict[str, Any]:
    voice = Voice(species, rep)
    if rep:
        voice.raw(rep.greeting)
    top = sorted(wildlife_needs, key=lambda n: -n["importance"])[:3]
    for need in top:
        phrase = NEED_KEY_TO_PHRASE.get(need["key"])
        if phrase:
            voice.say(phrase, seed=need["key"], **{k: _num(v) if isinstance(v, float) else v for k, v in need.get("parameters", {}).items() if not isinstance(v, (list, dict))})
    if conflicts:
        worst = max(conflicts, key=lambda c: c["severity"])
        voice.say("conflict", seed="c", conflict=worst["explanation"])
    if compatibilities:
        voice.say("compatible", seed="ok", compatible=compatibilities[0]["explanation"])
    voice.ground_buffer()
    voice.ground_season()
    voice.ground_legal()
    if rep:
        voice.raw(rep.sign_off)
    return voice.statement("needs_assessment")


TOPICS: list[tuple[str, list[str]]] = [
    ("legal", ["legal", "law", "allowed", "illegal", "protected", "permit", "licen"]),
    ("safety", ["sting", "dangerous", "bite", "allerg", "safe", "attack", "disease"]),
    ("season", ["when", "month", "season", "how long", "leave", "until", "breed", "winter", "hibernat", "summer"]),
    ("distance", ["far", "distance", "close", "metre", "meter", "buffer", "space", "near", "room"]),
    ("light", ["light", "lamp", "dark", "bright"]),
    ("noise", ["noise", "loud", "quiet", "sound"]),
    ("food", ["eat", "food", "diet", "hungry", "insect", "mosquito"]),
    ("benefit", ["why should", "benefit", "good for", "useful", "what do you do"]),
]


def detect_topic(question: str) -> str:
    q = question.lower()
    for topic, words in TOPICS:
        if any(w in q for w in words):
            return topic
    return "fun_fact"


def answer_question(species: Species, rep: Representative | None, question: str) -> dict[str, Any]:
    """Answer a free-text question in character, using only structured data."""
    s = species
    voice = Voice(species, rep)
    topic = detect_topic(question)
    if topic == "legal":
        voice.raw(s.legal_protection or "There is no specific legal protection for us, but kindness is always legal.")
        voice.ground_legal()
    elif topic == "safety":
        safety_facts = [f for f in s.facts if any(w in f.lower() for w in ("sting", "bite"))]
        voice.raw(safety_facts[0] if safety_facts else f"We are {s.activity_pattern} and keep to ourselves if left in peace.")
        voice.ground(safety_facts[0] if safety_facts else s.activity_pattern, "species.facts" if safety_facts else "species.activity_pattern", None)
    elif topic == "season":
        voice.say("need.time", seed=question)
        for period in s.sensitive_periods:
            voice.raw(f"{period['name']}: {format_months(period['months'])}. {period.get('description', '')}".strip())
        voice.ground_season()
    elif topic == "distance":
        voice.say("need.space", seed=question)
        voice.ground_buffer()
    elif topic == "light":
        voice.say("need.light", seed=question)
        voice.ground(f"Light sensitivity {s.light_sensitivity}/5", "species.light_sensitivity", s.light_sensitivity)
    elif topic == "noise":
        voice.say("need.noise", seed=question)
        voice.ground(f"Noise sensitivity {s.noise_sensitivity}/5", "species.noise_sensitivity", s.noise_sensitivity)
    elif topic == "food":
        voice.say("need.food", seed=question)
        voice.ground(f"Diet: {', '.join(s.diet)}", "species.diet", s.diet)
    elif topic == "benefit":
        for service in s.ecosystem_services:
            voice.raw(service + ".")
            voice.ground(service, "species.ecosystem_services", None)
    else:
        fact = s.facts[int(hashlib.sha256(question.encode()).hexdigest(), 16) % len(s.facts)] if s.facts else s.common_name
        voice.raw(f"Fun fact: {fact}")
        voice.ground(fact, "species.facts", None)
    if rep and rep.catchphrases:
        voice.raw(_pick(rep.catchphrases, question))
    statement = voice.statement("question")
    statement["topic"] = topic
    return statement


def solution_comment(species: Species, rep: Representative | None, index: float, wildlife_score: float, legal_ok: bool, legal_notes: list[str]) -> dict[str, Any]:
    voice = Voice(species, rep)
    if not legal_ok:
        voice.say("reject", seed="sol", reason=" ".join(legal_notes) or "It breaks a protection rule.")
        voice.ground_legal()
    elif index >= 75:
        voice.say("solution.high", seed="sol", index=f"{index:.0f}")
    elif index >= 55:
        voice.say("solution.mid", seed="sol", index=f"{index:.0f}")
    else:
        voice.say("solution.low", seed="sol", index=f"{index:.0f}")
    voice.ground(f"Wildlife wellbeing score: {wildlife_score:.0f}/100", "coexistence_index.wildlife_wellbeing", round(wildlife_score, 1))
    return voice.statement("solution_review")
