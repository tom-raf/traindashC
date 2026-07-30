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
  if (isLiveMode) {
    await pollAndStore(provider, repository);
  } else {
    await seed(provider, repository);
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
