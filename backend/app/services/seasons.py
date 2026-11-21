"""Calendar helpers for seasonal rules (breeding, hibernation...)."""

from datetime import date, timedelta


def months_between(start: date, end: date) -> list[int]:
    """Calendar months touched by the period [start, end] (in order, no repeats)."""
    if end < start:
        start, end = end, start
    months: list[int] = []
    current = date(start.year, start.month, 1)
    while current <= end:
        if current.month not in months:
            months.append(current.month)
        current = date(current.year + (current.month // 12), current.month % 12 + 1, 1)
    return months


def days_in_months(start: date, end: date, months: list[int]) -> int:
    """How many days of [start, end] fall inside the given months."""
    wanted = set(months)
    total = 0
    day = start
    while day <= end:
        if day.month in wanted:
            total += 1
        day += timedelta(days=1)
    return total


def overlap_fraction(start: date, end: date, months: list[int]) -> float:
    span = (end - start).days + 1
    return 0.0 if span <= 0 else days_in_months(start, end, months) / span


def next_window_outside(months: list[int], earliest: date, duration_days: int, horizon_days: int = 730) -> date | None:
    """Earliest start date >= `earliest` so that the whole period avoids `months`."""
    blocked = set(months)
    if len(blocked) >= 12:
        return None
    duration_days = max(1, duration_days)
    start = earliest
    limit = earliest + timedelta(days=horizon_days)
    while start <= limit:
        end = start + timedelta(days=duration_days - 1)
        bad = next((d for d in _days(start, end) if d.month in blocked), None)
        if bad is None:
            return start
        # Jump to the first day after the blocked run that contains `bad`.
        start = bad + timedelta(days=1)
        while start.month in blocked:
            start += timedelta(days=1)
    return None


def _days(start: date, end: date):
    day = start
    while day <= end:
        yield day
        day += timedelta(days=1)


def end_of_season(months: list[int], today: date) -> date | None:
    """Last day of the run of `months` that contains today (or the next one)."""
    wanted = set(months)
    if not wanted:
        return None
    day = today
    # Move forward to the season if we are not in it yet.
    for _ in range(370):
        if day.month in wanted:
            break
        day += timedelta(days=1)
    else:
        return None
    for _ in range(370):
        nxt = day + timedelta(days=1)
        if nxt.month not in wanted:
            return day
        day = nxt
    return day


def next_season_start(months: list[int], today: date) -> date | None:
    """First day of the next sensitive run strictly after today's run."""
    wanted = set(months)
    if not wanted or len(wanted) >= 12:
        return None
    day = today
    in_season = day.month in wanted
    for _ in range(740):
        day += timedelta(days=1)
        if day.month in wanted and not in_season:
            return day
        in_season = day.month in wanted
    return None
