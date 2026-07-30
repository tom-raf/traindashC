import type { NextFunction, Request, Response } from 'express';
import { STATIONS, type StationCode } from '@shared/types.js';

const STATION_SET = new Set<string>(STATIONS);

export function isStationCode(value: string): value is StationCode {
  return STATION_SET.has(value);
}

export function validateStationParam(req: Request, res: Response, next: NextFunction): void {
  const code = req.params.code;
  if (!isStationCode(code)) {
    res.status(400).json({ error: `Unknown station code "${code}". Expected one of: ${STATIONS.join(', ')}` });
    return;
  }
  next();
}
