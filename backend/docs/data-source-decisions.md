# Data Source & Ingestion Decisions

Decision log for replacing `MockTrainDataProvider`/`InMemoryReliabilityRepository` (see `HANDOFF.md`) with a real data source. Reference material for the APIs discussed here lives alongside this file (`HSP - Open Rail Data Wiki.pdf`, `LDBWS Documentation.pdf`).

## 1. LDBWS over HSP

**Decision:** use the Live Departure Boards Web Service (LDBWS) as the real `TrainDataProvider`, not Historic Service Performance (HSP).

**Why:** LDBWS is station-centric — its `crs` parameter matches our per-station model directly — and each service item carries `isCancelled`, `cancelReason`, `delayReason`, and `operatorCode` fields directly, mapping almost 1:1 onto `ServiceRecord`. HSP is journey-pair based (`from_loc`/`to_loc`), would require synthesizing per-station data from representative route pairs, and cancellation isn't a direct field — it has to be inferred from a missing actual arrival, with a documented quirk where strike-cancelled services may be omitted entirely rather than flagged.

**Tradeoff accepted:** LDBWS has no historical backfill. Each poll only sees roughly ±120 minutes around "now," and a service drops off the board ~2 minutes after it departs/arrives — there's no way to query "last month" retroactively. The 30-day reliability view will start sparse and fill in as the poller accumulates real data over its first month of operation.

## 2. Continuous polling via Supabase's own scheduler, not Vercel Cron

**Decision:** ingestion runs as a Supabase `pg_cron` job (paired with `pg_net` for the outbound HTTP call) firing every few minutes, not a Vercel Cron job.

**Why:** Vercel's Hobby tier restricts Cron Job frequency well below what's needed here — LDBWS's narrow visibility window means a once-daily snapshot would only catch a handful of a station's services rather than a representative day. `pg_cron` runs inside Postgres itself, independent of Vercel entirely, and can fire every few minutes.

## 3. Supabase Free tier, standalone (not via Vercel integration)

**Decision:** host the database and scheduler on a Supabase project created directly, not through Vercel's Supabase marketplace integration.

**Why:** functionally identical either way — same underlying Supabase infrastructure and tier limits — but going standalone avoids coupling the data layer's lifecycle to Vercel's.

**Verified:** Supabase Free-tier projects auto-pause after a period of inactivity, but `pg_cron` activity counts toward keeping the project active (confirmed in Supabase's docs), so the poller won't cause the project to silently pause.

## 4. `LdbwsTrainDataProvider` built against the confirmed OpenAPI spec

**Decision:** implemented in `backend/src/providers/ldbws-train-data-provider.ts`, calling `GetDepartureBoard` (not the `WithDetails` variant — that caps at 9 rows vs. 149, and we don't need calling-point detail). Base URL, path, and query params confirmed against `backend/docs/ldbws-swagger-json.txt`; auth header confirmed as `x-apikey` from the marketplace subscription page (not present in the OpenAPI spec itself — that's a gateway-level concern, not part of the underlying service's contract).

**Correction to the original plan:** `ServiceItem` (what `GetDepartureBoard` returns) has no `atd` (actual departure) — only `std`/`etd`. Actual times only exist via a separate `GetServiceDetails/{serviceID}` call. Rather than add a second call per service, status is derived from `isCancelled` + `etd` vs `std` — a live estimate, not a confirmed outcome. Revisit if this proves too noisy once real polling data is flowing.

**`serviceID` stability — resolved by design, not by verification:** rather than confirm whether it's stable across polls, `ServiceRecord.id` uses a composite key (`station-operator-std-date`) instead. This also means repeated polls of the same in-progress service naturally upsert onto the same record as the estimate refines, rather than accumulating duplicates.

## Open questions (not yet resolved)

- **Raw-data retention / aggregation granularity:** still deciding between rolling raw records into daily buckets (matching the existing `DailyReliabilityBucket` shape already used by the frontend) versus a coarser weekly aggregate-then-delete. Data volume is small enough (~9,000 rows/month across 3 stations) that storage isn't a real constraint — leaning toward daily rollups with a short retention buffer on raw records rather than aggressive weekly deletion, but not finalized.
- **LDBWS rate limits:** not yet confirmed what call frequency the Rail Data Marketplace subscription actually permits.
- **LDBWS `std`/`etd` time format:** not confirmed as `"HH:mm"` vs `"HHMM"` from the docs — `LdbwsTrainDataProvider` tolerates both, but hasn't been checked against an actual live response yet.
- **Live API not yet tested end-to-end** — `LdbwsTrainDataProvider` is unit-tested against a stubbed board fetcher, not yet exercised against the real endpoint with real credentials.
