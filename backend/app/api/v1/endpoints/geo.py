"""Search (Nominatim + local) and wildlife-aware routing (OSRM + offline)."""

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import DbSession
from app.schemas.map import RouteRequest, RouteResponse, SearchResponse
from app.services import routing, search
from app.services.external import ExternalServiceError

router = APIRouter(prefix="/geo", tags=["search & routing"])


@router.get("/search", response_model=SearchResponse)
def search_places(
    db: DbSession,
    q: str = Query(min_length=2, max_length=200),
    limit: int = Query(8, ge=1, le=20),
    external: bool = Query(True, description="Also ask Nominatim (OpenStreetMap)"),
):
    """Find places. Dataset matches (e.g. 'Mosshaus', 'bat') come first, then OpenStreetMap results."""
    return search.search(db, q, limit, include_external=external)


@router.get("/reverse")
def reverse_geocode(db: DbSession, lon: float = Query(ge=-180, le=180), lat: float = Query(ge=-90, le=90)):
    """What is here? Nearest dataset feature + OpenStreetMap address."""
    return search.reverse(db, lon, lat)


@router.post("/route", response_model=RouteResponse)
def plan_route(body: RouteRequest, db: DbSession):
    """Route preview with alternatives, distance, time, steps, and a wildlife disturbance score.

    `provider`: "auto" (OSRM, falls back to offline), "osrm" (fail if unavailable), "local" (offline only).
    """
    try:
        return routing.plan_routes(
            db,
            start=body.start.pair(),
            end=body.end.pair(),
            waypoints=[w.pair() for w in body.waypoints],
            profile=body.profile,
            alternatives=body.alternatives,
            avoid_active_buffers=body.avoid_active_buffers,
            provider=body.provider,
        )
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
