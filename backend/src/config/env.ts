import { config as loadDotenv } from 'dotenv';

loadDotenv();

// Trimmed defensively: dotenv trims whitespace around `=` in a local .env
// file, but a value pasted into a hosting provider's dashboard field (e.g.
// Render, Vercel) has no such guarantee — a stray leading/trailing space or
// newline from a copy-paste becomes part of the literal value, which for a
// URL or API key can produce a working-looking config that still fails
// every request.
function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Lazy getters so importing this module doesn't fail for code paths that
// never actually touch LDBWS (e.g. MockTrainDataProvider, still the active
// default in container.ts).
export const ldbwsConfig = {
  // No guessed default here on purpose — an earlier version defaulted to
  // https://realtime.nationalrail.co.uk/LDBWS, which turned out to be wrong.
  // The real URL is the Rail Data Marketplace gateway for this specific
  // subscribed product (see backend/.env.example), not the origin service.
  get baseUrl(): string {
    return requireEnv('LDBWS_BASE_URL');
  },
  get apiKey(): string {
    return requireEnv('LDBWS_API_KEY');
  },
  get authHeader(): string {
    return process.env.LDBWS_AUTH_HEADER?.trim() || 'x-apikey';
  },
};

export const supabaseConfig = {
  get url(): string {
    return requireEnv('SUPABASE_URL');
  },
  // Server-side only — bypasses row-level security. Never expose this to the frontend.
  get serviceRoleKey(): string {
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  },
};

// Shared secret checked on POST /api/ingest, so that endpoint can't be used
// by an outsider to burn LDBWS rate-limit budget or spam the database once
// this backend has a public URL. The pg_cron job sends this same value.
export const ingestConfig = {
  get secret(): string {
    return requireEnv('INGEST_SECRET');
  },
};

// Two independent toggles (not one combined switch) so LDBWS and Supabase
// can each be tried against the mock/in-memory side while the other is
// still being verified. Both default to the safe, no-external-calls option.
export const dataSourceMode: 'mock' | 'ldbws' = process.env.DATA_SOURCE?.trim() === 'ldbws' ? 'ldbws' : 'mock';
export const repositoryMode: 'memory' | 'supabase' = process.env.REPOSITORY?.trim() === 'supabase' ? 'supabase' : 'memory';
