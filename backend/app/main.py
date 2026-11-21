"""FastAPI application entry point.

Run locally:  uvicorn app.main:app --reload
Docs:         http://localhost:8000/docs
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core import clock
from app.core.config import settings
from app.services import llm
from app.services.agreement_service import AgreementError
from app.services.conflict_service import ConflictError
from app.services.external import ExternalServiceError
from app.services.markdown_export import ExportError
from app.services.negotiation_service import NegotiationError

DESCRIPTION = """
**The Interspecies Paradox** · *Nature Is My Neighbor Now* · Solarpunk 2126

An interspecies mediation platform. The 8-step flow:

1. **Profile** `PUT /profiles/me`
2. **Report a conflict** `POST /conflicts`
3. **Assess needs** + 4. **find clashes and common ground** `POST /conflicts/{id}/assessment`
5. **Generate compromises** `POST /conflicts/{id}/solutions/generate`
6. **Compare with the Coexistence Index** `GET /conflicts/{id}/solutions/compare`
7. **Negotiate** `POST /conflicts/{id}/negotiation/...`
8. **Temporary agreement** `POST /agreements/{id}/sign`

The map (MapLibre-ready GeoJSON) lives under `/map`, routing and search under `/geo`.
Demo login: `lina@example.org` / `coexist2126`.
"""

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=DESCRIPTION,
    openapi_tags=[
        {"name": "auth", "description": "Register, log in (JWT), refresh."},
        {"name": "profiles", "description": "Step 1: the human profile and preferences."},
        {"name": "species & representatives", "description": "Grounded ecological data and funny spokes-animals."},
        {"name": "conflicts & mediation", "description": "Steps 2-6."},
        {"name": "solutions & coexistence index", "description": "Step 6 in detail, plus what-if previews."},
        {"name": "negotiation", "description": "Step 7."},
        {"name": "agreements", "description": "Step 8."},
        {"name": "map", "description": "GeoJSON layers, scenarios, animations, LLM export."},
        {"name": "search & routing", "description": "Nominatim search and wildlife-aware OSRM routing."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ConflictError)
@app.exception_handler(NegotiationError)
@app.exception_handler(AgreementError)
@app.exception_handler(ExportError)
async def domain_error(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(ExternalServiceError)
async def external_error(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["meta"])
def health() -> dict:
    """Server status, plus whether the optional local LLM voice is switched on and reachable."""
    return {
        "status": "ok",
        "simulation_date": clock.today().isoformat(),
        "environment": settings.environment,
        "llm": llm.status(),
    }


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"name": settings.app_name, "docs": "/docs", "api": settings.api_v1_prefix}
