-- NOT runnable as-is — two manual substitutions needed first, and this file
-- deliberately doesn't carry real secrets since it's committed to git.
-- Do this in the Supabase SQL Editor once the backend is deployed somewhere
-- Supabase's network can reach (can't be done from local dev — see
-- HANDOFF.md "Recommended next steps").
--
-- 1. Store the ingest secret in Vault (must match INGEST_SECRET in the
--    backend's .env exactly). Run this line once, with a real random value,
--    then don't keep that value anywhere in this file:
--      select vault.create_secret('<a-long-random-value>', 'ingest_secret');
--
-- 2. Replace <BACKEND_URL> below with the deployed backend's URL.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'poll-ldbws-departure-boards',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := '<BACKEND_URL>/api/ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ingest_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To stop polling later: select cron.unschedule('poll-ldbws-departure-boards');
