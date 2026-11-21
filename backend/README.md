# The Interspecies Paradox: backend

*Nature Is My Neighbor Now* · Solarpunk 2126

This is the API for an **interspecies mediation platform**. When people and urban
wildlife want the same space (a door, a roof, a balcony, a street at night), the
platform helps them find a fair compromise. Every species has a funny digital
representative (Martina Mudd the house martin, Count Pipistrello the bat...), but
everything they say comes from structured ecological data.

Stack: Python 3.12+, FastAPI, PostgreSQL, SQLAlchemy 2.0, Alembic, Pydantic v2,
JWT auth, Argon2 password hashing, pytest.

---

## 1. How it works, step by step

Think of it like a mediator sitting between a neighbour and an animal.

| Step | What happens | Main endpoint |
|---|---|---|
| 1. Profile | You say who you are: home, mobility needs (stroller, wheelchair), allergies, budget, what matters to you. | `PUT /api/v1/profiles/me` |
| 2. Report | You report a problem ("bats in the roof I want to renovate"). A hotspot appears on the map. If no known nest is within 60 m, a new one is added with its seasonal quiet zone. | `POST /api/v1/conflicts` |
| 3. Needs | The engine lists what **you** need (a usable door, a work window...) and what the **animal** needs (quiet nest, dark sky, safe passage...). | `POST /conflicts/{id}/assessment` |
| 4. Clashes and common ground | It pairs the needs: which ones clash (door vs nest) and which fit together (you love nature + they eat mosquitoes). | same response |
| 5. Compromises | It tries 7 generic strategies (quiet zone, screen, reschedule, new home nearby, dark corridor, safe passage, watch and adapt) and keeps the ones that beat "doing nothing". | `POST /conflicts/{id}/solutions/generate` |
| 6. Compare | Each idea gets a **Coexistence Index** from 0 to 100, with every number shown. | `GET /conflicts/{id}/solutions/compare` |
| 7. Negotiate | You change a knob ("only 2 m please"). The representative answers: accept, accept with concerns, counter-offer, or reject, and explains why with data. | `POST /conflicts/{id}/negotiation/counter-proposals` |
| 8. Agreement | A **temporary** agreement is drafted (valid until the season ends, with review dates). The representative signs with a feather or a paw print; when you sign, it becomes active and appears on the map. | `POST /agreements/{id}/sign` |

### The Coexistence Index (step 6)

```
Wildlife wellbeing = how well each wildlife need is met (weighted by importance)
Human wellbeing    = the same for human needs
Feasibility        = 40% cost vs budget + 30% time + 30% effort
Balance            = 100 - |Wildlife - Human|   (punishes one-sided "wins")

Index = 0.30 x Wildlife + 0.30 x Human + 0.20 x Feasibility + 0.20 x Balance
```

Three safety gates can cap the score, whatever the maths says:

* breaks a legal protection rule (e.g. bats are protected by EU law) → max **39**
* goes below an ecological minimum (e.g. too close to a den) → max **49**
* breaks a hard human need (e.g. no step-free entrance for a wheelchair) → max **49**

Grades: 80+ *Thriving together* 🌿, 65+ *Good neighbours* 🤝, 50+ *Fragile truce* ⚖️, below *Conflict persists* ⚠️.
You can try your own weights: `GET /solutions/{id}/coexistence-index?wildlife=2&human=1`.

---

## 2. Run it

### Option A: Docker (easiest)

```bash
cd backend
docker compose up --build
```

Open http://localhost:8000/docs. The database is created, migrated and filled with the demo story automatically.

### Option B: on your machine

You need Python 3.12+ and PostgreSQL.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                 # then edit DATABASE_URL if needed

createdb interspecies                # or create it in pgAdmin
alembic upgrade head                 # creates the tables
python -m app.seed                   # loads species, the Brussels map and the demo story
uvicorn app.main:app --reload        # http://localhost:8000/docs
```

`python -m app.seed --reset` wipes everything and starts the demo again.

### Run the tests

```bash
pytest                               # fast: uses an in-memory SQLite database
TEST_DATABASE_URL=postgresql+psycopg://paradox:paradox@localhost:5432/interspecies_test pytest   # real PostgreSQL
ruff check .
```

OSRM, Nominatim and the LLM are faked in the tests, so they run without internet.

### Optional: a free local LLM voice (Ollama)

By default the representatives speak from templates. You can give them a livelier voice with a
free, open-source model running on your own computer. No account, no API key, no cost.

1. Install [Ollama](https://ollama.com) (on a Mac: download the app, or `brew install ollama`) and open it.
2. Download a model: `ollama pull qwen2.5:7b` (about 4.7 GB, for 16 GB of memory or more).
   With 8 GB, use `ollama pull llama3.2:3b` (about 2 GB) and `LLM_MODEL=llama3.2:3b`.
3. Add to `.env` and restart the server:
   ```
   LLM_ENABLED=true
   LLM_BASE_URL=http://localhost:11434/v1
   LLM_MODEL=qwen2.5:7b
   LLM_TEMPERATURE=0.9        # optional: higher = livelier and more varied
   LLM_CACHE_SECONDS=120      # optional: the same request within 2 minutes gets the same reply
   ```
   With Docker: `LLM_ENABLED=true docker compose up` (it already points at `host.docker.internal:11434`).
4. Check `http://localhost:8000/health`: `llm.reachable` and `llm.model_ready` should both be `true`.

