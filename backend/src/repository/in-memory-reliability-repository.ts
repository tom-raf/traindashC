import type { ServiceRecord, StationCode } from '@shared/types.js';
import type { ReliabilityRepository } from './reliability-repository.interface.js';

export class InMemoryReliabilityRepository implements ReliabilityRepository {
  private records: ServiceRecord[] = [];

  async saveMany(records: ServiceRecord[]): Promise<void> {
    this.records.push(...records);
  }

  async findByStationAndRange(station: StationCode, from: string, to: string): Promise<ServiceRecord[]> {
    return this.records.filter((r) => r.stationCode === station && r.serviceDate >= from && r.serviceDate <= to);
  }

  async clear(): Promise<void> {
    this.records = [];
  }
}
