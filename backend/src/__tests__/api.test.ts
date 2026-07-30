import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { provider, repository } from '../container.js';
import { seed } from '../bootstrap/seed.js';

const app = createApp();

beforeAll(async () => {
  await seed(provider, repository);
});

describe('GET /api/stations', () => {
  it('returns the fixed 3 stations', async () => {
    const res = await request(app).get('/api/stations');
    expect(res.status).toBe(200);
    expect(res.body.map((s: { code: string }) => s.code)).toEqual(['CBG', 'YRK', 'NCL']);
  });
});

describe('GET /api/stations/:code/reliability', () => {
  it('returns daily buckets that sum to totals', async () => {
    const res = await request(app).get('/api/stations/CBG/reliability');
    expect(res.status).toBe(200);
    const summed = res.body.daily.reduce(
      (acc: any, d: any) => ({
        onTime: acc.onTime + d.onTime,
        delayed: acc.delayed + d.delayed,
        cancelled: acc.cancelled + d.cancelled,
      }),
      { onTime: 0, delayed: 0, cancelled: 0 },
    );
    expect(summed).toEqual(res.body.totals);
  });

  it('rejects an unknown station code', async () => {
    const res = await request(app).get('/api/stations/ZZZ/reliability');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/stations/:code/operator-breakdown', () => {
  it('returns percentages within 0-100', async () => {
    const res = await request(app).get('/api/stations/YRK/operator-breakdown');
    expect(res.status).toBe(200);
    for (const entry of res.body.operators) {
      expect(entry.onTimePercentage).toBeGreaterThanOrEqual(0);
      expect(entry.onTimePercentage).toBeLessThanOrEqual(100);
    }
  });
});
