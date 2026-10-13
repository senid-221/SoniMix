import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AudioJob, inspectAudio, OUTPUT_DIR } from './lib.js';

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
