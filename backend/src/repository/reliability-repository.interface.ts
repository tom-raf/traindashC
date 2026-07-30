import type { ServiceRecord, StationCode } from '@shared/types.js';

/**
 * Storage boundary for service records. InMemoryReliabilityRepository is the
 * only implementation today. A future SQLite/Postgres-backed implementation
 * of this same interface is a drop-in swap in container.ts — no changes
 * needed in routes/ or services/.
 */
export interface ReliabilityRepository {
  saveMany(records: ServiceRecord[]): Promise<void>;
  findByStationAndRange(station: StationCode, from: string, to: string): Promise<ServiceRecord[]>;
  clear(): Promise<void>;
}
