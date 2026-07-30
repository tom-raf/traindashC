import { STATIONS } from '@shared/types.js';
import type { TrainDataProvider } from '../providers/train-data-provider.interface.js';
import type { ReliabilityRepository } from '../repository/reliability-repository.interface.js';

const SEED_RANGE_DAYS = 30;

export async function seed(provider: TrainDataProvider, repository: ReliabilityRepository): Promise<void> {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (SEED_RANGE_DAYS - 1));
  const range = { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };

  await repository.clear();

  for (const station of STATIONS) {
    const records = await provider.getServiceRecords({ station, ...range });
    await repository.saveMany(records);
  }
}
