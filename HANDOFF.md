# Handoff — Train Dash

Status: **scaffold complete and verified end-to-end** (backend tested + running, frontend built + tested + running, full data flow confirmed through the dev proxy). The real data-source work has started: LDBWS was chosen and `LdbwsTrainDataProvider` is built and unit-tested, but not yet wired in or verified against the live API — persistence (Supabase) and the polling ingestion job are the next pieces. Nothing here is production-ready — it's a solid skeleton to build the real thing on top of.

## What's real vs. what's mocked

| Piece | Status |
|---|---|
| Angular UI (station selector, operator table, reliability chart) | Real, working |
| Express API + routes | Real, working |
| Aggregation logic (daily buckets, operator breakdown, on-time %) | Real, working |
| **Train data** | **Mocked, but a real provider is built and tested** — `container.ts` still wires up `MockTrainDataProvider`; `LdbwsTrainDataProvider` (LDBWS/Live Departure Boards) exists and passes 9 unit tests, but isn't wired in yet — see below |
| **Storage** | **In-memory only** — `InMemoryReliabilityRepository`, wiped on every restart, reseeded each time. Plan is Supabase Postgres (Free tier), not yet built |
| Auth, rate limiting, deployment config | Not started — out of scope for this phase |

## Architecture: the two swap points

The whole scaffold is built around two interfaces so that plugging in real infrastructure later doesn't require restructuring anything:

1. **`backend/src/providers/train-data-provider.interface.ts`** — `TrainDataProvider`. Active today: `MockTrainDataProvider`. Also built and tested: `LdbwsTrainDataProvider` (`backend/src/providers/ldbws-train-data-provider.ts`), using LDBWS (Live Departure Boards) — see `backend/docs/data-source-decisions.md` for why LDBWS was chosen over the historical HSP API, and why/how it derives `ON_TIME`/`DELAYED`/`CANCELLED` from a live board rather than a confirmed actual time.
2. **`backend/src/repository/reliability-repository.interface.ts`** — `ReliabilityRepository`. Today: `InMemoryReliabilityRepository` (flat array). Decided: Supabase Postgres (Free tier), with a `pg_cron`/`pg_net` job polling LDBWS every few minutes — not yet built. See `backend/docs/data-source-decisions.md`.

**`backend/src/container.ts`** is the single composition root — the only file that needs to change to wire in a real provider and/or a real repository. Nothing in `routes/`, `services/`, or the frontend needs to know the difference.

Station codes are real UK CRS codes (`CBG`, `YRK`, `NCL`) specifically so a real rail API maps onto `StationCode` with zero schema change.

## Data model

Defined once in `shared/types.ts` and imported by both apps via the `@shared/*` path alias (no duplicated types, no drift):

- `StationCode` = `'CBG' | 'YRK' | 'NCL'` (constrained union, not free text — validated server-side too, in `backend/src/routes/validate-station.ts`)
- `ServiceRecord` — one train service: station, operator, date, scheduled time, status (`ON_TIME` / `DELAYED` / `CANCELLED`), delay minutes
- `ReliabilitySummaryResponse` / `OperatorBreakdownResponse` — the aggregated shapes the frontend actually consumes (raw records never leave the backend)

## Recommended next steps, in order

1. ~~Pick the real train-data API.~~ **Done** — LDBWS. See `backend/docs/data-source-decisions.md`.
2. ~~Write the real provider.~~ **Done** — `LdbwsTrainDataProvider`, tested (`backend/src/__tests__/ldbws-train-data-provider.test.ts`). Not yet verified against the live API with real credentials (only unit-tested against a stubbed board fetcher). Keep `MockTrainDataProvider` around either way — useful for local dev/demos without hitting the real API or its rate limits.
3. **Stand up the Supabase project and a `ReliabilityRepository` implementation against it.** Free tier, standalone (not via Vercel). Confirmed: `pg_cron` activity counts as project activity, so the Free-tier auto-pause won't kill a running poller.
4. **Build the ingestion job**: a `pg_cron` job (+ `pg_net`) firing every few minutes, calling either a Supabase Edge Function or an endpoint on this backend, which polls `LdbwsTrainDataProvider` for all 3 stations and upserts into the repository. This replaces the one-shot `bootstrap/seed.ts`. Still open: whether to roll raw records into daily buckets (recommended, matches the existing `DailyReliabilityBucket` shape) vs. a coarser aggregate — see the "Open questions" in `data-source-decisions.md`.
5. **Wire both into `container.ts`.**
6. Only after that: auth, deployment, CI, error/retry handling around LDBWS's actual reliability.

