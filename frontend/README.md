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
3. Open http://localhost:5173. It starts with the playable intro; press **Skip experience** (or go to
   http://localhost:5173/dashboard), then click **Log in** and pick a demo resident (password `coexist2126`).
   Noor has a fresh fox case to take through every step; Lina's house martin case already has an active agreement.

## The neighborhood map (`/map`)

The map is the main feature, so it has its own full-screen page at http://localhost:5173/map
(also linked from the sidebar and the dashboard). It works in both modes: live mode reads
`GET /api/v1/map/features` from the backend; mock mode, or a backend that is not running, uses
the offline copy of the same dataset in `public/data/ixelles-ponds-2126.geojson`.

How it stays easy to read:

- **One colour per meaning**, and each category also has its own shape or line pattern:
  blue circles = people, orange pins = animals, brown dots = animal homes, green = nature (the pond is blue),
  yellow dashed = wildlife quiet zones, red pulsing rings = conflicts, purple = agreed fixes or new things in a plan,
  grey/white = streets and buildings. People's routes are solid blue lines, animal paths are moving orange dots,
  delivery routes are moving grey dashes.
- **Quick views** at the top: Overview (calm first view), People, Animals, Conflicts & fixes, Everything.
- **Map key** on the left: every category with its symbol, a count and an on/off switch.
- **Click anything** to open a details card. Clicking an animal fades everything that is not linked to it,
  and shows its home, quiet zone, path and conflicts, even if those layers are switched off.
- **First visit guide** ("How to read this map"), reopened with the **Help** button.
- `?solution=<id>` shows a plan from the mediation studio, with a **Today / With the plan** switch.
  The mediation studio's smaller map has a **Full-screen map** button that opens this.
- "Real Brussels underneath" adds faint OpenStreetMap tiles (off by default, because the 2126 streets are invented).

Code: `src/features/map/` (`MapPage`, `NeighborhoodMap`, `MapLegend`, `FeatureDetails`, `MapGuide`,
`mapStyle.ts` for categories and colours, `markers.ts` for the HTML markers, `mapData.ts` for loading).

## Animal sounds

Clicking an animal on the map plays its call (turn it off with **Sounds on/off** in the top bar). The sounds are
**made in the browser with the Web Audio API** (`src/features/sounds/animalSounds.ts`), one small recipe per species:
house martin "prrrt" twitters, peregrine "kek-kek-kek", pipistrelle bat-detector ticks and feeding buzz,
mason bee wing hum, hedgehog sniffs and huffs, fox barks. No audio files, no API key, no licences to track,
and it works offline. The card under each sound explains what the real animal sounds like and says it is not a recording.

To use a real recording instead, put the file in `public/sounds/` and add it to `RECORDINGS` in that file
(check the licence first).

## Where the live code lives

- `src/services/live/` — `client.ts` (login session, token refresh), `api.ts` (one function per endpoint),
  `types.ts` (backend shapes), `adapters.ts` (backend ↔ frontend shapes), `profileSync.ts`.
- `src/features/live/` — the live pages: login, report, assessment, mediation (plans, map, Coexistence Index,
  negotiation), agreement, recent cases, and the species representative panel with "Ask".
- `src/app/router.tsx` picks the live or mock pages from `VITE_USE_MOCKS`. The mock pages are unchanged.
  `/` is the intro (`src/features/intro/`) in both modes, and the dashboard lives at `/dashboard`.
- Shared components (`ConflictForm`, `ConflictCard`, `NeedsCard`, `WildlifeProfile`, `Card`, `Button`…) are reused
  in both modes; live mode passes a few optional props.
