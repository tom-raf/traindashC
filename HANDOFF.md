# Handoff — Train Dash

Status: **scaffold complete and verified end-to-end** (backend tested + running, frontend built + tested + running, full data flow confirmed through the dev proxy). Both real-infra pieces exist and are wired into `container.ts` behind env-var toggles (`DATA_SOURCE`, `REPOSITORY`), defaulting to mock/in-memory so local dev stays frictionless. **`SupabaseReliabilityRepository` is now verified against a real Supabase project** — schema applied, `saveMany`/`findByStationAndRange` round-trip correctly, and a full server run (mock provider -> real Supabase storage -> aggregation -> API) came back clean. `LdbwsTrainDataProvider` is still only unit-tested, not yet hit against the live API. Nothing here is production-ready — it's a solid skeleton to build the real thing on top of.

## What's real vs. what's mocked

| Piece | Status |
|---|---|
| Angular UI (station selector, operator table, reliability chart) | Real, working |
| Express API + routes | Real, working |
| Aggregation logic (daily buckets, operator breakdown, on-time %) | Real, working |
| **Train data** | **Mock by default, LDBWS available via `DATA_SOURCE=ldbws`** — `LdbwsTrainDataProvider` is wired into `container.ts`, passes 9 unit tests, but hasn't been run against the live API with real credentials yet |
| **Storage** | **In-memory by default, Supabase available via `REPOSITORY=supabase`** — `SupabaseReliabilityRepository` is wired into `container.ts`, passes 4 unit tests against a stubbed client, and is now verified against a real Supabase project (schema applied, round-trip confirmed) |
| Auth, rate limiting, deployment config | Not started — out of scope for this phase |

## Architecture: the two swap points

The whole scaffold is built around two interfaces so that plugging in real infrastructure later doesn't require restructuring anything:

1. **`backend/src/providers/train-data-provider.interface.ts`** — `TrainDataProvider`. `MockTrainDataProvider` by default; `LdbwsTrainDataProvider` (`backend/src/providers/ldbws-train-data-provider.ts`, LDBWS/Live Departure Boards) when `DATA_SOURCE=ldbws` — see `backend/docs/data-source-decisions.md` for why LDBWS was chosen over the historical HSP API, and why/how it derives `ON_TIME`/`DELAYED`/`CANCELLED` from a live board rather than a confirmed actual time.
2. **`backend/src/repository/reliability-repository.interface.ts`** — `ReliabilityRepository`. `InMemoryReliabilityRepository` (flat array) by default; `SupabaseReliabilityRepository` (`backend/src/repository/supabase-reliability-repository.ts`) when `REPOSITORY=supabase`, backed by the schema in `backend/supabase/migrations/0001_service_records.sql`.

**`backend/src/container.ts`** is the single composition root — reads `DATA_SOURCE`/`REPOSITORY` from `backend/src/config/env.ts` and picks the implementation. Nothing in `routes/`, `services/`, or the frontend needs to know the difference. `index.ts` also branches on live-vs-mock mode: mock mode runs `bootstrap/seed.ts` (fabricates ~30 days, clears on every restart); live mode runs `bootstrap/poll.ts`'s `pollAndStore()` once at startup instead (never clears — real polls accumulate history) and again on every `POST /api/ingest` call (`backend/src/routes/ingest.routes.ts`, guarded by an `x-ingest-secret` header matching `INGEST_SECRET` — this is the endpoint the pg_cron job in `0002_ingestion_cron.sql` hits on a schedule).

Station codes are real UK CRS codes (`CBG`, `YRK`, `NCL`) specifically so a real rail API maps onto `StationCode` with zero schema change.

## Data model

Defined once in `shared/types.ts` and imported by both apps via the `@shared/*` path alias (no duplicated types, no drift):

- `StationCode` = `'CBG' | 'YRK' | 'NCL'` (constrained union, not free text — validated server-side too, in `backend/src/routes/validate-station.ts`)
- `ServiceRecord` — one train service: station, operator, date, scheduled time, status (`ON_TIME` / `DELAYED` / `CANCELLED`), delay minutes
- `ReliabilitySummaryResponse` / `OperatorBreakdownResponse` — the aggregated shapes the frontend actually consumes (raw records never leave the backend)

## Recommended next steps, in order

