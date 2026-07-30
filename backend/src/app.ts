import cors from 'cors';
import express, { type Express } from 'express';
import * as defaultContainer from './container.js';
import type { TrainDataProvider } from './providers/train-data-provider.interface.js';
import type { ReliabilityRepository } from './repository/reliability-repository.interface.js';
import { ingestRouter } from './routes/ingest.routes.js';
import { operatorsRouter } from './routes/operators.routes.js';
import { reliabilityRouter } from './routes/reliability.routes.js';
import { stationsRouter } from './routes/stations.routes.js';
import type { ReliabilityService } from './services/reliability-service.js';

export interface AppDeps {
  provider: TrainDataProvider;
  repository: ReliabilityRepository;
  reliabilityService: ReliabilityService;
}

// Defaults to the real composition root (container.ts, env-var driven) for
// the actual server entrypoint (index.ts). Tests should pass their own
// deps explicitly instead of relying on this default — container.ts's
// wiring depends on ambient DATA_SOURCE/REPOSITORY env vars, so importing
// it implicitly meant tests could silently hit real LDBWS/Supabase
// depending on whatever happened to be in .env at the time.
export function createApp(deps: AppDeps = defaultContainer): Express {
  const { provider, repository, reliabilityService } = deps;
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', stationsRouter());
  app.use('/api', operatorsRouter(reliabilityService));
  app.use('/api', reliabilityRouter(reliabilityService));
  app.use('/api', ingestRouter(provider, repository));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