## Gotchas hit while building this (so you don't re-hit them)

- **`shared/` needed its own `package.json` with `"type": "module"`.** Without it, TypeScript's NodeNext module resolution silently compiled `shared/types.ts` to CommonJS while the backend compiled to ESM, and the compiled backend crashed at runtime (`does not provide an export named 'STATIONS'`). If you touch backend build/module settings, watch for this again.
- **`tsc` doesn't rewrite the `@shared/*` path alias in compiled output.** `tsx` (dev) and `vitest` (test, via `vitest.config.ts` alias) resolve it fine, but plain `node dist/...` doesn't understand TS path aliases. Fixed with `tsc-alias` as a build step (`npm run build` = `tsc` then `tsc-alias`). If you add more shared-import call sites, this keeps working automatically — no per-file action needed.
- **`@swimlane/ngx-charts@25` requires Angular 22/23** (pulls in `@angular/cdk@22`) and will fail to install against this Angular 19 project. Pinned to `ngx-charts@24.0.0`, which explicitly supports Angular 19/20/21. Don't blindly `npm update` this package without checking peer deps.
- **`ngx-charts-bar-vertical-stacked` doesn't have a `roundEdges` input** (only the non-stacked bar variants do) — if you copy examples from ngx-charts docs for other chart types, check the actual `.d.ts` for that specific component's inputs first.
- **`[scheme]` needs a full `Color` object** (`{ name, selectable, group, domain }`), not just `{ domain: [...] }` — see `reliability-chart.mapper.ts` for the fixed status-color scheme (`STATUS_COLOR_SCHEME`), which is intentionally a fixed palette (green/amber/red for on-time/delayed/cancelled), not a themed categorical ramp.
- Backend TS output ends up nested at `dist/backend/src/...` (not `dist/...`) because `rootDir` had to be bumped up one level (`..`) so `tsc` could include `shared/` in the same compilation as `backend/src/`. `package.json`'s `start` script already accounts for this (`node dist/backend/src/index.js`) — don't "fix" it back to `dist/index.js`.
- **LDBWS's `GetDepartureBoard` response has no `atd` (actual departure time)** — only `std` (scheduled) and `etd` (live estimate, sometimes a real time, sometimes a status string like "On time"). Actual times only exist via a separate `GetServiceDetails/{serviceID}` call, which we deliberately don't make per-service (would be 1+N requests per poll instead of 1). `deriveStatus()` in `ldbws-train-data-provider.ts` derives status from `etd` vs `std` instead — an estimate, not a confirmed outcome. Revisit if this proves too noisy once real data is flowing.
- **LDBWS time format (`std`/`etd`) wasn't confirmed from the docs** (neither the OpenAPI spec nor the reference PDF states `"HH:mm"` vs `"HHMM"`) — `parseHHMM()` in `ldbws-train-data-provider.ts` accepts both. If you touch that regex, keep it tolerant of both until a live response confirms one.
- **`.env` files need real `KEY=VALUE` lines, no spaces in the key** — a `dotenv`-breaking mistake that happened once already (`LDBWS api key = ...` instead of `LDBWS_API_KEY=...`). `backend/src/config/env.ts` loads it; check that module if LDBWS env vars mysteriously read as `undefined`.
- **LDBWS auth is not in its OpenAPI spec** — the spec (`backend/docs/ldbws-swagger-json.txt`) has no `securityDefinitions`; the Rail Data Marketplace gateway auth is a separate concern from the underlying service's contract. Confirmed header: `x-apikey` (`LDBWS_AUTH_HEADER` in `.env`).

## Known rough edges (not blockers, just not done)

- `npm audit` reports vulnerabilities in both `backend` and `frontend` dev dependencies (mostly transitive, from Angular CLI tooling / express ecosystem) — worth a look before shipping, not urgent for local dev.
- No E2E test suite (Cypress/Playwright) — only backend integration tests (vitest+supertest) and one frontend unit test (Karma/Jasmine) exist.
- The reliability chart renders at a fixed per-day width inside a horizontally-scrolling container rather than a fully responsive layout — fine for ~30 bars, would need revisiting for a longer date range.
- No loading/error states in the UI yet — if the backend is down, the dashboard just shows empty sections rather than an error message.
