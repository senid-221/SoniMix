import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AudioJob, inspectAudio, OUTPUT_DIR, resolveDataFile } from './lib.js';

async function providerFetch(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Provider returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response;
}

export async function elevenLabsVoiceover(job: AudioJob, request: { text: string; voiceId: string; modelId?: string; outputFormat?: string }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured');
  if (!request.text?.trim() || request.text.length > 5000 || !request.voiceId) throw new Error('Valid text and voiceId are required');
  const outputFormat = request.outputFormat || 'mp3_44100_128';
  const response = await providerFetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(request.voiceId)}?output_format=${encodeURIComponent(outputFormat)}`, {
    method: 'POST', headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ text: request.text, model_id: request.modelId || 'eleven_multilingual_v2' }),
  });
  const dir = path.join(OUTPUT_DIR, job.id); await mkdir(dir, { recursive: true });
  const output = path.join('outputs', job.id, 'voiceover.mp3').replace(/\\/g, '/');
  await writeFile(path.resolve(process.env.SONIMIX_DATA_DIR || 'data', output), Buffer.from(await response.arrayBuffer()));
  return { outputs: [output], metadata: await inspectAudio(output), message: 'ElevenLabs voiceover retrieved and verified' };
}

export async function listElevenLabsVoices() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured');
  const response = await providerFetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': apiKey } });
  return response.json();
}

export function loudlyStatus() {
  return { available: false, reason: 'Loudly adapter is disabled until an account-specific official API base URL and contract are configured. No endpoint is assumed.' };
}

export function musicGptStatus() {
  return { provider: 'MusicGPT', available: Boolean(process.env.MUSICGPT_API_KEY), reason: process.env.MUSICGPT_API_KEY ? undefined : 'Add MUSICGPT_API_KEY to the server environment.' };
}

export async function generateMusic(job: AudioJob, request: { prompt: string; title?: string; musicStyle?: string; lyrics?: string; model?: string; makeInstrumental?: boolean; vocalOnly?: boolean; gender?: string }) {
  const apiKey = process.env.MUSICGPT_API_KEY;
  if (!apiKey) throw new Error('MUSICGPT_API_KEY is not configured');
  if (!request.prompt?.trim() || request.prompt.length > 2000) throw new Error('Prompt must contain 1–2,000 characters');
  if (request.title && request.title.length > 120) throw new Error('Title must be 120 characters or fewer');
  if (request.musicStyle && request.musicStyle.length > 500) throw new Error('Music style must be 500 characters or fewer');
  if (request.lyrics && request.lyrics.length > 5000) throw new Error('Lyrics must be 5,000 characters or fewer');
  const models = ['v6', 'v6-pro', 'v7', 'v7-pro'];
  const model = request.model && models.includes(request.model) ? request.model : 'v7';
  const gender = ['male', 'female', 'neutral'].includes(request.gender || '') ? request.gender : 'neutral';
  const submit = await providerFetch('https://api.musicgpt.com/api/public/v2/MusicAI', {
    method: 'POST', headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: request.prompt.trim(), title: request.title?.trim() || undefined, music_style: request.musicStyle?.trim() || undefined,
      lyrics: request.lyrics?.trim() || undefined, model, gender, make_instrumental: request.makeInstrumental === true,
      vocal_only: request.vocalOnly === true, generate_album_cover: false, lyrics_timestamps: false,
    }),
  });
  const submitted = await submit.json() as { success?: boolean; task_id?: string; message?: string };
  if (!submitted.success || !submitted.task_id) throw new Error(submitted.message || 'MusicGPT did not return a generation task');

  const deadline = Date.now() + 15 * 60 * 1000;
  let completed: { success?: boolean; conversion?: { status?: string; conversion_path_1?: string; conversion_path_2?: string; title?: string } } | undefined;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 7000));
    const query = new URLSearchParams({ conversionType: 'MUSIC_AI', task_id: submitted.task_id });
    const statusResponse = await providerFetch(`https://api.musicgpt.com/api/public/v1/byId?${query}`, { headers: { authorization: apiKey } });
    const status = await statusResponse.json() as typeof completed;
    if (!status?.success) throw new Error('MusicGPT could not retrieve the generation task');
    const state = status.conversion?.status?.toUpperCase();
    if (state === 'COMPLETED') { completed = status; break; }
    if (state === 'FAILED' || state === 'ERROR' || state === 'CANCELLED') throw new Error(`MusicGPT generation ${state.toLowerCase()}`);
  }
  if (!completed) throw new Error('MusicGPT generation timed out before returning audio');

  const urls = [completed.conversion?.conversion_path_1, completed.conversion?.conversion_path_2].filter((url): url is string => typeof url === 'string');
  if (!urls.length) throw new Error('MusicGPT reported completion without audio files');
  const directory = path.join(OUTPUT_DIR, job.id);
  await mkdir(directory, { recursive: true });
  const outputs: string[] = [];
  let metadata;
  for (const [index, url] of urls.entries()) {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'cdn1.musicgpt.com') throw new Error('MusicGPT returned an untrusted audio download host');
    const audioResponse = await fetch(parsedUrl, { signal: AbortSignal.timeout(60_000), redirect: 'error' });
    if (!audioResponse.ok) throw new Error(`MusicGPT audio download failed (${audioResponse.status})`);
    const audio = Buffer.from(await audioResponse.arrayBuffer());
    if (!audio.length || audio.length > 250 * 1024 * 1024) throw new Error('MusicGPT audio file is empty or exceeds the 250 MB limit');
    const file = `outputs/${job.id}/version-${index + 1}.mp3`;
    await writeFile(resolveDataFile(file), audio);
    metadata = await inspectAudio(file);
    outputs.push(file);
  }
  return { outputs, metadata, message: 'MusicGPT audio downloaded and verified' };
}
