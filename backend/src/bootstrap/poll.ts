import { STATIONS } from '@shared/types.js';
import type { TrainDataProvider } from '../providers/train-data-provider.interface.js';
import type { ReliabilityRepository } from '../repository/reliability-repository.interface.js';

// One poll = one snapshot of "now" for every station. Called once at server
// startup (so there's data immediately in live mode) and by POST /api/ingest
// (the pg_cron target) on a schedule. Unlike seed(), this never clears —
// each poll upserts onto accumulated history rather than replacing it.
export async function pollAndStore(provider: TrainDataProvider, repository: ReliabilityRepository): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  for (const station of STATIONS) {
    const records = await provider.getServiceRecords({ station, from: today, to: today });
    await repository.saveMany(records);
  }
}
