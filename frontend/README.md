# The Interspecies Paradox — frontend

React 19 + Vite + Tailwind, with MapLibre GL for the neighborhood map (Leaflet is still used by the mock mediation map). The app has two modes:

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

## Put it online

The site deploys on Vercel (`vercel.json`, Root Directory `frontend`) and talks to the backend on Render.
`npm run build` uses `.env.production` (live mode + the Render API address). See [`DEPLOY.md`](../DEPLOY.md).

## The neighborhood map (`/map`)

The map is the main feature, so it has its own full-screen page at http://localhost:5173/map
(also linked from the sidebar and the dashboard). It works in both modes: live mode reads
`GET /api/v1/map/features` from the backend; mock mode, or a backend that is not running, uses
the offline copy of the same dataset in `public/data/ixelles-ponds-2126.geojson`.

It is drawn with [MapLibre GL JS](https://maplibre.org/) (open source, BSD licence, no API key) as a dark green
neon city in 3D: buildings rise to their real `height_m` with a glowing roof edge, streets have lit kerbs, and small
lights move along animal paths, deliveries and people's daily routes. Everything is drawn from the dataset itself,
so it needs no map tiles and works offline.

How it stays easy to read:

- **One colour per meaning**, each with its own shape or line pattern: cyan = people, orange pins = animals,
  amber beacons = animal homes, green = nature (the pond is teal), yellow dashed = quiet zones, red pulsing rings =
  conflicts, violet = fixes and anything a plan adds, mint = streets and buildings.
- **Very little text.** Names show on hover, the key is a list of switches, and the details card shows a few facts.
- **Quick views** at the top: Overview, People, Animals, Conflicts, All. Each view zooms back out to the whole district.
- **Click anything** to open its card. Clicking an animal fades everything that is not linked to it,
  and shows its home, quiet zone, path and conflicts, even if those layers are switched off.
- **First visit guide**, reopened with the help button.
- `?solution=<id>` shows a plan from the mediation studio, with a **Now / With plan** switch.
  The mediation studio's smaller map has an **Open map** button that opens this.
- "Real Brussels" in the key adds faint, inverted OpenStreetMap tiles under the city (off by default, because the 2126 streets are invented).
- Drag with the right mouse button (or two fingers) to turn and tilt the view; the compass button resets it.

Code: `src/features/map/` (`MapPage`, `NeighborhoodMap` for the MapLibre style and camera, `MapLegend`, `FeatureDetails`,
`MapGuide`, `mapStyle.ts` for categories and colours, `markers.ts` for the HTML markers, `mapData.ts` for loading).

## Animal sounds

Clicking an animal on the map plays its call (turn it off with the speaker button in the top bar). The sounds are
**made in the browser with the Web Audio API** (`src/features/sounds/animalSounds.ts`), one small recipe per species:
house martin "prrrt" twitters, peregrine "kek kek kek", pipistrelle bat detector ticks and feeding buzz,
mason bee wing hum, hedgehog sniffs and huffs, fox barks. No audio files, no API key, no licences to track,
and it works offline. The card shows one short line on what the real animal sounds like and marks the sound as synthesized.

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
