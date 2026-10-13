/**
 * Durable resource contracts for serverless-facing SoniMix code.
 *
 * These interfaces intentionally do not implement a local-disk fallback. In
 * serverless production, silently falling back to /tmp or a process-local Map
 * would create intermittent data loss across invocations.
 */
export interface StoredObject {
  pathname: string;
  url: string;
  size: number;
  contentType?: string;
}

export interface DurableObjectStore {
  /**
   * Returns an opaque stable object pathname, never a local filesystem path.
   * Implementations must require explicit user ownership metadata.
   */
  put(input: {
    userId: string;
    pathname: string;
    body: ReadableStream<Uint8Array> | Blob | ArrayBuffer | Uint8Array;
    contentType: string;
    size: number;
  }): Promise<StoredObject>;

  /** Returns a short-lived URL only after an ownership check succeeds. */
  signedDownload(input: {
    userId: string;
    pathname: string;
    expiresInSeconds: number;
  }): Promise<string>;

  /** Worker-only: transfer a stored object into the worker's ephemeral workspace. */
  downloadToWorker?(pathname: string): Promise<{ localPath: string; cleanup: () => Promise<void> }>;

  /** Worker-only: upload a verified local output and return its durable reference. */
  uploadFromWorker?(input: {
    userId: string;
    pathname: string;
    localPath: string;
    contentType: string;
  }): Promise<StoredObject>;
}

export type DurableJobState = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface DurableJobRecord {
  id: string;
  userId: string;
  type: string;
  state: DurableJobState;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
  error?: string;
}

export interface DurableJobQueue {
  enqueue(input: {
    id: string;
    userId: string;
    type: string;
    payload: Record<string, unknown>;
  }): Promise<DurableJobRecord>;
  get(id: string, userId: string, isAdmin?: boolean): Promise<DurableJobRecord | null>;
  list(userId: string, limit?: number): Promise<DurableJobRecord[]>;
  cancel(id: string, userId: string, isAdmin?: boolean): Promise<boolean>;
}
