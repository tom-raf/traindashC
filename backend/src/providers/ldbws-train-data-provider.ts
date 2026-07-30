import { type OperatorCode, type ServiceRecord, type ServiceStatus, type StationCode, type TrainOperator } from '@shared/types.js';
import { getDepartureBoard, type LdbwsClientConfig, type LdbwsServiceItem } from './ldbws-client.js';
import type { TrainDataProvider } from './train-data-provider.interface.js';

const ON_TIME_TOLERANCE_MINUTES = 5;

// Neither the OpenAPI spec nor the reference PDF confirms whether std/etd
// come back as "HH:mm" or "HHMM" — tolerant of both until a live response
// confirms one.
function parseHHMM(time: string): number | null {
  const match = /^(\d{2}):?(\d{2})$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// Normalizes whatever format LDBWS actually sends into our own "HH:mm"
// convention (shared/types.ts declares ServiceRecord.scheduledTime as
// 'HH:mm') so storage stays consistent regardless of the source format.
function toOurTimeFormat(time: string): string {
  const minutes = parseHHMM(time);
  if (minutes === null) return time;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// GetArrDepBoardWithDetails's ServiceItem has no `atd` (actual departure) — only
// Darwin's live estimate (`etd`), which is sometimes a real HH:mm time and
// sometimes a status string ("On time", "Delayed", "Cancelled", "No report").
// The exact string vocabulary isn't confirmed against a live response yet
// (not documented in the OpenAPI spec or the reference PDF) — verify this
// once real polling is running, and adjust below if other strings turn up.
export function deriveStatus(item: LdbwsServiceItem): { status: ServiceStatus; delayMinutes?: number } {
  if (item.isCancelled) {
    return { status: 'CANCELLED' };
  }

  const scheduled = item.std ? parseHHMM(item.std) : null;
  const estimated = item.etd ? parseHHMM(item.etd) : null;

  if (scheduled !== null && estimated !== null) {
    const delayMinutes = estimated - scheduled;
    return delayMinutes > ON_TIME_TOLERANCE_MINUTES ? { status: 'DELAYED', delayMinutes } : { status: 'ON_TIME' };
  }

  // etd wasn't a parseable time (e.g. "On time" or another status string).
  if (item.etd && /delay/i.test(item.etd)) {
    return { status: 'DELAYED' };
  }
  return { status: 'ON_TIME' };
}

export class LdbwsTrainDataProvider implements TrainDataProvider {
  constructor(
    private readonly config: LdbwsClientConfig,
    private readonly fetchBoard: typeof getDepartureBoard = getDepartureBoard,
  ) {}

  async getOperatorsForStation(station: StationCode): Promise<TrainOperator[]> {
    const board = await this.fetchBoard(this.config, station);
    const seen = new Map<OperatorCode, TrainOperator>();
    for (const item of board.trainServices ?? []) {
      if (!seen.has(item.operatorCode)) {
        seen.set(item.operatorCode, { code: item.operatorCode, name: item.operator });
      }
    }
    return [...seen.values()];
  }

  // LDBWS only ever returns "now" — `from`/`to` can't be honored for a live
  // board (see backend/docs/data-source-decisions.md), so they're ignored
  // here. The caller is expected to poll repeatedly over time to accumulate
  // history rather than expect a single call to backfill a date range.
  //
  // Record `id` is a composite key (station-operator-std-date), not LDBWS's
  // own `serviceID` (unconfirmed whether that's stable across separate
  // polls) — this also means repeated polls of the same still-running
  // service naturally upsert onto the same record as the estimate refines,
  // rather than accumulating duplicates.
  async getServiceRecords(query: { station: StationCode; from: string; to: string }): Promise<ServiceRecord[]> {
    const board = await this.fetchBoard(this.config, query.station);
    const today = new Date().toISOString().slice(0, 10);

    // Keyed by id, not pushed to an array: a single board snapshot can
    // contain two distinct services from the same operator at the same
    // displayed minute (rare, but real — hit in production). Since two
    // records sharing a composite id would make a single Supabase upsert
    // batch fail outright ("ON CONFLICT DO UPDATE command cannot affect row
    // a second time" — a Postgres restriction on the batch itself, not
    // about existing rows), the later one wins here, consistent with this
    // id scheme's existing "later poll refines the record" design intent.
    const records = new Map<string, ServiceRecord>();
    for (const item of board.trainServices ?? []) {
      if (!item.std) continue; // no scheduled departure at this station — skip
      const { status, delayMinutes } = deriveStatus(item);
      const scheduledTime = toOurTimeFormat(item.std);
      const id = `${query.station}-${item.operatorCode}-${scheduledTime}-${today}`;
      records.set(id, {
        id,
        stationCode: query.station,
        operatorCode: item.operatorCode,
        serviceDate: today,
        scheduledTime,
        status,
        delayMinutes,
      });
    }
    return [...records.values()];
  }
}
