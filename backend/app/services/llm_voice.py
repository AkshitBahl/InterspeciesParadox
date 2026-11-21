"""A livelier voice for the representatives, from a free local LLM, kept honest.

The rules still decide everything (scores, legality, accept / counter / reject).
The LLM only changes the words:

1. `rewrite`: re-says a finished template statement in character, line by line.
2. `answer`: answers any question, using only the species' fact sheet, and says
   which facts it used (they become the statement's `grounding`).

Every reply is checked before it is used: same number of lines, no number or
month that isn't in the data, nothing like "as an AI". If the check fails, or
the LLM is off, unreachable or slow, the template statement is returned as it
was. `statement["voice"]` says which one you got, and why.
"""

import logging
import re
from dataclasses import dataclass
from typing import Any

from app.core import clock
from app.core.config import settings
from app.models import Representative, Species
from app.services import llm
from app.services.representative import MONTHS, Voice, format_months

log = logging.getLogger(__name__)

MAX_LINE_CHARS = 400
MAX_ANSWER_CHARS = 700


class CheckFailed(Exception):
    pass


# --- What the model may talk about ----------------------------------------------------

@dataclass(frozen=True)
class Fact:
    source: str  # the data field, e.g. "species.diet"
    label: str
    text: str
    value: Any


def _items(values: list[Any]) -> str:
    out = []
    for v in values or []:
        out.append(str(v.get("label") or v.get("key") or v) if isinstance(v, dict) else str(v))
    return "; ".join(out)


def _num(value: float) -> str:
    return f"{value:g}"


def fact_sheet(species: Species) -> list[Fact]:
    s = species
    today = clock.today()
    facts = [
        Fact("species.common_name", "Species", f"{s.common_name} ({s.scientific_name}), a {s.taxon_group}", s.common_name),
        Fact("species.conservation_status", "Conservation status (IUCN)", f"{s.conservation_status}, population {s.population_trend}", s.conservation_status),
        Fact("species.legal_protection", "Legal protection", s.legal_protection or "No specific legal protection", s.is_legally_protected),
        Fact("species.active_months", "Active months", format_months(s.active_months), s.active_months),
        Fact("species.sensitive_months", "Sensitive months", format_months(s.sensitive_months), s.sensitive_months),
        Fact("species.sensitive_periods", "Sensitive periods",
             "; ".join(f"{p['name']} ({format_months(p['months'])}): {p.get('description', '')}".strip() for p in s.sensitive_periods)
             or "none", [p["name"] for p in s.sensitive_periods]),
        Fact("species.activity_pattern", "Active at", s.activity_pattern, s.activity_pattern),
        Fact("species.preferred_buffer_m", "Preferred quiet distance", f"{_num(s.preferred_buffer_m)} m", s.preferred_buffer_m),
        Fact("species.min_buffer_m", "Absolute minimum distance", f"{_num(s.min_buffer_m)} m", s.min_buffer_m),
        Fact("species.noise_sensitivity", "Noise sensitivity", f"{s.noise_sensitivity} out of 5", s.noise_sensitivity),
        Fact("species.light_sensitivity", "Light sensitivity", f"{s.light_sensitivity} out of 5", s.light_sensitivity),
        Fact("species.foraging_range_m", "Foraging range", f"about {_num(s.foraging_range_m)} m from home", s.foraging_range_m),
        Fact("species.movement_mode", "Moves by", s.movement_mode.replace("_", " "), s.movement_mode),
        Fact("species.diet", "Diet", _items(s.diet) or "unknown", s.diet),
        Fact("species.habitat_requirements", "Needs in its habitat", _items(s.habitat_requirements) or "none listed", None),
        Fact("species.ecosystem_services", "What it does for the neighbourhood", _items(s.ecosystem_services) or "none listed", None),
        Fact("species.nuisances", "What people complain about", _items(s.nuisances) or "nothing", None),
        Fact("species.mitigations", "Known fixes", _items(s.mitigations) or "none listed", None),
        Fact("species.facts", "Facts", " ".join(s.facts) or "none", None),
        Fact("clock.today", "Today in the story", f"{today.isoformat()} ({MONTHS[today.month - 1]})", today.isoformat()),
    ]
    if s.data_note:
        facts.append(Fact("species.data_note", "Data note", s.data_note, None))
    return facts