1. ~~Pick the real train-data API.~~ **Done** — LDBWS. See `backend/docs/data-source-decisions.md`.
2. ~~Write the real provider.~~ **Done** — `LdbwsTrainDataProvider`, tested. Not yet verified against the live API with real credentials (only unit-tested against a stubbed board fetcher).
3. ~~Build the `ReliabilityRepository` implementation against Supabase.~~ **Done** — `SupabaseReliabilityRepository`, tested against a stubbed client. Schema in `backend/supabase/migrations/0001_service_records.sql`, not yet applied to a real project.
4. ~~Wire both into `container.ts`.~~ **Done** — behind `DATA_SOURCE`/`REPOSITORY` env vars, both defaulting to mock/in-memory. See `backend/.env.example`.
5. ~~Run `backend/supabase/migrations/0001_service_records.sql` against the actual Supabase project and confirm the repository works against it.~~ **Done** — `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`REPOSITORY=supabase` are all set in `.env`, schema applied, `saveMany`/`findByStationAndRange` round-trip confirmed directly and through a full server run. One gotcha along the way: `service_role` was missing `SELECT`/`INSERT`/`UPDATE`/`DELETE` grants on the new table (had only `TRUNCATE`/`TRIGGER`/`REFERENCES` from Supabase's defaults) — fixed with an explicit `grant select, insert, update, delete on public.service_records to service_role;`. Worth checking for on any future table too.
6. **Add `INGEST_SECRET` to `.env`, set `DATA_SOURCE=ldbws`, and confirm one real poll against the live LDBWS API** — this exercises the currently-unverified base URL, auth header, and `std`/`etd` time format all at once. Heads up: with `REPOSITORY=supabase` already set and `DATA_SOURCE` still on its `mock` default, every server restart currently clears and refills `service_records` with ~30 days of fake data (`bootstrap/seed.ts`) — switching `DATA_SOURCE=ldbws` also switches to `bootstrap/poll.ts`'s non-destructive `pollAndStore()`, so do this before leaving real data in that table long-term.
7. **Deploy the backend somewhere with a public URL**, then run `backend/supabase/migrations/0002_ingestion_cron.sql` (needs that URL, plus an `ingest_secret` stored in Supabase Vault matching `INGEST_SECRET`) to start the recurring poll. Confirmed: `pg_cron` activity counts as project activity, so the Free-tier auto-pause won't kill a running poller.
8. Only after that: auth, deployment hardening, CI, error/retry handling around LDBWS's actual reliability.

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
- **A lazy-getter env accessor (`ingestConfig.secret`) that throws must be read inside a `try/catch`, not in an `if` condition ahead of one.** Express 4 doesn't catch synchronous throws from an async route handler unless they happen inside the `try` — an early version of `POST /api/ingest` checked the header against `ingestConfig.secret` *before* the `try` block, so a missing `INGEST_SECRET` crashed the whole process instead of 500ing that one request. Fixed by moving the check inside `try` in `backend/src/routes/ingest.routes.ts`. Worth checking any new route that reads a `requireEnv`-backed config value.
- **Raw `service_records` retention has no deletion/rollup logic, on purpose** — at ~9,000 rows/month across 3 stations, a year of raw history is nowhere near the Supabase Free tier's 500MB, so daily buckets and operator breakdowns stay computed on read from raw rows (unchanged, source-agnostic logic in `reliability-service.ts`) instead of being pre-aggregated. Revisit only if that stops being true.
- **A table created via the Supabase SQL Editor doesn't automatically get full `service_role` privileges** — after running `0001_service_records.sql`, `service_role` had `TRUNCATE`/`TRIGGER`/`REFERENCES` (from Supabase's schema-level defaults) but not `SELECT`/`INSERT`/`UPDATE`/`DELETE`, which produced a bare `permission denied for table service_records` (not an RLS-flavored error) from `SupabaseReliabilityRepository`. Fixed with an explicit grant (see step 5 above). Check `information_schema.table_privileges` first if a future table hits the same thing — it's a plain Postgres GRANT issue, not RLS, even though RLS is also enabled on this table.

## Known rough edges (not blockers, just not done)

- `npm audit` reports vulnerabilities in both `backend` and `frontend` dev dependencies (mostly transitive, from Angular CLI tooling / express ecosystem) — worth a look before shipping, not urgent for local dev.
- No E2E test suite (Cypress/Playwright) — only backend integration tests (vitest+supertest) and one frontend unit test (Karma/Jasmine) exist.
- The reliability chart renders at a fixed per-day width inside a horizontally-scrolling container rather than a fully responsive layout — fine for ~30 bars, would need revisiting for a longer date range.
- No loading/error states in the UI yet — if the backend is down, the dashboard just shows empty sections rather than an error message.
