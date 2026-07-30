import { describe, expect, it, vi } from 'vitest';
import type { ServiceRecord } from '@shared/types.js';
import { SupabaseReliabilityRepository } from '../repository/supabase-reliability-repository.js';

// Minimal stand-in for the slice of SupabaseClient's chainable query builder
// that SupabaseReliabilityRepository actually calls. Real integration
// (network, RLS, schema) isn't exercised here — that needs a live project.
function fakeClient(overrides: { upsert?: any; select?: any; delete?: any } = {}) {
  const from = vi.fn(() => ({
    upsert: overrides.upsert ?? vi.fn(async () => ({ error: null })),
    select: overrides.select,
    delete: overrides.delete,
  }));
  return { from } as any;
}

const record: ServiceRecord = {
  id: 'CBG-GN-07:00-2026-07-30',
  stationCode: 'CBG',
  operatorCode: 'GN',
  serviceDate: '2026-07-30',
  scheduledTime: '07:00',
  status: 'ON_TIME',
};

describe('SupabaseReliabilityRepository', () => {
  it('saveMany upserts mapped rows on id, and is a no-op for an empty list', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const client = fakeClient({ upsert });
    const repo = new SupabaseReliabilityRepository(client);

    await repo.saveMany([record]);

    expect(client.from).toHaveBeenCalledWith('service_records');
    expect(upsert).toHaveBeenCalledWith(
      [{ id: record.id, station_code: 'CBG', operator_code: 'GN', service_date: '2026-07-30', scheduled_time: '07:00', status: 'ON_TIME', delay_minutes: null }],
      { onConflict: 'id' },
    );

    await repo.saveMany([]);
    expect(upsert).toHaveBeenCalledTimes(1); // not called again for []
  });

  it('saveMany throws on a Supabase error', async () => {
    const client = fakeClient({ upsert: vi.fn(async () => ({ error: { message: 'boom' } })) });
    const repo = new SupabaseReliabilityRepository(client);

    await expect(repo.saveMany([record])).rejects.toThrow('Supabase saveMany failed: boom');
  });

  it('findByStationAndRange filters by station and date range, and maps rows back', async () => {
    const row = { id: record.id, station_code: 'CBG', operator_code: 'GN', service_date: '2026-07-30', scheduled_time: '07:00', status: 'ON_TIME', delay_minutes: null };
    const eq = vi.fn(() => ({ gte }));
    const gte = vi.fn(() => ({ lte }));
    const lte = vi.fn(async () => ({ data: [row], error: null }));
    const select = vi.fn(() => ({ eq }));
    const client = fakeClient({ select });
    const repo = new SupabaseReliabilityRepository(client);

    const result = await repo.findByStationAndRange('CBG', '2026-07-01', '2026-07-30');

    expect(eq).toHaveBeenCalledWith('station_code', 'CBG');
    expect(gte).toHaveBeenCalledWith('service_date', '2026-07-01');
    expect(lte).toHaveBeenCalledWith('service_date', '2026-07-30');
    expect(result).toEqual([record]);
  });

  it('clear deletes all rows', async () => {
    const neq = vi.fn(async () => ({ error: null }));
    const del = vi.fn(() => ({ neq }));
    const client = fakeClient({ delete: del });
    const repo = new SupabaseReliabilityRepository(client);

    await repo.clear();

    expect(neq).toHaveBeenCalledWith('id', '');
  });
});