# --- Prompts --------------------------------------------------------------------------

def persona(species: Species, rep: Representative | None) -> str:
    who = f"You are {rep.name}, {rep.title}," if rep else "You speak for"
    lines = [f"{who} the fictional representative of the {species.common_name} in a solarpunk Brussels neighbourhood in the year 2126."]
    if rep:
        lines.append(f"Personality: {rep.personality}")
        lines.append(f"Tone: {rep.tone}")
        if rep.catchphrases:
            lines.append("Catchphrases you like: " + " | ".join(rep.catchphrases))
    lines.append("You are funny and warm, but you take your family's needs seriously. "
                 "Speak in English, in the first person, as the animal. Never say you are an AI or a language model.")
    return "\n".join(lines)


REWRITE_RULES = """Rewrite the draft below in your own voice.
Rules:
- Re-say each draft line in character. Keep each line short (at most about 35 words).
- Keep every fact exactly as it is: the same numbers, units, months, names and decisions.
- Do not add any number, month, date or fact that is not in the draft.
- Never change a decision: if a line accepts, refuses or makes a counter-offer, yours does too.
- Return exactly {n} lines, in the same order.
- Answer with JSON only, like {{"lines": ["first line", "second line"]}}."""

ANSWER_RULES = """A neighbour asks you a question. Answer it in character, in 1 to 4 short sentences (at most 80 words).
Rules:
- Use only the facts in the fact sheet. Do not invent numbers, months, dates, laws or habits.
- If the fact sheet doesn't answer the question, say so with humour and share the closest useful fact.
- In "sources", list the fact names you used, exactly as written in the fact sheet (like "species.diet").
- Answer with JSON only, like {"answer": "...", "sources": ["species.diet"]}."""


# --- Checks ---------------------------------------------------------------------------

_THOUSANDS = re.compile(r"(?<=\d),(?=\d{3}\b)")
_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
_MONTH_WORDS = {name: i + 1 for i, name in enumerate(MONTHS)} | {name[:3]: i + 1 for i, name in enumerate(MONTHS)}
_MONTH_RE = re.compile(r"\b(" + "|".join(sorted(_MONTH_WORDS, key=len, reverse=True)) + r")\b")
_BANNED = re.compile(r"\b(as an ai|an ai\b|language model|chatgpt|openai)", re.IGNORECASE)


def _numbers(text: str) -> set[str]:
    return {_num(float(n.replace(",", "."))) for n in _NUMBER.findall(_THOUSANDS.sub("", text))}


def _months(text: str) -> set[int]:
    return {_MONTH_WORDS[m] for m in _MONTH_RE.findall(text)}


def check(reply: str, allowed_text: str, allowed_months: set[int], max_chars: int) -> None:
    """Raise CheckFailed if the reply says something the data doesn't."""
    if not reply.strip():
        raise CheckFailed("empty reply")
    if len(reply) > max_chars:
        raise CheckFailed("reply too long")
    if _BANNED.search(reply):
        raise CheckFailed("reply broke character")
    new_numbers = _numbers(reply) - _numbers(allowed_text)
    if new_numbers:
        raise CheckFailed(f"reply used numbers that are not in the data: {', '.join(sorted(new_numbers))}")
    new_months = _months(reply) - _months(allowed_text) - allowed_months
    if new_months:
        raise CheckFailed(f"reply named months that are not in the data: {', '.join(MONTHS[m - 1] for m in sorted(new_months))}")


def _species_months(species: Species) -> set[int]:
    months = {int(m) for m in (species.sensitive_months or []) + (species.active_months or [])}
    for period in species.sensitive_periods or []:
        months |= {int(m) for m in period.get("months", [])}
    return months


