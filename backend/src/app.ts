import cors from 'cors';
import express, { type Express } from 'express';
import { operatorsRouter } from './routes/operators.routes.js';
import { reliabilityRouter } from './routes/reliability.routes.js';
import { stationsRouter } from './routes/stations.routes.js';
import { reliabilityService } from './container.js';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', stationsRouter());
  app.use('/api', operatorsRouter(reliabilityService));
  app.use('/api', reliabilityRouter(reliabilityService));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
