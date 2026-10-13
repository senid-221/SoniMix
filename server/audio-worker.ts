import path from 'node:path';
import { AudioJob, ensureDirectories, inspectAudio, OUTPUT_DIR, resolveDataFile, runCommand, safeBaseName } from './lib.js';

const ffmpeg = () => process.env.FFMPEG_BIN || 'ffmpeg';

function requireInput(job: AudioJob) {
  if (!job.input) throw new Error('An input audio file is required');
  return resolveDataFile(job.input);
}

function outputRef(job: AudioJob, extension: string) {
  return path.join('outputs', `${job.id}.${extension}`).replace(/\\/g, '/');
}

export async function analyze(job: AudioJob) {
  if (!job.input) throw new Error('An input audio file is required');
  return { outputs: [], metadata: await inspectAudio(job.input), message: 'Audio analysis verified' };
}

export async function master(job: AudioJob, settings: { profile?: string; targetLufs?: number; format?: 'wav' | 'mp3' }, attach: (child: import('node:child_process').ChildProcess) => void) {
  await ensureDirectories();
  const input = requireInput(job);
  const target = Math.max(-24, Math.min(-8, Number(settings.targetLufs ?? -14)));
  const profile = settings.profile || 'balanced';
  const tone = profile === 'bright' ? 'equalizer=f=8500:t=h:width=3000:g=1.5' : profile === 'warm' ? 'equalizer=f=280:t=q:w=1:g=1.2' : 'anull';
  const extension = settings.format === 'mp3' ? 'mp3' : 'wav';
  const output = outputRef(job, extension);
  const outputPath = resolveDataFile(output);
  const codec = extension === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', '320k'] : ['-c:a', 'pcm_s24le'];
  const filter = `${tone},loudnorm=I=${target}:TP=-1.0:LRA=11`;
  await runCommand(ffmpeg(), ['-y', '-i', input, '-af', filter, ...codec, outputPath], attach);
  return { outputs: [output], metadata: await inspectAudio(output), message: `Mastered ${profile} render verified` };
}

export async function resample(job: AudioJob, settings: { sampleRate: number; format?: 'wav' | 'mp3' }, attach: (child: import('node:child_process').ChildProcess) => void) {
  await ensureDirectories();
  const input = requireInput(job);
  const sampleRate = Number(settings.sampleRate);
  if (![22050, 32000, 44100, 48000, 88200, 96000].includes(sampleRate)) throw new Error('Unsupported output sample rate');
  const extension = settings.format === 'mp3' ? 'mp3' : 'wav';
  const output = outputRef(job, extension);
  const codec = extension === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', '320k'] : ['-c:a', 'pcm_s24le'];
  await runCommand(ffmpeg(), ['-y', '-i', input, '-af', `aresample=${sampleRate}:resampler=soxr`, '-ar', String(sampleRate), ...codec, resolveDataFile(output)], attach);
  const metadata = await inspectAudio(output);
  if (metadata.sampleRate !== sampleRate) throw new Error(`Rendered sample rate is ${metadata.sampleRate}, expected ${sampleRate}`);
  return { outputs: [output], metadata, message: `Resampled to ${sampleRate} Hz and verified` };
}

export async function separate(job: AudioJob, attach: (child: import('node:child_process').ChildProcess) => void) {
  await ensureDirectories();
  const input = requireInput(job);
  const model = process.env.DEMUCS_MODEL || 'htdemucs';
  const demucs = process.env.DEMUCS_BIN || 'demucs';
  const workingDirectory = path.join(OUTPUT_DIR, job.id);
  await runCommand(demucs, ['-n', model, '-o', OUTPUT_DIR, input], attach);
  const base = safeBaseName(path.parse(input).name);
  const stemDirectory = path.join(workingDirectory, model, base);
  const names = ['vocals', 'drums', 'bass', 'other'];
  const outputs: string[] = [];
  for (const name of names) {
    const absolute = path.join(stemDirectory, `${name}.wav`);
    const relative = path.relative(path.dirname(OUTPUT_DIR), absolute).replace(/\\/g, '/');
    const metadata = await inspectAudio(relative);
    if (Math.abs(metadata.duration - (await inspectAudio(job.input!)).duration) > 0.1) throw new Error(`${name} stem is not aligned with source`);
    outputs.push(relative);
  }
  return { outputs, metadata: await inspectAudio(outputs[0]), message: 'Demucs stems verified and aligned' };
}