# --- Public API -----------------------------------------------------------------------

def _template(statement: dict[str, Any], reason: str) -> dict[str, Any]:
    out = dict(statement)
    out["voice"] = {"engine": "template", "reason": reason}
    return out


def _llm_voice(template_text: str) -> dict[str, Any]:
    return {"engine": "llm", "model": settings.llm_model, "template_text": template_text}


def rewrite(statement: dict[str, Any], species: Species, rep: Representative | None) -> dict[str, Any]:
    """Re-say a template statement in character. Facts, grounding and decisions stay the same."""
    if statement.get("voice"):
        return statement
    lines = [line for line in statement.get("lines", []) if line.strip()]
    reason = llm.unavailable_reason()
    if reason or not lines:
        return _template(statement, reason or "nothing to say")
    system = persona(species, rep)
    claims = "\n".join(f"- {g['claim']}" for g in statement.get("grounding", []))
    user = (
        REWRITE_RULES.format(n=len(lines))
        + "\n\nDraft lines:\n" + "\n".join(f"{i}. {line}" for i, line in enumerate(lines, 1))
        + ("\n\nFacts behind them (do not contradict):\n" + claims if claims else "")
    )
    allowed = "\n".join([system, *lines, claims, *(str(g.get("value")) for g in statement.get("grounding", []))])
    try:
        new = llm.chat_json(system, user).get("lines")
        if not isinstance(new, list) or not all(isinstance(x, str) for x in new):
            raise CheckFailed('no "lines" list in the reply')
        new = [x.strip() for x in new]
        if len(new) != len(lines):
            raise CheckFailed(f"expected {len(lines)} lines, got {len(new)}")
        for line in new:
            check(line, allowed, _species_months(species), MAX_LINE_CHARS)
    except (llm.LLMError, CheckFailed) as exc:
        log.info("LLM voice fell back to the template for %s: %s", species.slug, exc)
        return _template(statement, str(exc))
    out = dict(statement)
    out.update(lines=new, text=" ".join(new), voice=_llm_voice(statement.get("text", "")))
    return out


def speak(voice: Voice, context: str) -> dict[str, Any]:
    """`voice.statement(context)`, re-said by the LLM when it is available."""
    return rewrite(voice.statement(context), voice.species, voice.rep)


def answer(statement: dict[str, Any], species: Species, rep: Representative | None, question: str) -> dict[str, Any]:
    """Answer any question from the fact sheet. `statement` is the template answer to fall back on."""
    reason = llm.unavailable_reason()
    if reason:
        return _template(statement, reason)
    sheet = fact_sheet(species)
    by_source = {f.source: f for f in sheet}
    system = persona(species, rep)
    sheet_text = "\n".join(f"- {f.source} ({f.label}): {f.text}" for f in sheet)
    user = f"{ANSWER_RULES}\n\nFact sheet:\n{sheet_text}\n\nQuestion: {question}"
    allowed = "\n".join([system, sheet_text, question, statement.get("text", "")])
    try:
        data = llm.chat_json(system, user)
        reply, sources = data.get("answer"), data.get("sources")
        if not isinstance(reply, str):
            raise CheckFailed('no "answer" in the reply')
        reply = reply.strip()
        check(reply, allowed, _species_months(species), MAX_ANSWER_CHARS)
        cited = [by_source[s] for s in dict.fromkeys(sources or []) if isinstance(s, str) and s in by_source]
        if not cited:
            raise CheckFailed("the reply did not cite any fact from the sheet")
    except (llm.LLMError, CheckFailed) as exc:
        log.info("LLM answer fell back to the template for %s: %s", species.slug, exc)
        return _template(statement, str(exc))
    out = dict(statement)
    out.update(
        lines=[reply],
        text=reply,
        grounding=[{"claim": f"{f.label}: {f.text}", "source": f.source, "value": f.value} for f in cited],
        topic="open_question",
        voice=_llm_voice(statement.get("text", "")),
    )
    return out
