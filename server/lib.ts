import { ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

export type JobState = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type JobType = 'analyze_audio' | 'master_audio' | 'separate_stems' | 'resample_audio' | 'convert_audio' | 'generate_voiceover';

export interface AudioMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  format: string;
  size: number;
}

export interface AudioJob {
  id: string;
  type: JobType;
  state: JobState;
  createdAt: string;
  updatedAt: string;
  message: string;
  progress?: number;
  error?: string;
  input?: string;
  outputs: string[];
  metadata?: AudioMetadata;
}

export const DATA_ROOT = path.resolve(process.env.SONIMIX_DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_ROOT, 'uploads');
export const OUTPUT_DIR = path.join(DATA_ROOT, 'outputs');

export async function ensureDirectories() {
  await Promise.all([mkdir(UPLOAD_DIR, { recursive: true }), mkdir(OUTPUT_DIR, { recursive: true })]);
}

export function safeBaseName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+/, '').slice(0, 120) || 'audio';
}

export function resolveDataFile(file: string) {
  const resolved = path.resolve(DATA_ROOT, file);
  if (!resolved.startsWith(`${DATA_ROOT}${path.sep}`)) throw new Error('Invalid file reference');
  return resolved;
}

export async function inspectAudio(file: string): Promise<AudioMetadata> {
  const fullPath = resolveDataFile(file);
  const output = await runCommand(process.env.FFPROBE_BIN || 'ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration,format_name:stream=codec_type,sample_rate,channels',
    '-of', 'json', fullPath,
  ]);
  const parsed = JSON.parse(output) as { format?: { duration?: string; format_name?: string }; streams?: Array<{ codec_type?: string; sample_rate?: string; channels?: number }> };
  const stream = parsed.streams?.find((item) => item.codec_type === 'audio');
  const fileStat = await stat(fullPath);
  const duration = Number(parsed.format?.duration);
  const sampleRate = Number(stream?.sample_rate);
  if (!stream || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(sampleRate) || !stream.channels) {
    throw new Error('Output is not a valid playable audio file');
  }
  return { duration, sampleRate, channels: stream.channels, format: parsed.format?.format_name || 'unknown', size: fileStat.size };
}

export function runCommand(command: string, args: string[], onProcess?: (child: ChildProcess) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    onProcess?.(child);
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once('error', (error) => reject(new Error(`${command} is unavailable: ${error.message}`)));
    child.once('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} failed (${code}): ${stderr.slice(-1200)}`));
    });
  });
}

export class JobQueue {
  private readonly jobs = new Map<string, AudioJob>();
  private readonly active = new Map<string, ChildProcess>();

  get(id: string) { return this.jobs.get(id); }
  list() { return [...this.jobs.values()]; }

  submit(type: JobType, input: string | undefined, execute: (job: AudioJob, attach: (child: ChildProcess) => void) => Promise<Pick<AudioJob, 'outputs' | 'metadata' | 'message'>>) {
    const now = new Date().toISOString();
    const job: AudioJob = { id: randomUUID(), type, state: 'queued', createdAt: now, updatedAt: now, message: 'Queued', input, outputs: [] };
    this.jobs.set(job.id, job);
    void this.run(job, execute);
    return job;
  }

  cancel(id: string) {
    const job = this.jobs.get(id);
    if (!job || job.state === 'completed' || job.state === 'failed') return false;
    this.active.get(id)?.kill('SIGTERM');
    job.state = 'cancelled'; job.message = 'Cancelled'; job.updatedAt = new Date().toISOString();
    return true;
  }

  private async run(job: AudioJob, execute: (job: AudioJob, attach: (child: ChildProcess) => void) => Promise<Pick<AudioJob, 'outputs' | 'metadata' | 'message'>>) {
    job.state = 'processing'; job.message = 'Processing'; job.updatedAt = new Date().toISOString();
    try {
      const result = await execute(job, (child) => this.active.set(job.id, child));
      if (job.state === 'cancelled') return;
      Object.assign(job, result, { state: 'completed', progress: 100, updatedAt: new Date().toISOString() });
    } catch (error) {
      if (job.state !== 'cancelled') {
        job.state = 'failed'; job.error = error instanceof Error ? error.message : 'Job failed'; job.message = 'Processing failed'; job.updatedAt = new Date().toISOString();
      }
    } finally { this.active.delete(job.id); }
  }
}
