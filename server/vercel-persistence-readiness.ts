/**
 * Call this before accepting production traffic on Vercel.
 *
 * This is a fail-closed guard only; it does not pretend the legacy SQLite
 * adapter is serverless-safe. It will be wired into the Vercel entrypoint
 * after the production adapters are configured.
 */
export function assertDurableRuntimeConfigured(env: Record<string, string | undefined> = process.env) {
  if (!env.VERCEL) return;
  const required = [
    'DATABASE_URL',
    'BLOB_READ_WRITE_TOKEN',
    'AUDIO_WORKER_URL',
    'AUDIO_WORKER_TOKEN',
  ];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) {
    throw new Error(
      'SoniMix cannot run safely on Vercel yet. Configure persistent PostgreSQL, private Blob storage, ' +
      'and an audio worker. Missing: ' + missing.join(', ')
    );
  }
}
