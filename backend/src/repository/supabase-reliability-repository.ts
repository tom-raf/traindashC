import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceRecord, ServiceStatus, StationCode } from '@shared/types.js';
import type { ReliabilityRepository } from './reliability-repository.interface.js';

const TABLE = 'service_records';

interface ServiceRecordRow {
  id: string;
  station_code: StationCode;
  operator_code: string;
  service_date: string;
  scheduled_time: string;
  status: ServiceStatus;
  delay_minutes: number | null;
}

function toRow(record: ServiceRecord): ServiceRecordRow {
  return {
    id: record.id,
    station_code: record.stationCode,
    operator_code: record.operatorCode,
    service_date: record.serviceDate,
    scheduled_time: record.scheduledTime,
    status: record.status,
    delay_minutes: record.delayMinutes ?? null,
  };
}

function fromRow(row: ServiceRecordRow): ServiceRecord {
  return {
    id: row.id,
    stationCode: row.station_code,
    operatorCode: row.operator_code,
    serviceDate: row.service_date,
    scheduledTime: row.scheduled_time,
    status: row.status,
    delayMinutes: row.delay_minutes ?? undefined,
  };
}

// Schema: backend/supabase/migrations/0001_service_records.sql
export class SupabaseReliabilityRepository implements ReliabilityRepository {
  constructor(private readonly client: SupabaseClient) {}

  // Upsert on `id` (the composite station-operator-scheduledTime-date key
  // from LdbwsTrainDataProvider) so repeated polls of a still-running
  // service refine the same row as its estimate changes, instead of
  // accumulating duplicates. See backend/docs/data-source-decisions.md.
  async saveMany(records: ServiceRecord[]): Promise<void> {
    if (records.length === 0) return;
    const { error } = await this.client.from(TABLE).upsert(records.map(toRow), { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveMany failed: ${error.message}`);
  }

  async findByStationAndRange(station: StationCode, from: string, to: string): Promise<ServiceRecord[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('*')
      .eq('station_code', station)
      .gte('service_date', from)
      .lte('service_date', to);
    if (error) throw new Error(`Supabase findByStationAndRange failed: ${error.message}`);
    return ((data as ServiceRecordRow[] | null) ?? []).map(fromRow);
  }

  // Only meant for tests/local resets — real ingestion never calls this,
  // it upserts onto history instead (see saveMany above).
  async clear(): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().neq('id', '');
    if (error) throw new Error(`Supabase clear failed: ${error.message}`);
  }
}
