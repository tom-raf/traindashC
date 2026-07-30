-- One manual step needed first, in the Supabase SQL Editor: store the
-- ingest secret in Vault, matching the INGEST_SECRET value set in Render's
-- dashboard exactly (not necessarily any local .env's value — those are
-- independent copies, only Render's actual value matters here). Run this
-- once, then don't keep the real value anywhere in this file, since it's
-- committed to git:
--   select vault.create_secret('<Render's INGEST_SECRET value>', 'ingest_secret');
--
-- The backend URL below is public, safe to commit: https://traindash-backend.onrender.com

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'poll-ldbws-departure-boards',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://traindash-backend.onrender.com/api/ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ingest_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To stop polling later: select cron.unschedule('poll-ldbws-departure-boards');
