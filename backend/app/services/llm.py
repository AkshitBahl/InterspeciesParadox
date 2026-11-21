"""A tiny client for a free, local LLM (Ollama by default).

It speaks the common OpenAI-style chat format (POST {LLM_BASE_URL}/chat/completions),
so any compatible server works: Ollama, LM Studio, llama.cpp's server...

Replies are cached for LLM_CACHE_SECONDS (default 2 minutes): asking the same
thing again right away is instant, and later you get a fresh, different reply.

Nothing depends on it. When it is off, unreachable or slow, `LLMError` is raised
and callers keep their template text. After a connection failure we wait
`COOLDOWN_S` before trying again, so a stopped Ollama doesn't slow every request.
Tests swap `client_factory` for a fake transport.
"""

import contextlib
import contextvars
import hashlib
import json
import re
import threading
import time
from collections.abc import Callable, Iterator
from typing import Any

import httpx

from app.core.config import settings


class LLMError(Exception):
    pass


def _default_client() -> httpx.Client:
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"} if settings.llm_api_key else {}
    return httpx.Client(timeout=settings.llm_timeout_seconds, headers=headers)


client_factory: Callable[[], httpx.Client] = _default_client

COOLDOWN_S = 30.0
CACHE_MAX = 500

_lock = threading.Lock()
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_down_until = 0.0
_paused: contextvars.ContextVar[bool] = contextvars.ContextVar("llm_paused", default=False)


@contextlib.contextmanager
def paused() -> Iterator[None]:
    """No LLM calls inside this block (used while seeding, so it stays fast and repeatable)."""
    token = _paused.set(True)
    try:
        yield
    finally:
        _paused.reset(token)


def reset() -> None:
    """Forget cached replies and any cooldown (tests, or after starting Ollama)."""
    global _down_until
    with _lock:
        _cache.clear()
        _down_until = 0.0


def _base() -> str:
    return settings.llm_base_url.rstrip("/")


def _mark_down() -> None:
    global _down_until
    with _lock:
        _down_until = time.monotonic() + COOLDOWN_S


def unavailable_reason() -> str | None:
    """Why no call would be made right now, or None if the LLM may be called."""
    if not settings.llm_enabled:
        return "LLM_ENABLED is false"
    if _paused.get():
        return "paused while seeding"
    if time.monotonic() < _down_until:
        return f"{_base()} did not answer a moment ago; trying again in under {COOLDOWN_S:.0f} s"
    return None


_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$")


def parse_json_object(text: str) -> dict[str, Any]:
    """Read a JSON object from a model reply, tolerating <think> blocks and ``` fences."""
    cleaned = _FENCE.sub("", _THINK.sub("", text).strip()).strip()
    candidates = [cleaned]
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if 0 <= start < end:
        candidates.append(cleaned[start:end + 1])
    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except ValueError:
            continue
        if isinstance(data, dict):
            return data
    raise LLMError("the model did not answer with a JSON object")


def chat_json(system: str, user: str) -> dict[str, Any]:
    """One chat call whose answer must be a JSON object. Raises LLMError on any problem."""
    reason = unavailable_reason()
    if reason:
        raise LLMError(reason)
    body = {
        "model": settings.llm_model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": settings.llm_temperature,
        "max_tokens": settings.llm_max_tokens,
        "response_format": {"type": "json_object"},
        "stream": False,
    }
    key = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
    with _lock:
        hit = _cache.get(key)
    if hit is not None and time.monotonic() - hit[0] < settings.llm_cache_seconds:
        return hit[1]
    url = f"{_base()}/chat/completions"
    try:
        with client_factory() as client:
            response = client.post(url, json=body)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
    except httpx.TransportError as exc:  # connection refused, timeout...
        _mark_down()
        raise LLMError(f"could not reach {url} ({exc.__class__.__name__})") from exc
    except httpx.HTTPStatusError as exc:  # e.g. 404 when the model isn't pulled yet
        raise LLMError(f"{url} answered {exc.response.status_code}: {exc.response.text[:200]}") from exc
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise LLMError("unexpected reply format from the LLM server") from exc
    data = parse_json_object(content or "")
    with _lock:
        _cache.pop(key, None)
        if len(_cache) >= CACHE_MAX:
            _cache.pop(next(iter(_cache)))
        _cache[key] = (time.monotonic(), data)
    return data


def status() -> dict[str, Any]:
    """For /health: is the LLM switched on, reachable, and is the model downloaded?"""
    info: dict[str, Any] = {"enabled": settings.llm_enabled}
    if not settings.llm_enabled:
        info["note"] = "Representatives speak from templates. Set LLM_ENABLED=true to use a local model."
        return info
    info.update(model=settings.llm_model, base_url=_base())
    try:
        with client_factory() as client:
            response = client.get(f"{_base()}/models", timeout=3.0)
            response.raise_for_status()
            models = [m.get("id") for m in response.json().get("data", [])]
    except (httpx.HTTPError, ValueError, AttributeError) as exc:
        info.update(reachable=False, note=f"No answer from {_base()} ({exc.__class__.__name__}). Is Ollama running?")
        return info
    ready = settings.llm_model in models or f"{settings.llm_model}:latest" in models
    info.update(reachable=True, model_ready=ready)
    if not ready:
        info["note"] = f"Model not downloaded yet: run `ollama pull {settings.llm_model}`."
    return info
