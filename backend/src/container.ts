import { createClient } from '@supabase/supabase-js';
import { dataSourceMode, ldbwsConfig, repositoryMode, supabaseConfig } from './config/env.js';
import { LdbwsTrainDataProvider } from './providers/ldbws-train-data-provider.js';
import { MockTrainDataProvider } from './providers/mock-train-data-provider.js';
import type { TrainDataProvider } from './providers/train-data-provider.interface.js';
import { InMemoryReliabilityRepository } from './repository/in-memory-reliability-repository.js';
import type { ReliabilityRepository } from './repository/reliability-repository.interface.js';
import { SupabaseReliabilityRepository } from './repository/supabase-reliability-repository.js';
import { ReliabilityService } from './services/reliability-service.js';

// Composition root: the one place to edit when swapping the data provider
// (mock <-> LDBWS, via DATA_SOURCE) or the repository (in-memory <->
// Supabase, via REPOSITORY). See backend/docs/data-source-decisions.md and
// backend/.env.example for what each mode needs.
export const provider: TrainDataProvider =
  dataSourceMode === 'ldbws' ? new LdbwsTrainDataProvider(ldbwsConfig) : new MockTrainDataProvider();

export const repository: ReliabilityRepository =
  repositoryMode === 'supabase'
    ? new SupabaseReliabilityRepository(createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey))
    : new InMemoryReliabilityRepository();

export const reliabilityService = new ReliabilityService(repository, provider);

// index.ts uses this to decide startup behavior: seed() fabricates ~30 days
// of mock data (only valid for MockTrainDataProvider), while live mode runs
// one real pollAndStore() so there's at least a first snapshot before the
// pg_cron job's next scheduled run.
export const isLiveMode = dataSourceMode === 'ldbws';
