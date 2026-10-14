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

async function measureLoudness(file: string) {
  const reportText = await runCommand(ffmpeg(), [
    '-hide_banner', '-nostats', '-i', resolveDataFile(file),
    '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
    '-f', 'null', '-',
  ], undefined, true);
  const blocks = [...reportText.matchAll(/\{[\s\S]*?\}/g)];
  const block = blocks[blocks.length - 1]?.[0];
  if (!block) throw new Error('FFmpeg completed but did not return a loudness measurement report.');
  const report = JSON.parse(block) as Record<string, string>;
  const parse = (key: string) => {
    const value = Number(report[key]);
    return Number.isFinite(value) ? Number(value.toFixed(2)) : undefined;
  };
  const integratedLufs = parse('input_i');
  const truePeakDbtp = parse('input_tp');
  const loudnessRangeLu = parse('input_lra');
  if (integratedLufs === undefined || truePeakDbtp === undefined) {
    throw new Error('The server could not measure integrated loudness and true peak for this audio.');
  }
  return { integratedLufs, truePeakDbtp, loudnessRangeLu, loudnessMeasuredAt: new Date().toISOString() };
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
  const width = setting('stereoWidth', 1, 0.5, 2);
  const warmTape = setting('warmTape', 0, 0, 1);
  const masteringMode = dsp.masteringMode === 'clip' ? 'clip' : 'limit';
  const sourceMetadata = await inspectAudio(job.input!);
  const pluginBypass = dsp.pluginBypass === true;
  const filters = pluginBypass ? ['anull'] : [
    `volume=${gain}dB`,
    `equalizer=f=80:t=h:width=200:g=${bass}`,
    `equalizer=f=320:t=q:width=1.2:g=${lowMid}`,
    `equalizer=f=3500:t=q:width=1.2:g=${presence}`,
    `equalizer=f=12000:t=h:width=6000:g=${air}`,
    `acompressor=threshold=${-20 - drive * 8}dB:ratio=${2 + drive * 4}:attack=20:release=150`,
  ];
  // Apply actual stereo-width DSP only to stereo sources; mono sources remain mono.
  if (!pluginBypass && sourceMetadata.channels >= 2 && Math.abs(width - 1) > 0.001) filters.push(`extrastereo=m=${width}:c=0`);
  // A soft-clip saturation stage gives the tape control an audible, bounded effect.
  if (!pluginBypass && warmTape > 0.001) filters.push(`asoftclip=type=tanh:threshold=${Math.max(0.55, 1 - warmTape * 0.4)}:output=1`);
  if (!pluginBypass && masteringMode === 'clip') filters.push('asoftclip=type=atan:threshold=0.92:output=1:oversample=4');
  // Apply the tone profile before final peak control so later EQ cannot undo the limiter.
  if (!pluginBypass && tone !== 'anull') filters.push(tone);
  // Keep output safety and EBU R128 loudness normalization active even when tone/dynamics DSP is bypassed.
  const limiterThreshold = Math.pow(10, ceiling / 20);
  filters.push(`alimiter=limit=${limiterThreshold.toFixed(6)}:attack=5:release=50:level=false:latency=true`);
  filters.push(`loudnorm=I=${target}:TP=${ceiling}:LRA=11`);
  const filter = filters.join(',');
  await runCommand(ffmpeg(), ['-y', '-i', input, '-af', filter, ...codec, outputPath], attach);
  const metadata = await inspectAudio(output);
  const loudness = await measureLoudness(output);
  return {
    outputs: [output],
    metadata: { ...metadata, ...loudness },
    message: `Mastered ${profile} render verified; server measured loudness and true peak after export.`,
  };
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
