import { Router } from 'express';
import type { StationCode } from '@shared/types.js';
import type { ReliabilityService } from '../services/reliability-service.js';
import { validateStationParam } from './validate-station.js';

export function reliabilityRouter(service: ReliabilityService): Router {
  const router = Router();

  router.get('/stations/:code/reliability', validateStationParam, async (req, res) => {
    const { from, to } = req.query;
    const summary = await service.getReliabilitySummary(
      req.params.code as StationCode,
      typeof from === 'string' ? from : undefined,
      typeof to === 'string' ? to : undefined,
    );
    res.json(summary);
  });

  router.get('/stations/:code/operator-breakdown', validateStationParam, async (req, res) => {
    const { from, to } = req.query;
    const breakdown = await service.getOperatorBreakdown(
      req.params.code as StationCode,
      typeof from === 'string' ? from : undefined,
      typeof to === 'string' ? to : undefined,
    );
    res.json(breakdown);
  });

  return router;
}
