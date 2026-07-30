import {
  STATION_INFO,
  type DailyReliabilityBucket,
  type OperatorBreakdownEntry,
  type OperatorBreakdownResponse,
  type ReliabilitySummaryResponse,
  type ServiceRecord,
  type StationCode,
} from '@shared/types.js';
import type { ReliabilityRepository } from '../repository/reliability-repository.interface.js';
import type { TrainDataProvider } from '../providers/train-data-provider.interface.js';

const DEFAULT_RANGE_DAYS = 30;

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export class ReliabilityService {
  constructor(
    private readonly repository: ReliabilityRepository,
    private readonly provider: TrainDataProvider,
  ) {}

  async getOperatorsForStation(station: StationCode) {
    return this.provider.getOperatorsForStation(station);
  }

  async getReliabilitySummary(station: StationCode, from?: string, to?: string): Promise<ReliabilitySummaryResponse> {
    const range = from && to ? { from, to } : defaultRange();
    const records = await this.repository.findByStationAndRange(station, range.from, range.to);

    const byDate = new Map<string, DailyReliabilityBucket>();
    for (const record of records) {
      const bucket = byDate.get(record.serviceDate) ?? { date: record.serviceDate, onTime: 0, delayed: 0, cancelled: 0 };
      incrementForStatus(bucket, record);
      byDate.set(record.serviceDate, bucket);
    }

    const daily = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const totals = daily.reduce(
      (acc, bucket) => ({
        onTime: acc.onTime + bucket.onTime,
        delayed: acc.delayed + bucket.delayed,
        cancelled: acc.cancelled + bucket.cancelled,
      }),
      { onTime: 0, delayed: 0, cancelled: 0 },
    );

    return { station: STATION_INFO[station], from: range.from, to: range.to, daily, totals };
  }

  async getOperatorBreakdown(station: StationCode, from?: string, to?: string): Promise<OperatorBreakdownResponse> {
    const range = from && to ? { from, to } : defaultRange();
    const [records, knownOperators] = await Promise.all([
      this.repository.findByStationAndRange(station, range.from, range.to),
      this.provider.getOperatorsForStation(station),
    ]);
    // Name lookup comes from the provider, not a static table: a live
    // station can see operator codes the mock data never used (e.g. LDBWS's
    // "LE" for Greater Anglia, vs. the mock's "GA"), and a fixed table can't
    // know about those in advance. Falls back to the code itself so a
    // provider hiccup never breaks the response.
    const operatorByCode = new Map(knownOperators.map((operator) => [operator.code, operator]));

    const byOperator = new Map<string, { onTime: number; delayed: number; cancelled: number }>();
    for (const record of records) {
      const bucket = byOperator.get(record.operatorCode) ?? { onTime: 0, delayed: 0, cancelled: 0 };
      incrementForStatus(bucket, record);
      byOperator.set(record.operatorCode, bucket);
    }

    const operators: OperatorBreakdownEntry[] = [...byOperator.entries()].map(([operatorCode, counts]) => {
      const totalServices = counts.onTime + counts.delayed + counts.cancelled;
      return {
        operator: operatorByCode.get(operatorCode) ?? { code: operatorCode, name: operatorCode },
        totalServices,
        onTime: counts.onTime,
        delayed: counts.delayed,
        cancelled: counts.cancelled,
        onTimePercentage: totalServices === 0 ? 0 : Math.round((counts.onTime / totalServices) * 1000) / 10,
      };
    });

    operators.sort((a, b) => b.onTimePercentage - a.onTimePercentage);

    return { station: STATION_INFO[station], from: range.from, to: range.to, operators };
  }
}

function incrementForStatus(bucket: { onTime: number; delayed: number; cancelled: number }, record: ServiceRecord): void {
  if (record.status === 'ON_TIME') bucket.onTime += 1;
  else if (record.status === 'DELAYED') bucket.delayed += 1;
  else bucket.cancelled += 1;
}
