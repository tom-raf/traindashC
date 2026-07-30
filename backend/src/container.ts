import { MockTrainDataProvider } from './providers/mock-train-data-provider.js';
import { InMemoryReliabilityRepository } from './repository/in-memory-reliability-repository.js';
import { ReliabilityService } from './services/reliability-service.js';

// Composition root: the one place to edit when swapping the data provider
// (mock -> real API) or the repository (in-memory -> a real database).
export const provider = new MockTrainDataProvider();
export const repository = new InMemoryReliabilityRepository();
export const reliabilityService = new ReliabilityService(repository, provider);
