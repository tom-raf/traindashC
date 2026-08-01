import type { OperatorCode, StationCode, TrainOperator } from '@shared/types.js';

export const ALL_OPERATORS: Record<OperatorCode, TrainOperator> = {
  GR: { code: 'GR', name: 'LNER' },
  XC: { code: 'XC', name: 'CrossCountry' },
  TP: { code: 'TP', name: 'TransPennine Express' },
  NT: { code: 'NT', name: 'Northern' },
  GA: { code: 'GA', name: 'Greater Anglia' },
  GN: { code: 'GN', name: 'Great Northern' },
};

// Which operators serve each station, and each operator's baked-in reliability
// profile (used by the mock provider to generate believable, differentiated data).
export const STATION_OPERATORS: Record<StationCode, OperatorCode[]> = {
  CBG: ['GN', 'GA', 'XC'],
  YRK: ['GR', 'TP', 'XC', 'NT'],
  NCL: ['GR', 'XC', 'NT', 'TP'],
  MAN: ['TP', 'NT', 'XC'],
};

export interface OperatorProfile {
  onTimeRate: number;
  cancelledRate: number;
  // delayed rate is whatever remains after onTime + cancelled
}

export const OPERATOR_PROFILES: Record<OperatorCode, OperatorProfile> = {
  GR: { onTimeRate: 0.84, cancelledRate: 0.04 },
  XC: { onTimeRate: 0.8, cancelledRate: 0.05 },
  TP: { onTimeRate: 0.78, cancelledRate: 0.06 },
  NT: { onTimeRate: 0.75, cancelledRate: 0.07 },
  GA: { onTimeRate: 0.82, cancelledRate: 0.05 },
  GN: { onTimeRate: 0.81, cancelledRate: 0.05 },
};

export const SERVICES_PER_OPERATOR_PER_DAY = 12;
