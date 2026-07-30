import { Router } from 'express';
import type { StationCode } from '@shared/types.js';
import type { ReliabilityService } from '../services/reliability-service.js';
import { validateStationParam } from './validate-station.js';

export function operatorsRouter(service: ReliabilityService): Router {
  const router = Router();

  router.get('/stations/:code/operators', validateStationParam, async (req, res) => {
    const operators = await service.getOperatorsForStation(req.params.code as StationCode);
    res.json(operators);
  });

  return router;
}
