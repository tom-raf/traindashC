import { createApp } from './app.js';
import { provider, repository } from './container.js';
import { seed } from './bootstrap/seed.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function main(): Promise<void> {
  await seed(provider, repository);

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Train Dash backend listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