How it stays honest, step by step:

1. The rules still decide everything: scores, safety gates, accept / counter / reject.
2. The model only re-words the template statement, line by line, in the representative's personality.
   For `/representative/ask` and negotiation chat it answers any question from the species' fact sheet,
   and says which facts it used (they become `grounding`).
3. Every reply is checked: same number of lines, no number or month that isn't in the data, no "as an AI".
4. If the check fails, or Ollama is off or slow (`LLM_TIMEOUT_SECONDS`, default 30), you get the template.
   `statement.voice` tells you which one you got (`engine: "llm"` or `"template"`, plus the `reason`).

The demo story written by `python -m app.seed` always uses the templates. Generated solution comments do too,
so generating 5 solutions stays instant. Any server with an OpenAI-style `/chat/completions` endpoint works
(LM Studio, llama.cpp...): change `LLM_BASE_URL` and `LLM_MODEL`.

---

## 3. The demo world

**Date:** the story happens on **20 May 2126** (spring: nests are full). Seasons drive everything,
so you can change the date with `SIMULATED_TODAY=2126-12-01` (or `real` for today's date).

**Place:** "Ixelles Ponds Eco-District", a fictional 2126 neighbourhood near Flagey, Brussels:
6 buildings (Mosshaus, Solaris Tower, Old Brewery, Canopy Court, Pondside Terraces, Flagey Commons Hub),
streets, daily journeys, delivery routes, habitats, corridors and 6 wildlife homes.

**Logins** (password for everyone: `coexist2126`):

| Email | Who | Their story |
|---|---|---|
| `lina@example.org` | Parent with a stroller in Mosshaus | House martins above her door. **Fully solved**: agreement active. |
| `jonas@example.org` | Old Brewery owner | Bats in the roof he wants to renovate. **Negotiation open.** |
| `mei@example.org` | Remote worker, allergic to stings | Mason bees in her balcony blind. Solutions ready. |
| `rafael@example.org` | Solar technician | Peregrine chicks next to the solar panels. Solutions ready. |
| `ops@example.org` | Delivery co-op | Night robots crossing the hedgehog highway. Solutions ready. |
| `noor@example.org` | Pondside resident | Fox family near the playground. **Just reported**: try steps 3 to 8 yourself. |
| `admin@example.org` | Mediator admin | Can edit everything. |

The species representatives:

| Species | Representative |
|---|---|
| House martin | Martina Mudd |
| Peregrine falcon | Commander Stoop |
| Common pipistrelle bat | Count Pipistrello |
| Red mason bee | Osmia Stonewright |
| European hedgehog | Professor Hogsworth Prickles |
| Red fox | Vix Rousseau |

Every statement they make comes with `grounding`: the list of data fields it is based on
(buffer distances, sensitive months, legal status...). The jokes are fiction; the numbers are not.
The ecology is simplified for a demo (see `data_note` on each species): check with a local ecologist before real use.

---

## 4. For the frontend (MapLibre)

Everything is plain GeoJSON. One source holds all features; each has `properties.layer`.

```js
const API = "http://localhost:8000/api/v1";
const cfg = await fetch(`${API}/map/config`).then((r) => r.json());

const map = new maplibregl.Map({
  container: "map",
  style: cfg.basemap_style_url,          // OpenFreeMap, free, no key
  center: cfg.center, zoom: cfg.zoom, pitch: cfg.pitch, bearing: cfg.bearing,
});

map.on("load", () => {
  map.addSource("paradox", { type: "geojson", data: `${API}/map/features` });
  cfg.maplibre_layers.forEach((layer) => map.addLayer(layer));   // ready-made styles, 3D buildings included
});

// "Current situation / Proposed solution" toggle
const showProposed = (solutionId) => map.getSource("paradox").setData(`${API}/map/scenarios/${solutionId}`);
const showCurrent = () => map.getSource("paradox").setData(`${API}/map/features`);
```

Useful map endpoints:

| Endpoint | What for |
|---|---|
| `GET /map/config` | Centre, zoom, bounds, basemap, layer list with colours, MapLibre style layers. |
| `GET /map/features?layers=building,wildlife_site&bbox=...&active_on=2126-06-01` | Filtered GeoJSON. Buffers have `active_now` (is the season on today?). |
| `GET /map/scenarios/{solution_id}/compare` | Both scenarios at once: new features are `scenario_role: "proposed"`, removed ones `"replaced"`. |
| `GET /map/locations` | Named dataset places where users can drop people or animals. |
| `POST /map/features` | Add your own resident, animal, nest, path... (a nest gets its seasonal buffer automatically). Drag it with `PATCH`. |
| `GET /map/animations` | Moving things (wildlife on corridors, residents on journeys, delivery bikes and robots) with `coordinates`, `duration_ms` and keyframes. Animate with `turf.along()`. |
| `POST /map/export/markdown` | Turn a drawn area (bbox, polygon or conflict) into a Markdown brief + JSON summary for an LLM. Add `question` to append a task. |
| `GET /geo/search?q=moss` | Dataset places first, then OpenStreetMap (Nominatim). |
| `POST /geo/route` | Route preview with alternatives, steps, time and a **wildlife disturbance score**. If every route crosses an active quiet zone, a wildlife-friendly detour is added. `wildlife.nearby` lists every animal along each route. |
| `POST /geo/route/negotiate` | **Route negotiation.** Give a start and an end: you get the fastest route, every animal along it, each disturbed species' objection, and the agreed result: a detour (`rerouted`), conditions such as "keep dogs on a lead" (`conditions`), or nothing to change (`no_conflict`). `steps` tells the story; `geojson` draws it (`properties.role`). |

Markers: every feature has `properties.emoji` (🐦 🦇 🐝 🦔 🦊 🏠 🚲 ...) for HTML markers or labels.

Quick look without a frontend: open `http://localhost:8000/api/v1/map/features?simplestyle=true`, copy the JSON and
paste it into [geojson.io](https://geojson.io). With `simplestyle=true` every feature gets `marker-color`, `stroke` and
`fill` properties: humans blue, animals orange, nests dark red, quiet zones yellow, habitats green, buildings grey.
The same flag works on `/map/scenarios/{solution_id}` and `/map/export/geojson`. The demo district is a fictional
2126 layout drawn with simple shapes (straight streets, rectangular buildings), placed near the real Ixelles ponds
but not traced from real streets.

### Routing and search

* Routing uses **OSRM** on real OpenStreetMap streets (`routing.openstreetmap.de`). If it is unreachable, the API
  quietly uses its own offline path network of the demo district, so the demo always works.
* Search and reverse geocoding use **Nominatim**, with a real User-Agent, max 1 request per second and a 1 hour cache
  (their usage policy).
* Quiet zones are measured at street level: a falcon nest 78 m up a tower is not disturbed by people walking below.
* For the demo district, send `"provider": "local"`: OSRM follows the real Brussels streets, not the fictional 2126 paths.
* Try route negotiation out of the box from Pondside Terraces `[4.3722935, 50.8230956]` to Mosshaus `[4.3745688, 50.8247235]`
  (no way around the fox den, so you get conditions). Drop a fox on Avenue du Soleil with `POST /map/features` and route along
  the avenue to see a detour.
* Set `ENABLE_EXTERNAL_GEO=false` to stay fully offline.

---

## 5. Code map

```
backend/
├── app/
│   ├── main.py                 FastAPI app, CORS, error handlers
│   ├── core/                   settings, JWT + Argon2, simulated clock
│   ├── db/                     SQLAlchemy base types and session
│   ├── models/                 tables: users, species, map features, conflicts, solutions, negotiations, agreements
│   ├── schemas/                Pydantic request and response models
│   ├── api/v1/endpoints/       one file per area (auth, profiles, species, conflicts, solutions, negotiation, agreements, map, geo, dashboard)
│   ├── services/               the brains
│   │   ├── needs_engine.py         steps 3-4
│   │   ├── strategies.py           step 5: the 7 compromise strategies
│   │   ├── coexistence_index.py    step 6
│   │   ├── negotiation_service.py  step 7
│   │   ├── agreement_service.py    step 8
│   │   ├── representative.py       the voices of the animals (template based, grounded)
│   │   ├── llm.py, llm_voice.py    optional free local LLM voice (Ollama), checked against the data
│   │   ├── map_service.py          GeoJSON + current/proposed scenarios
│   │   ├── routing.py, route_negotiation.py, path_network.py, search.py, external.py
│   │   ├── animations.py, markdown_export.py
│   │   └── geo.py, seasons.py, context.py
│   └── seed/                   species data, the Brussels dataset, the demo story
├── alembic/                    database migrations
└── tests/                      pytest (95 tests)
```

### Design choices (and why)

* **No PostGIS.** Geometry is stored as GeoJSON (JSONB in PostgreSQL) with bounding-box columns; maths is done
  in Python with Shapely in metres. One less thing to install for a hackathon. PostGIS can be added later.
* **No LLM needed, one optional.** The representatives use templates filled with data, so they never invent
  biology. A free local model (Ollama) can re-word them, but only after a check against the data, with the
  templates as the fallback. The Markdown export is there if you want to hand a whole area to an LLM.
* **Temporary agreements.** Agreements end with the season and have review dates, because wildlife changes.
* **Simulated clock.** The story is set in 2126 and seasons matter, so "today" is a setting.
