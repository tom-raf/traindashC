# Handoff — Train Dash

Status: **scaffold complete and verified end-to-end** (backend tested + running, frontend built + tested + running, full data flow confirmed through the dev proxy). Nothing here is production-ready — it's a solid skeleton to build the real thing on top of.

## What's real vs. what's mocked

| Piece | Status |
|---|---|
| Angular UI (station selector, operator table, reliability chart) | Real, working |
| Express API + routes | Real, working |
| Aggregation logic (daily buckets, operator breakdown, on-time %) | Real, working |
| **Train data** | **Mocked** — `MockTrainDataProvider` generates deterministic fake data, not a real feed |
| **Storage** | **In-memory only** — `InMemoryReliabilityRepository`, wiped on every restart, reseeded each time |
| Auth, rate limiting, deployment config | Not started — out of scope for this phase |

## Architecture: the two swap points

The whole scaffold is built around two interfaces so that plugging in real infrastructure later doesn't require restructuring anything:

1. **`backend/src/providers/train-data-provider.interface.ts`** — `TrainDataProvider`. Today: `MockTrainDataProvider`. When you pick a real train-data API (e.g. National Rail Darwin/OpenLDBWS, RTT.io), write a new class implementing this same interface and it slots in.
2. **`backend/src/repository/reliability-repository.interface.ts`** — `ReliabilityRepository`. Today: `InMemoryReliabilityRepository` (flat array). When you want persistence (the plan was SQLite or Postgres, given the small "last 30 days" scope), write a new class implementing this same interface.

**`backend/src/container.ts`** is the single composition root — the only file that needs to change to wire in a real provider and/or a real repository. Nothing in `routes/`, `services/`, or the frontend needs to know the difference.

Station codes are real UK CRS codes (`CBG`, `YRK`, `NCL`) specifically so a real rail API maps onto `StationCode` with zero schema change.

## Data model

Defined once in `shared/types.ts` and imported by both apps via the `@shared/*` path alias (no duplicated types, no drift):

- `StationCode` = `'CBG' | 'YRK' | 'NCL'` (constrained union, not free text — validated server-side too, in `backend/src/routes/validate-station.ts`)
- `ServiceRecord` — one train service: station, operator, date, scheduled time, status (`ON_TIME` / `DELAYED` / `CANCELLED`), delay minutes
- `ReliabilitySummaryResponse` / `OperatorBreakdownResponse` — the aggregated shapes the frontend actually consumes (raw records never leave the backend)

## Recommended next steps, in order

1. **Pick the real train-data API.** Whatever it is, look at what data it actually returns per station/operator/day and check it maps cleanly onto `ServiceRecord` — if not, adjust `shared/types.ts` first since everything else derives from it.
2. **Write the real provider.** New class in `backend/src/providers/`, implementing `TrainDataProvider`. Keep `MockTrainDataProvider` around — it's useful for local dev/demos without hitting a real API or its rate limits.
3. **Add persistence.** New class in `backend/src/repository/` implementing `ReliabilityRepository`, e.g. SQLite via `better-sqlite3` given the small scope (3 stations × 30 days is a few thousand rows). Add a pruning job for anything older than 30 days per the "last month only" requirement.
4. **Replace the one-shot `bootstrap/seed.ts` with a real ingestion job** — either a polling loop or a scheduled task that calls the provider periodically and writes through the repository, rather than seeding once at startup.
5. **Wire both into `container.ts`.**
6. Only after that: auth, deployment, CI, error/retry handling around whatever the real API's reliability is like.

## Gotchas hit while building this (so you don't re-hit them)

- **`shared/` needed its own `package.json` with `"type": "module"`.** Without it, TypeScript's NodeNext module resolution silently compiled `shared/types.ts` to CommonJS while the backend compiled to ESM, and the compiled backend crashed at runtime (`does not provide an export named 'STATIONS'`). If you touch backend build/module settings, watch for this again.
- **`tsc` doesn't rewrite the `@shared/*` path alias in compiled output.** `tsx` (dev) and `vitest` (test, via `vitest.config.ts` alias) resolve it fine, but plain `node dist/...` doesn't understand TS path aliases. Fixed with `tsc-alias` as a build step (`npm run build` = `tsc` then `tsc-alias`). If you add more shared-import call sites, this keeps working automatically — no per-file action needed.
- **`@swimlane/ngx-charts@25` requires Angular 22/23** (pulls in `@angular/cdk@22`) and will fail to install against this Angular 19 project. Pinned to `ngx-charts@24.0.0`, which explicitly supports Angular 19/20/21. Don't blindly `npm update` this package without checking peer deps.
- **`ngx-charts-bar-vertical-stacked` doesn't have a `roundEdges` input** (only the non-stacked bar variants do) — if you copy examples from ngx-charts docs for other chart types, check the actual `.d.ts` for that specific component's inputs first.
- **`[scheme]` needs a full `Color` object** (`{ name, selectable, group, domain }`), not just `{ domain: [...] }` — see `reliability-chart.mapper.ts` for the fixed status-color scheme (`STATUS_COLOR_SCHEME`), which is intentionally a fixed palette (green/amber/red for on-time/delayed/cancelled), not a themed categorical ramp.
- Backend TS output ends up nested at `dist/backend/src/...` (not `dist/...`) because `rootDir` had to be bumped up one level (`..`) so `tsc` could include `shared/` in the same compilation as `backend/src/`. `package.json`'s `start` script already accounts for this (`node dist/backend/src/index.js`) — don't "fix" it back to `dist/index.js`.

## Known rough edges (not blockers, just not done)

- `npm audit` reports vulnerabilities in both `backend` and `frontend` dev dependencies (mostly transitive, from Angular CLI tooling / express ecosystem) — worth a look before shipping, not urgent for local dev.
- No E2E test suite (Cypress/Playwright) — only backend integration tests (vitest+supertest) and one frontend unit test (Karma/Jasmine) exist.
- The reliability chart renders at a fixed per-day width inside a horizontally-scrolling container rather than a fully responsive layout — fine for ~30 bars, would need revisiting for a longer date range.
- No loading/error states in the UI yet — if the backend is down, the dashboard just shows empty sections rather than an error message.
