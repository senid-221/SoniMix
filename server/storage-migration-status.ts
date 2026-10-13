/**
 * Configuration checks shared by health endpoints and server startup.
 * These checks do not print or return secrets.
 */
export interface StorageReadiness {
  postgres: boolean;
  blob: boolean;
  audioWorker: boolean;
  missing: string[];
}

export function getStorageReadiness(env: Record<string, string | undefined> = process.env): StorageReadiness {
  const missing: string[] = [];
  const postgres = Boolean(env.DATABASE_URL?.trim());
  const blob = Boolean(env.BLOB_READ_WRITE_TOKEN?.trim());
  const audioWorker = Boolean(env.AUDIO_WORKER_URL?.trim() && env.AUDIO_WORKER_TOKEN?.trim());
  if (!postgres) missing.push('DATABASE_URL');
  if (!blob) missing.push('BLOB_READ_WRITE_TOKEN');
  if (!audioWorker) {
    missing.push('AUDIO_WORKER_URL');
    missing.push('AUDIO_WORKER_TOKEN');
  }
  return { postgres, blob, audioWorker, missing };
}

/** Fail fast instead of silently running with volatile local files on Vercel. */
export function assertVercelStorageReady(env: Record<string, string | undefined> = process.env): void {
  if (!env.VERCEL) return;
  const readiness = getStorageReadiness(env);
  if (readiness.missing.length) {
    throw new Error(
      'SoniMix Vercel storage is not configured. Missing server-side environment variables: ' +
      readiness.missing.join(', ') +
      '. Configure PostgreSQL, Blob storage, and an audio worker before routing production traffic.'
    );
  }
}
