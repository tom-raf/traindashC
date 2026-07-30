import { Router } from 'express';
import { STATION_INFO } from '@shared/types.js';

export function stationsRouter(): Router {
  const router = Router();

  router.get('/stations', (_req, res) => {
    res.json(Object.values(STATION_INFO));
  });

  return router;
}
