# Interspecies Paradox — draft frontend/backend contract

> **Update:** live mode (`VITE_USE_MOCKS=false`) now uses the real backend API under `/api/v1` (JWT login, snake_case). See `README.md` and `src/services/live/`. This draft is kept for history.

This is a **proposal**, not an already implemented API. Frontend and backend teams should agree on names and shapes before turning off mock mode.

## Local dev

- React/Vite: `http://localhost:5173`
- Suggested FastAPI: `http://localhost:8000`
- Backend CORS must allow the Vite origin in development.
- In `frontend/.env.local`, use `VITE_USE_MOCKS=true` until compatible backend endpoints exist.
- Only `src/services/conflictGateway.ts` is ready to switch via this flag. Other features remain local/mock for now.

## POST /conflicts

Request JSON (`ConflictDraft`):

```json
{
  "title": "Bird nest beside my entrance",
  "description": "People pass close to a nesting area.",
  "speciesId": "robin",
  "conflictType": "access",
  "observedActivity": "nesting",
  "location": "Apartment entrance",
  "severity": 4,
  "affectedNeeds": ["Getting in or out"],
  "accessBlocked": false
}
```

Response JSON (`ConflictReport`): request fields **plus**

```json
{
  "id": "c-123",
  "status": "reported",
  "createdAt": "2026-11-21T11:00:00.000Z"
}
```

Above is an excerpt: the API must return all request fields as well. Agree on `camelCase` versus `snake_case` at the boundary (the existing frontend expects camelCase).

## Next endpoints to coordinate (not connected yet)

| Method | Suggested path | Purpose |
|---|---|---|
| GET | `/conflicts/{id}` | Read submitted conflict |
| GET | `/profiles/me` | Read human profile |
| PUT | `/profiles/me` | Save human profile |
| POST | `/conflicts/{id}/assess` | Return human/wildlife assessed needs and tensions |
| POST | `/conflicts/{id}/mediate` | Return feasible candidate plans, index dimensions, reasons, and mapped geometry |
| POST | `/conflicts/{id}/agreement-draft` | Save proposed agreement draft |
| GET | `/conflicts/{id}/agreement-draft` | Read saved agreement draft |

## Important domain rules

- A plan violating an essential constraint is ineligible regardless of index.
- Coexistence Index in current demo is `min(wildlifeProtection, humanAccess, disturbanceReduction, practicality)` for **eligible** plans only.
- Species needs, wildlife dialogue, and geospatial routes in the current app are illustrative; real plans require verified ecological inputs and review.
- A draft agreement is **not** official permission, a legal contract, or wildlife consent.
- Avoid storing private addresses or accessibility/health details in unsecured localStorage in production. Plan authentication, authorization, consent, and protected storage before using real user data.
