"""HTTP access to public OpenStreetMap services (OSRM routing, Nominatim search).

Public demo servers have strict usage policies (Nominatim: max 1 request per
second, a real User-Agent, cache results). We respect that with a tiny cache
and throttle. Tests swap `client_factory` for a fake transport.
"""

import threading
import time
from collections.abc import Callable
from typing import Any

import httpx

from app.core.config import settings


class ExternalServiceError(Exception):
    pass


def _default_client() -> httpx.Client:
    return httpx.Client(
        timeout=settings.external_timeout_seconds,
        headers={"User-Agent": settings.geo_user_agent, "Accept-Language": "en"},
    )


client_factory: Callable[[], httpx.Client] = _default_client

_cache: dict[str, tuple[float, Any]] = {}
_cache_lock = threading.Lock()
_last_call: dict[str, float] = {}
CACHE_TTL_S = 3600.0


def get_json(url: str, params: dict[str, Any], *, min_interval_s: float = 0.0, service: str = "default") -> Any:
    key = url + "?" + "&".join(f"{k}={params[k]}" for k in sorted(params))
    now = time.monotonic()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < CACHE_TTL_S:
            return hit[1]
        wait = _last_call.get(service, 0.0) + min_interval_s - now
    if wait > 0:
        time.sleep(min(wait, 1.0))
    try:
        with client_factory() as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ExternalServiceError(f"{service} request failed: {exc}") from exc
    finally:
        with _cache_lock:
            _last_call[service] = time.monotonic()
    with _cache_lock:
        _cache[key] = (time.monotonic(), data)
    return data


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()
        _last_call.clear()
