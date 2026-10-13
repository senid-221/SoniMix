import { describe, expect, it } from 'vitest';
import { assertVercelStorageReady, getStorageReadiness } from '../server/storage-migration-status.js';

describe('Vercel storage readiness', () => {
  it('reports missing persistent service configuration without exposing values', () => {
    expect(getStorageReadiness({ VERCEL: '1' })).toEqual({
      postgres: false,
      blob: false,
      audioWorker: false,
      missing: ['DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'AUDIO_WORKER_URL', 'AUDIO_WORKER_TOKEN'],
    });
  });

  it('reports services configured when values are present', () => {
    expect(getStorageReadiness({
      DATABASE_URL: 'postgres://test',
      BLOB_READ_WRITE_TOKEN: 'test-token',
      AUDIO_WORKER_URL: 'https://worker.example.test',
      AUDIO_WORKER_TOKEN: 'test-worker-token',
    })).toEqual({ postgres: true, blob: true, audioWorker: true, missing: [] });
  });

  it('does not fail local development when Vercel is absent', () => {
    expect(() => assertVercelStorageReady({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('fails safely on Vercel if storage is not configured', () => {
    expect(() => assertVercelStorageReady({ VERCEL: '1' })).toThrow(/DATABASE_URL/);
  });
});
