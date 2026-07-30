import { describe, expect, it } from 'vitest';
import type { LdbwsClientConfig, LdbwsServiceItem, LdbwsStationBoard } from '../providers/ldbws-client.js';
import { deriveStatus, LdbwsTrainDataProvider } from '../providers/ldbws-train-data-provider.js';

const config: LdbwsClientConfig = { baseUrl: 'https://example.invalid', apiKey: 'test-key', authHeader: 'x-apikey' };

function serviceItem(overrides: Partial<LdbwsServiceItem>): LdbwsServiceItem {
  return { operator: 'LNER', operatorCode: 'GR', serviceID: 'abc123', std: '0700', etd: '0700', ...overrides };
}

describe('deriveStatus', () => {
  it('is CANCELLED when isCancelled is true, regardless of etd', () => {
    expect(deriveStatus(serviceItem({ isCancelled: true, etd: '0705' }))).toEqual({ status: 'CANCELLED' });
  });

  it('is ON_TIME when etd matches std', () => {
    expect(deriveStatus(serviceItem({ std: '0700', etd: '0700' }))).toEqual({ status: 'ON_TIME' });
  });

  it('is ON_TIME when the delay is within tolerance', () => {
    expect(deriveStatus(serviceItem({ std: '0700', etd: '0703' }))).toEqual({ status: 'ON_TIME' });
  });

  it('is DELAYED with delayMinutes when etd is a parseable time beyond tolerance', () => {
    expect(deriveStatus(serviceItem({ std: '0700', etd: '0715' }))).toEqual({ status: 'DELAYED', delayMinutes: 15 });
  });

  it('is ON_TIME when etd is a non-parseable status string like "On time"', () => {
    expect(deriveStatus(serviceItem({ std: '0700', etd: 'On time' }))).toEqual({ status: 'ON_TIME' });
  });

  it('is DELAYED with no delayMinutes when etd is a non-parseable "Delayed" string', () => {
    expect(deriveStatus(serviceItem({ std: '0700', etd: 'Delayed' }))).toEqual({ status: 'DELAYED' });
  });
});

describe('LdbwsTrainDataProvider', () => {
  function fakeBoard(trainServices: LdbwsServiceItem[]): LdbwsStationBoard {
    return { generatedAt: '2026-07-30T12:00:00Z', locationName: 'Cambridge', crs: 'CBG', trainServices };
  }

  it('getOperatorsForStation returns unique operators from the board', async () => {
    const fetchBoard = async () =>
      fakeBoard([
        serviceItem({ operatorCode: 'GN', operator: 'Great Northern', std: '0700' }),
        serviceItem({ operatorCode: 'GN', operator: 'Great Northern', std: '0730' }),
        serviceItem({ operatorCode: 'XC', operator: 'CrossCountry', std: '0745' }),
      ]);
    const provider = new LdbwsTrainDataProvider(config, fetchBoard);

    const operators = await provider.getOperatorsForStation('CBG');

    expect(operators).toEqual([
      { code: 'GN', name: 'Great Northern' },
      { code: 'XC', name: 'CrossCountry' },
    ]);
  });

  it('getServiceRecords maps board items to ServiceRecords and skips items with no std', async () => {
    const fetchBoard = async () =>
      fakeBoard([
        serviceItem({ operatorCode: 'GN', std: '0700', etd: '0700' }),
        serviceItem({ operatorCode: 'XC', std: undefined, etd: '0800' }),
        serviceItem({ operatorCode: 'GA', std: '0810', isCancelled: true }),
      ]);
    const provider = new LdbwsTrainDataProvider(config, fetchBoard);

    const records = await provider.getServiceRecords({ station: 'CBG', from: '2026-07-01', to: '2026-07-30' });

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ stationCode: 'CBG', operatorCode: 'GN', scheduledTime: '07:00', status: 'ON_TIME' });
    expect(records[1]).toMatchObject({ stationCode: 'CBG', operatorCode: 'GA', scheduledTime: '08:10', status: 'CANCELLED' });
  });

  it('produces a stable composite id independent of LDBWS serviceID', async () => {
    const fetchBoard = async () => fakeBoard([serviceItem({ operatorCode: 'GN', std: '0700', serviceID: 'poll-1-id' })]);
    const provider = new LdbwsTrainDataProvider(config, fetchBoard);

    const records = await provider.getServiceRecords({ station: 'CBG', from: '2026-07-01', to: '2026-07-30' });

    expect(records[0].id).toBe(`CBG-GN-07:00-${new Date().toISOString().slice(0, 10)}`);
  });
});
