export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, credentials: 'include' });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error || payload.message || `Request failed (${response.status})`, response.status);
  return payload as T;
}

export async function uploadAsset(blob: Blob, filename: string) {
  return apiRequest<{ file: string }>('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': filename },
    body: blob,
  });
}

export async function saveExport(blob: Blob, title: string, format: string) {
  const filename = title.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'sonimix-export';
  const { file } = await uploadAsset(blob, filename);
  const result = await apiRequest<{ id: string }>('/api/exports', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, title, format, fileSize: blob.size }),
  });
  return { id: result.id, file, downloadUrl: `/api/files/${file}` };
}

export async function submitJob<T = Record<string, unknown>>(type: string, input: string | undefined, settings: Record<string, unknown> = {}) {
  return apiRequest<T>('/api/jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, input, settings }),
  });
}

export async function waitForJob<T extends { id: string; state: string; error?: string; message?: string }>(id: string, intervalMs = 1200) {
  for (;;) {
    const job = await apiRequest<T>(`/api/jobs/${encodeURIComponent(id)}`);
    if (job.state === 'completed') return job;
    if (job.state === 'failed' || job.state === 'cancelled') throw new Error(job.error || job.message || `Job ${job.state}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
