from fastapi import APIRouter

from app.api.v1.endpoints import (
    agreements,
    auth,
    conflicts,
    dashboard,
    geo,
    map,
    negotiation,
    profiles,
    solutions,
    species,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(profiles.router)
api_router.include_router(species.router)
api_router.include_router(conflicts.router)
api_router.include_router(solutions.router)
api_router.include_router(negotiation.router)
api_router.include_router(agreements.router)
api_router.include_router(map.router)
api_router.include_router(geo.router)
api_router.include_router(dashboard.router)
