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

export async function master(job: AudioJob, settings: { profile?: string; targetLufs?: number; format?: 'wav' | 'mp3'; bitDepth?: 16 | 24; dsp?: Record<string, unknown> }, attach: (child: import('node:child_process').ChildProcess) => void) {
  await ensureDirectories();
  const input = requireInput(job);
  const target = Math.max(-24, Math.min(-8, Number(settings.targetLufs ?? -14)));
  const profile = settings.profile || 'balanced';
  const tone = profile === 'bright' ? 'equalizer=f=8500:t=h:width=3000:g=1.5' : profile === 'warm' ? 'equalizer=f=280:t=q:w=1:g=1.2' : 'anull';
  const extension = settings.format === 'mp3' ? 'mp3' : 'wav';
  const output = outputRef(job, extension);
  const outputPath = resolveDataFile(output);
  const bitDepth = settings.bitDepth === 16 ? 16 : 24;
  const codec = extension === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', '320k'] : ['-c:a', bitDepth === 16 ? 'pcm_s16le' : 'pcm_s24le'];
  const dsp = settings.dsp || {};
  const setting = (key: string, fallback: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, Number.isFinite(Number(dsp[key])) ? Number(dsp[key]) : fallback));
  const gain = setting('inputGain', 0, -12, 12);
  const bass = setting('eqBass', 0, -6, 6);
  const lowMid = setting('eqLowMid', 0, -6, 6);
  const presence = setting('eqPresence', 0, -6, 6);
  const air = setting('eqAir', 0, -6, 6);
  const drive = setting('compressionDrive', 0.25, 0, 1);
  const ceiling = setting('ceiling', -1, -3, -0.1);
  const filters = [`volume=${gain}dB`, `equalizer=f=80:t=h:width=200:g=${bass}`, `equalizer=f=320:t=q:width=1.2:g=${lowMid}`, `equalizer=f=3500:t=q:width=1.2:g=${presence}`, `equalizer=f=12000:t=h:width=6000:g=${air}`, `acompressor=threshold=${-20 - drive * 8}dB:ratio=${2 + drive * 4}:attack=20:release=150`, tone, `loudnorm=I=${target}:TP=${ceiling}:LRA=11`];
  const filter = filters.join(',');
  await runCommand(ffmpeg(), ['-y', '-i', input, '-af', filter, ...codec, outputPath], attach);
  return { outputs: [output], metadata: await inspectAudio(output), message: `Mastered ${profile} render verified` };
}

export async function resample(job: AudioJob, settings: { sampleRate: number; format?: 'wav' | 'mp3'; bitDepth?: 16 | 24; speed?: number; pitchSemitones?: number; normalize?: boolean }, attach: (child: import('node:child_process').ChildProcess) => void) {
  await ensureDirectories();
  const input = requireInput(job);
  const sampleRate = Number(settings.sampleRate);
  if (![22050, 32000, 44100, 48000, 88200, 96000].includes(sampleRate)) throw new Error('Unsupported output sample rate');
  const speed = Number(settings.speed ?? 1);
  const pitchSemitones = Number(settings.pitchSemitones ?? 0);
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 4 || !Number.isFinite(pitchSemitones) || pitchSemitones < -24 || pitchSemitones > 24) throw new Error('Speed or pitch is outside the supported range');
  const source = await inspectAudio(job.input!);
  const effectiveRate = speed * Math.pow(2, pitchSemitones / 12);
  const shiftedRate = Math.round(source.sampleRate * effectiveRate);
  const extension = settings.format === 'mp3' ? 'mp3' : 'wav';
  const output = outputRef(job, extension);
  const bitDepth = settings.bitDepth === 16 ? 16 : 24;
  const codec = extension === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', '320k'] : ['-c:a', bitDepth === 16 ? 'pcm_s16le' : 'pcm_s24le'];
  const filters = [`asetrate=${shiftedRate}`, `aresample=${sampleRate}:resampler=soxr`];
  if (settings.normalize) filters.push('volume=1.05');
  await runCommand(ffmpeg(), ['-y', '-i', input, '-af', filters.join(','), '-ar', String(sampleRate), ...codec, resolveDataFile(output)], attach);
  const metadata = await inspectAudio(output);
  if (metadata.sampleRate !== sampleRate) throw new Error(`Rendered sample rate is ${metadata.sampleRate}, expected ${sampleRate}`);
  return { outputs: [output], metadata, message: `Rendered at ${sampleRate} Hz, speed ${speed}×, pitch ${pitchSemitones} semitones and verified` };
}

export async function separate(job: AudioJob, attach: (child: import('node:child_process').ChildProcess) => void) {
  await ensureDirectories();
  const input = requireInput(job);
  const model = process.env.DEMUCS_MODEL || 'htdemucs';
  const demucs = process.env.DEMUCS_BIN || 'demucs';
  // Demucs is a Python tool and must be installed in the Render runtime.
  // Fail with a clear setup message instead of an opaque spawn ENOENT.
  try {
    await runCommand(demucs, ['--version']);
  } catch {
    throw new Error('Stem separation is unavailable: Demucs is not installed on this server. Install Demucs in the Render build environment and set DEMUCS_BIN to its executable path.');
  }
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
