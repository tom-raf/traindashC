# Train Dash

A dashboard for tracking train reliability at a small set of UK stations — currently **Cambridge**, **York**, and **Newcastle**. For each station it shows:

- **Station** — switch between the 3 tracked stations
- **Train Operators** — a per-operator breakdown (services run, on time / delayed / cancelled counts, on-time %)
- **Reliability graph** — a stacked bar chart of On Time / Delayed / Cancelled trains per day, over the last 30 days

The real train-data source hasn't been chosen yet, so the backend currently serves deterministic, generated mock data behind an interface designed to be swapped for a real API later with minimal changes. See [HANDOFF.md](./HANDOFF.md) for the full picture of what's real, what's mocked, and what to do next.

## Project structure

```
traindashC/
├── shared/     TypeScript types shared by both apps (Station, Operator, ServiceRecord, API DTOs)
├── backend/    Node.js + Express API (port 3000) — serves mock reliability data today
└── frontend/   Angular 19 + Tailwind CSS + ngx-charts dashboard (port 4200)
```

## Prerequisites

- Node.js 20+ (developed on v23.10.0)
- npm

## Running it

From the repo root, install everything and start both apps together:

```bash
npm run install:all
npm run dev
```

This runs the backend (`tsx watch`, port 3000) and frontend (`ng serve`, port 4200) concurrently. The frontend dev server proxies `/api/*` to the backend, so open **http://localhost:4200** and it just works — no separate API URL configuration needed.

To run either app on its own:

```bash
cd backend && npm install && npm run dev     # API on :3000
cd frontend && npm install && npm start       # UI on :4200, proxies /api to :3000
```

## Testing

```bash
cd backend && npm test    # vitest + supertest — station/reliability/operator-breakdown endpoint checks
cd frontend && npm test   # ng test (Karma/Jasmine)
```

## Building for production

```bash
cd backend && npm run build && npm start      # compiles to dist/, then node dist/backend/src/index.js
cd frontend && npm run build                  # outputs to frontend/dist/frontend
```

## Tech choices

| Concern | Choice |
|---|---|
| Frontend framework | Angular 19 (standalone components, signals) |
| Styling | Tailwind CSS v4 |
| Charting | ngx-charts (`@swimlane/ngx-charts`) |
| Backend | Node.js + Express + TypeScript |
| Data storage | In-memory (interface-backed, swappable for a real DB) |
| Data source | Deterministic mock generator (interface-backed, swappable for a real API) |

For the reasoning behind these choices and what's intentionally left as a stub for later, see [HANDOFF.md](./HANDOFF.md).
