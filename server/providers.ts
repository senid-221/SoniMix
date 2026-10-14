import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AudioJob, inspectAudio, OUTPUT_DIR, resolveDataFile } from './lib.js';

async function providerFetch(url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      const host = new URL(url).hostname;
      throw new Error(`Music provider ${host} did not respond within 120 seconds. The request may still be processing; wait a moment and retry. If this repeats, check the provider API status and Render logs.`);
    }
    throw error;
  }
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    if (response.status === 403 && /"code"\s*:\s*"used_up"|balance is not sufficient|buy more in Ace Data Cloud/i.test(body)) {
      throw new Error('Your Ace Data Cloud balance is insufficient for Suno music generation. Add credits at https://platform.acedata.cloud, then try again. This is a billing/balance issue, not a model-selection issue.');
    }
    if (response.status === 403 && /plan does not include access|FORBIDDEN/i.test(body)) {
      throw new Error('Ace Data Cloud denied this Suno model because your current plan does not include access. In Music Generator, select another model your plan supports; if all models are blocked, check your Ace Data Cloud plan or contact its support. Retrying the same model will not fix plan access.');
    }
    throw new Error(`Provider returned ${response.status}: ${body}`);
  }
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
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured');

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });

  if (response.ok) return response.json();

  const body = await response.text();
  // Listing voices requires the voices_read permission. Keep TTS usable with a
  // documented quickstart voice ID when the key can synthesize speech but
  // cannot list voices. The actual TTS endpoint still validates the key and ID.
  if (response.status === 401 && body.includes('voices_read')) {
    return {
      voices: [{ voice_id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (quickstart voice)' }],
      warning: 'Your API key cannot list voices (missing voices_read). SoniMix is using the documented quickstart voice ID. If generation also fails, update the key permissions to include text_to_speech.',
    };
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`ElevenLabs rejected this API key (${response.status}). Check that the key is current and has voices_read permission. Details: ${body.slice(0, 300)}`);
  }
  throw new Error(`ElevenLabs voice listing failed (${response.status}): ${body.slice(0, 300)}`);
}

export function loudlyStatus() {
  return { available: false, reason: 'Loudly adapter is disabled until an account-specific official API base URL and contract are configured. No endpoint is assumed.' };
}

export function musicGptStatus() {
  return { provider: 'MusicGPT', available: Boolean(process.env.MUSICGPT_API_KEY), reason: process.env.MUSICGPT_API_KEY ? undefined : 'Add MUSICGPT_API_KEY to the server environment.' };
}

export function aceDataSunoStatus() {
  return { provider: 'Suno via Ace Data Cloud', available: Boolean(process.env.ACEDATA_API_KEY), reason: process.env.ACEDATA_API_KEY ? undefined : 'Add ACEDATA_API_KEY to the server environment.' };
}

interface SunoSong { audio_url?: string; state?: string; title?: string; id?: string }

function findSunoSongs(value: unknown, songs: SunoSong[] = [], depth = 0): SunoSong[] {
  if (depth > 8 || !value || typeof value !== 'object') return songs;
  if (Array.isArray(value)) {
    for (const item of value) findSunoSongs(item, songs, depth + 1);
    return songs;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.audio_url === 'string') songs.push({ audio_url: record.audio_url, state: typeof record.state === 'string' ? record.state : undefined, title: typeof record.title === 'string' ? record.title : undefined, id: typeof record.id === 'string' ? record.id : undefined });
  for (const item of Object.values(record)) findSunoSongs(item, songs, depth + 1);
  return songs;
}

