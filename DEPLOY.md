# Deploying The Interspecies Paradox

The website (React, in `frontend/`) goes on **Vercel**.
The API (FastAPI, in `backend/`) and its PostgreSQL database go on **Render**.

```
Browser ──► Vercel: https://interspecies-paradox.vercel.app        (static site)
   │
   └──────► Render: https://interspecies-paradox-api.onrender.com   (FastAPI)
                         │
                         └──► Render PostgreSQL (free)
```

Both deploy from the `main` branch, and every push to `main` redeploys both.

## What is already in the code

| File | What it does |
|---|---|
| `render.yaml` | Render Blueprint: creates the API (Python 3.12, free plan, Frankfurt) and the database, links them, and makes a random `JWT_SECRET_KEY`. On every start it runs `alembic upgrade head`, then `python -m app.seed` (fills the demo data only the first time), then uvicorn. |
| `frontend/vercel.json` | Vite build settings and the rewrite that sends every page (`/map`, `/dashboard`...) to `index.html`. |
| `frontend/.env.production` | Production build settings: live mode and the Render API address. A Vercel environment variable with the same name wins over it. |
| `backend/app/core/config.py` | Turns Render's `postgresql://` URL into the psycopg 3 driver URL, reads `CORS_ORIGINS` as a comma list, and refuses to start in production with a weak JWT secret. |

## One time setup

### 1. Backend on Render

1. Sign in at https://render.com with GitHub.
2. **New > Blueprint**, pick `AkshitBahl/InterspeciesParadox`, branch `main`.
3. Render shows `interspecies-paradox-api` and `interspecies-paradox-db`. Click **Deploy Blueprint**.
4. When it is live, open `https://<your-api>.onrender.com/health`. It should say `"status": "ok"`.

### 2. Frontend on Vercel

1. Sign in at https://vercel.com with GitHub.
2. **Add New > Project**, import `AkshitBahl/InterspeciesParadox`.
3. Project name: **`interspecies-paradox`** (the API allows sites whose address starts with this name).
4. Root Directory: **`frontend`**. Framework: Vite (detected).
5. Only if Render gave the API another address: add the environment variable
   `VITE_API_BASE_URL` = `https://<your-api>.onrender.com` (no slash at the end).
6. Click **Deploy**.

## Settings you can change on Render (service > Environment)

| Variable | Default | Meaning |
|---|---|---|
| `CORS_ORIGIN_REGEX` | `https://interspecies-paradox(-[a-z0-9-]+)?\.vercel\.app` | Vercel site and its preview links may call the API. |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Extra exact sites, comma separated (for example a custom domain). |
| `JWT_SECRET_KEY` | random, made by Render | Signs login tokens. Changing it logs everyone out. |
| `SIMULATED_TODAY` | `2126-05-20` | The story's date. `real` uses today. |
| `ENABLE_EXTERNAL_GEO` | `true` | OSRM routing and Nominatim search. `false` = offline path network only. |

## Good to know (free plans)

* The free Render API **sleeps after 15 minutes** without visitors and needs about a minute to wake up.
  The site pings `/health` as soon as it opens, and the login page says when the server is waking up.
  Open the site a couple of minutes before a demo.
* The free Render database **expires 30 days after it is created** (then a 14 day grace period
  before it is deleted). Upgrade it in Render if you need it for longer.
* Free Render services have no Shell. To **reset the demo data**, copy the database's
  *External Database URL* (Render > database > Connect) and run on your own computer:

  ```bash
  cd backend
  source .venv/bin/activate
  DATABASE_URL='<External Database URL>' python -m app.seed --reset
  ```
