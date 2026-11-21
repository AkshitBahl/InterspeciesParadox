"""One place that answers "what day is it?".

The platform is a 2126 simulation, so by default "today" is a simulated date
(see `Settings.simulated_today`). Everything seasonal (is the nest active? is
the agreement expired?) asks this module, which also makes tests deterministic.
"""

from datetime import UTC, date, datetime

from app.core.config import settings

_override: date | None = None


def today() -> date:
    if _override is not None:
        return _override
    if settings.simulated_today is not None:
        return settings.simulated_today
    return datetime.now(UTC).date()


def now() -> datetime:
    """Real wall-clock time (used for timestamps and token expiry)."""
    return datetime.now(UTC)


def set_today(value: date | None) -> None:
    """Override the simulated date (used by tests)."""
    global _override
    _override = value