export async function generateAceSunoMusic(job: AudioJob, request: { prompt: string; title?: string; musicStyle?: string; lyrics?: string; model?: string; instrumental?: boolean }) {
  const apiKey = process.env.ACEDATA_API_KEY;
  if (!apiKey) throw new Error('ACEDATA_API_KEY is not configured');
  if (!request.prompt?.trim() || request.prompt.length > 2000) throw new Error('Prompt must contain 1–2,000 characters');
  if (request.title && request.title.length > 120) throw new Error('Title must be 120 characters or fewer');
  if (request.musicStyle && request.musicStyle.length > 500) throw new Error('Music style must be 500 characters or fewer');
  if (request.lyrics && request.lyrics.length > 5000) throw new Error('Lyrics must be 5,000 characters or fewer');
  const supportedModels = ['chirp-v4', 'chirp-v4-5', 'chirp-v5', 'chirp-v6'];
  const model = request.model && supportedModels.includes(request.model) ? request.model : 'chirp-v6';
  const response = await providerFetch('https://api.acedata.cloud/suno/audios', {
    method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ action: 'generate', prompt: request.prompt.trim(), model, custom: Boolean(request.lyrics?.trim()), instrumental: request.instrumental === true, ...(request.lyrics?.trim() ? { lyric: request.lyrics.trim() } : {}), ...(request.musicStyle?.trim() ? { style: request.musicStyle.trim() } : {}), ...(request.title?.trim() ? { title: request.title.trim() } : {}) }),
  });
  const submitted = await response.json() as { success?: boolean; task_id?: string; data?: unknown; message?: string; error?: string };
  if (!submitted.success || !submitted.task_id) throw new Error(submitted.message || submitted.error || 'AceData did not return a Suno task ID');

  const deadline = Date.now() + 15 * 60 * 1000;
  let songs = findSunoSongs(submitted.data).filter((song) => song.audio_url && (!song.state || ['succeeded', 'success', 'complete', 'completed'].includes(song.state.toLowerCase())));
  while (!songs.length && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 7000));
    const taskResponse = await providerFetch('https://api.acedata.cloud/suno/tasks', {
      method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ id: submitted.task_id, action: 'retrieve' }),
    });
    const task = await taskResponse.json() as Record<string, unknown>;
    songs = findSunoSongs(task).filter((song) => song.audio_url && (!song.state || ['succeeded', 'success', 'complete', 'completed'].includes(song.state.toLowerCase())));
    const failed = findSunoSongs(task).some((song) => ['failed', 'error', 'cancelled'].includes(song.state?.toLowerCase() || ''));
    if (failed) throw new Error('Suno generation failed in Ace Data Cloud');
    const errorText = typeof task.error === 'string' ? task.error : typeof task.message === 'string' && task.success === false ? task.message : undefined;
    if (errorText) throw new Error(`AceData task retrieval failed: ${errorText.slice(0, 300)}`);
  }
  if (!songs.length) throw new Error('Suno generation timed out before returning completed audio');

  const directory = path.join(OUTPUT_DIR, job.id);
  await mkdir(directory, { recursive: true });
  const outputs: string[] = [];
  let metadata;
  for (const [index, song] of songs.entries()) {
    const url = new URL(song.audio_url!);
    if (url.protocol !== 'https:' || !['cdn1.suno.ai', 'cdn.acedata.cloud', 'platform.cdn.acedata.cloud', 'storage.googleapis.com'].includes(url.hostname)) throw new Error('AceData returned an untrusted Suno audio host');
    const audioResponse = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: 'error' });
    if (!audioResponse.ok) throw new Error(`Suno audio download failed (${audioResponse.status})`);
    const audio = Buffer.from(await audioResponse.arrayBuffer());
    if (!audio.length || audio.length > 250 * 1024 * 1024) throw new Error('Suno audio file is empty or exceeds the 250 MB limit');
    const file = `outputs/${job.id}/suno-${index + 1}.mp3`;
    await writeFile(resolveDataFile(file), audio);
    metadata = await inspectAudio(file);
    outputs.push(file);
  }
  return { outputs, metadata, message: `Suno via Ace Data Cloud returned ${outputs.length} downloaded and verified track${outputs.length === 1 ? '' : 's'}` };
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
