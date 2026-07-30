import type { ServiceRecord, StationCode, TrainOperator } from '@shared/types.js';
import { ALL_OPERATORS, OPERATOR_PROFILES, SERVICES_PER_OPERATOR_PER_DAY, STATION_OPERATORS } from '../config/stations.js';
import type { TrainDataProvider } from './train-data-provider.interface.js';

// Simple string hash -> 32-bit seed, feeding a mulberry32 PRNG. Deterministic
// per (station, operator, date) so demo data looks stable across restarts
// while still varying day-to-day and operator-to-operator.
function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    dates.push(toDateString(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export class MockTrainDataProvider implements TrainDataProvider {
  async getOperatorsForStation(station: StationCode): Promise<TrainOperator[]> {
    return STATION_OPERATORS[station].map((code) => ALL_OPERATORS[code]);
  }

  async getServiceRecords(query: { station: StationCode; from: string; to: string }): Promise<ServiceRecord[]> {
    const { station, from, to } = query;
    const operatorCodes = STATION_OPERATORS[station];
    const records: ServiceRecord[] = [];

    for (const date of eachDate(from, to)) {
      for (const operatorCode of operatorCodes) {
        const profile = OPERATOR_PROFILES[operatorCode];
        const rand = mulberry32(hashSeed(`${station}|${operatorCode}|${date}`));

        for (let i = 0; i < SERVICES_PER_OPERATOR_PER_DAY; i++) {
          const roll = rand();
          const status = roll < profile.cancelledRate ? 'CANCELLED' : roll < profile.cancelledRate + (1 - profile.onTimeRate - profile.cancelledRate) ? 'DELAYED' : 'ON_TIME';

          const hour = (5 + Math.floor((i / SERVICES_PER_OPERATOR_PER_DAY) * 18)).toString().padStart(2, '0');
          const minute = Math.floor(rand() * 60)
            .toString()
            .padStart(2, '0');

          records.push({
            id: `${station}-${operatorCode}-${date}-${i}`,
            stationCode: station,
            operatorCode,
            serviceDate: date,
            scheduledTime: `${hour}:${minute}`,
            status,
            delayMinutes: status === 'DELAYED' ? 3 + Math.floor(rand() * 27) : undefined,
          });
        }
      }
    }

    return records;
  }
}
