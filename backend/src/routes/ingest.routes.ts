import { Router } from 'express';
import { pollAndStore } from '../bootstrap/poll.js';
import { ingestConfig } from '../config/env.js';
import type { TrainDataProvider } from '../providers/train-data-provider.interface.js';
import type { ReliabilityRepository } from '../repository/reliability-repository.interface.js';

// Target for the pg_cron + pg_net job (backend/supabase/migrations/0002_ingestion_cron.sql).
// Guarded by a shared secret, not auth, since it's a machine-to-machine poll trigger.
export function ingestRouter(provider: TrainDataProvider, repository: ReliabilityRepository): Router {
  const router = Router();

  router.post('/ingest', async (req, res) => {
    try {
      // ingestConfig.secret throws if INGEST_SECRET isn't set — read it
      // inside the try so a missing config value 500s this one request
      // instead of crashing the process (Express 4 doesn't catch async
      // handler throws that happen outside an awaited call).
      if (req.header('x-ingest-secret') !== ingestConfig.secret) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      await pollAndStore(provider, repository);
      res.json({ status: 'ok' });
    } catch (err) {
      console.error('Ingestion failed:', err);
      res.status(502).json({ error: 'Ingestion failed' });
    }
  });

  return router;
}
