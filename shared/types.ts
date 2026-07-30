// Single source of truth for data shapes shared between backend and frontend.
// Referenced via tsconfig `paths` from both projects — keep this file dependency-free.

export const STATIONS = ['CBG', 'YRK', 'NCL'] as const;
export type StationCode = (typeof STATIONS)[number];

export interface StationInfo {
  code: StationCode;
  name: string;
}

export const STATION_INFO: Record<StationCode, StationInfo> = {
  CBG: { code: 'CBG', name: 'Cambridge' },
  YRK: { code: 'YRK', name: 'York' },
  NCL: { code: 'NCL', name: 'Newcastle' },
};

export type OperatorCode = string;

export interface TrainOperator {
  code: OperatorCode;
  name: string;
}

export type ServiceStatus = 'ON_TIME' | 'DELAYED' | 'CANCELLED';

export interface ServiceRecord {
  id: string;
  stationCode: StationCode;
  operatorCode: OperatorCode;
  serviceDate: string; // 'YYYY-MM-DD'
  scheduledTime: string; // 'HH:mm'
  status: ServiceStatus;
  delayMinutes?: number;
}

export interface DailyReliabilityBucket {
  date: string; // 'YYYY-MM-DD'
  onTime: number;
  delayed: number;
  cancelled: number;
}

export interface ReliabilitySummaryResponse {
  station: StationInfo;
  from: string;
  to: string;
  daily: DailyReliabilityBucket[];
  totals: {
    onTime: number;
    delayed: number;
    cancelled: number;
  };
}

export interface OperatorBreakdownEntry {
  operator: TrainOperator;
  totalServices: number;
  onTime: number;
  delayed: number;
  cancelled: number;
  onTimePercentage: number;
}

export interface OperatorBreakdownResponse {
  station: StationInfo;
  from: string;
  to: string;
  operators: OperatorBreakdownEntry[];
}
