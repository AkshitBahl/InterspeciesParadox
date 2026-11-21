# The Interspecies Paradox — frontend

React 19 + Vite + Tailwind + Leaflet. The app has two modes:

| Mode | `VITE_USE_MOCKS` | What it does |
|---|---|---|
| Live | `false` | Talks to the FastAPI backend in `../backend` (login, reports, assessment, plans, map, negotiation, agreements). |
| Mock | `true` (or unset) | The original browser-only demo with mock data in localStorage. No backend needed. |

## Run frontend and backend together

1. Start the backend (see `../backend/README.md`), for example:
   ```bash
   cd backend
   docker compose up --build        # or: uvicorn app.main:app --reload
   ```
   It must answer on http://localhost:8000/health.
2. Start the frontend in live mode:
   ```bash
   cd frontend
   cp .env.example .env.local       # contains VITE_USE_MOCKS=false
   npm install
   npm run dev
   ```
3. Open http://localhost:5173, click **Log in**, pick a demo resident (password `coexist2126`).
   Noor has a fresh fox case to take through every step; Lina's house martin case already has an active agreement.

## Where the live code lives

- `src/services/live/` — `client.ts` (login session, token refresh), `api.ts` (one function per endpoint),
  `types.ts` (backend shapes), `adapters.ts` (backend ↔ frontend shapes), `profileSync.ts`.
- `src/features/live/` — the live pages: login, report, assessment, mediation (plans, map, Coexistence Index,
  negotiation), agreement, recent cases, and the species representative panel with "Ask".
- `src/app/router.tsx` picks the live or mock pages from `VITE_USE_MOCKS`. The mock pages are unchanged.
- Shared components (`ConflictForm`, `ConflictCard`, `NeedsCard`, `WildlifeProfile`, `Card`, `Button`…) are reused
  in both modes; live mode passes a few optional props.
