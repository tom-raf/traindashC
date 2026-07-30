import type { ServiceRecord, StationCode, TrainOperator } from '@shared/types.js';

/**
 * Adapter boundary for a train-data source. Today this is implemented by
 * MockTrainDataProvider (generated seed data). Later, a real provider (e.g.
 * against National Rail Darwin/OpenLDBWS or RTT.io) implements this same
 * interface — only container.ts needs to change to swap it in.
 */
export interface TrainDataProvider {
  getOperatorsForStation(station: StationCode): Promise<TrainOperator[]>;
  getServiceRecords(query: { station: StationCode; from: string; to: string }): Promise<ServiceRecord[]>;
}
