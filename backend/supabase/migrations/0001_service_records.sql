-- Run once in the Supabase SQL Editor (or via `supabase db push` if the
-- project is linked with the CLI). Mirrors shared/types.ts's ServiceRecord.
--
-- No retention/deletion logic: at ~9,000 rows/month across 3 stations, a
-- year of raw history is nowhere near the Free tier's 500MB, so daily
-- buckets and operator breakdowns (backend/src/services/reliability-service.ts)
-- are computed on read from raw rows rather than pre-aggregated. Revisit if
-- that ever stops being true. See backend/docs/data-source-decisions.md.

create table if not exists service_records (
  id text primary key,
  station_code text not null,
  operator_code text not null,
  service_date date not null,
  scheduled_time text not null,
  status text not null check (status in ('ON_TIME', 'DELAYED', 'CANCELLED')),
  delay_minutes integer,
  created_at timestamptz not null default now()
);

-- Every read is scoped to one station and a date range (findByStationAndRange).
create index if not exists service_records_station_date_idx
  on service_records (station_code, service_date);
