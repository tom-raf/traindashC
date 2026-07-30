import { config as loadDotenv } from 'dotenv';

loadDotenv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Lazy getters so importing this module doesn't fail for code paths that
// never actually touch LDBWS (e.g. MockTrainDataProvider, still the active
// default in container.ts).
export const ldbwsConfig = {
  get baseUrl(): string {
    return process.env.LDBWS_BASE_URL ?? 'https://realtime.nationalrail.co.uk/LDBWS';
  },
  get apiKey(): string {
    return requireEnv('LDBWS_API_KEY');
  },
  get authHeader(): string {
    return process.env.LDBWS_AUTH_HEADER ?? 'x-apikey';
  },
};
