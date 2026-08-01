import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { seed } from '../bootstrap/seed.js';
import { MockTrainDataProvider } from '../providers/mock-train-data-provider.js';
import { InMemoryReliabilityRepository } from '../repository/in-memory-reliability-repository.js';
import { ReliabilityService } from '../services/reliability-service.js';

// Explicit mock/in-memory deps, not the ambient container.js composition
// root: that's wired from DATA_SOURCE/REPOSITORY env vars, so importing it
// here would make this suite silently hit real LDBWS/Supabase whenever a
// developer happens to have those set in .env for other work.
const provider = new MockTrainDataProvider();
const repository = new InMemoryReliabilityRepository();
const reliabilityService = new ReliabilityService(repository, provider);
const app = createApp({ provider, repository, reliabilityService });

beforeAll(async () => {
  await seed(provider, repository);
});

describe('GET /api/stations', () => {
  it('returns the fixed 4 stations', async () => {
    const res = await request(app).get('/api/stations');
    expect(res.status).toBe(200);
    expect(res.body.map((s: { code: string }) => s.code)).toEqual(['CBG', 'YRK', 'NCL', 'MAN']);
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

describe('a route whose dependency throws', () => {
  it('responds 500 instead of crashing the process (regression: this took down the deployed server)', async () => {
    const throwingProvider = new MockTrainDataProvider();
    const throwingRepository = new InMemoryReliabilityRepository();
    throwingRepository.findByStationAndRange = async () => {
      throw new Error('simulated transient failure');
    };
    const throwingService = new ReliabilityService(throwingRepository, throwingProvider);
    const throwingApp = createApp({ provider: throwingProvider, repository: throwingRepository, reliabilityService: throwingService });

    const res = await request(throwingApp).get('/api/stations/CBG/reliability');

    expect(res.status).toBe(500);
    // If this handler weren't wrapped in asyncHandler, the rejection above
    // would be unhandled and this test process itself would crash instead
    // of reaching this assertion at all.
    const healthRes = await request(throwingApp).get('/api/health');
    expect(healthRes.status).toBe(200);
  });
});
