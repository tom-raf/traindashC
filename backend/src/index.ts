import { createApp } from './app.js';
import { isLiveMode, provider, repository } from './container.js';
import { seed } from './bootstrap/seed.js';
import { pollAndStore } from './bootstrap/poll.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function main(): Promise<void> {
  // Mock mode: fabricate ~30 days of history (seed() clears + regenerates
  // every restart). Live mode: don't clear real accumulated data — just run
  // one immediate poll so there's a first snapshot without waiting for the
  // next pg_cron tick.
  //
  // Caught, not awaited-to-fail: this is a best-effort warm-up, not a
  // precondition for the server to be useful. A transient LDBWS/Supabase
  // failure here shouldn't take down health checks and reads that don't
  // depend on it succeeding — and in live mode, POST /api/ingest (the
  // pg_cron target) will just try again on its own schedule regardless.
  try {
    if (isLiveMode) {
      await pollAndStore(provider, repository);
    } else {
      await seed(provider, repository);
    }
  } catch (err) {
    console.error('Startup data warm-up failed (server will still start):', err);
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Train Dash backend listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
