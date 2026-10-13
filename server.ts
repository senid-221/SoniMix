import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { analyze, master, resample, separate } from './server/audio-worker.js';
import { AudioJob, ensureDirectories, JobQueue, JobType, resolveDataFile, safeBaseName } from './server/lib.js';
import { elevenLabsVoiceover, listElevenLabsVoices, loudlyStatus } from './server/providers.js';

dotenv.config();
const app = express();
const queue = new JobQueue();
const PORT = Number(process.env.PORT || 3000);
const apiToken = process.env.SONIMIX_API_TOKEN;

app.use(express.raw({ type: 'application/octet-stream', limit: '250mb' }));
app.use(express.json({ limit: '1mb' }));

function requireApiToken(request: Request, response: Response, next: NextFunction) {
  if (!apiToken) return response.status(503).json({ error: 'SONIMIX_API_TOKEN is required before enabling the production API.' });
  if (request.header('authorization') !== `Bearer ${apiToken}`) return response.status(401).json({ error: 'Unauthorized' });
  next();
}

function stringValue(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  return value;
}
function isJobType(value: unknown): value is JobType {
  return ['analyze_audio', 'master_audio', 'separate_stems', 'resample_audio', 'convert_audio', 'generate_voiceover'].includes(String(value));
}
function requireInputReference(value: unknown) {
  const input = stringValue(value, 'input'); resolveDataFile(input); return input;
}
function submitJob(type: JobType, input: string | undefined, settings: Record<string, unknown>) {
  switch (type) {
    case 'analyze_audio': return queue.submit(type, input, (job) => analyze(job));
    case 'master_audio': return queue.submit(type, input, (job, attach) => master(job, { profile: typeof settings.profile === 'string' ? settings.profile : undefined, targetLufs: typeof settings.targetLufs === 'number' ? settings.targetLufs : undefined, format: settings.format === 'mp3' ? 'mp3' : 'wav' }, attach));
    case 'resample_audio': case 'convert_audio': return queue.submit(type, input, (job, attach) => resample(job, { sampleRate: Number(settings.sampleRate), format: settings.format === 'mp3' ? 'mp3' : 'wav' }, attach));
    case 'separate_stems': return queue.submit(type, input, (job, attach) => separate(job, attach));
    case 'generate_voiceover': return queue.submit(type, undefined, (job) => elevenLabsVoiceover(job, { text: stringValue(settings.text, 'text'), voiceId: stringValue(settings.voiceId, 'voiceId'), modelId: typeof settings.modelId === 'string' ? settings.modelId : undefined, outputFormat: typeof settings.outputFormat === 'string' ? settings.outputFormat : undefined }));
  }
}

const toolDefinitions = [
  { type: 'function', function: { name: 'analyze_audio', description: 'Inspect an uploaded audio file and return verified metadata.', parameters: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'], additionalProperties: false } } },
  { type: 'function', function: { name: 'master_audio', description: 'Create a verified FFmpeg mastered render.', parameters: { type: 'object', properties: { input: { type: 'string' }, profile: { type: 'string', enum: ['balanced', 'warm', 'bright'] }, targetLufs: { type: 'number' }, format: { type: 'string', enum: ['wav', 'mp3'] } }, required: ['input'], additionalProperties: false } } },
  { type: 'function', function: { name: 'separate_stems', description: 'Create genuine Demucs stems from uploaded audio.', parameters: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'], additionalProperties: false } } },
  { type: 'function', function: { name: 'resample_audio', description: 'Render verified sample-rate conversion with FFmpeg.', parameters: { type: 'object', properties: { input: { type: 'string' }, sampleRate: { type: 'number', enum: [22050, 32000, 44100, 48000, 88200, 96000] }, format: { type: 'string', enum: ['wav', 'mp3'] } }, required: ['input', 'sampleRate'], additionalProperties: false } } },
  { type: 'function', function: { name: 'generate_voiceover', description: 'Generate a voiceover via ElevenLabs.', parameters: { type: 'object', properties: { text: { type: 'string' }, voiceId: { type: 'string' }, modelId: { type: 'string' } }, required: ['text', 'voiceId'], additionalProperties: false } } },
] as const;

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'SoniMix Audio Studio Backend', authenticatedApi: Boolean(apiToken), engines: { ffmpeg: process.env.FFMPEG_BIN || 'ffmpeg', demucs: process.env.DEMUCS_BIN || 'demucs' } }));
app.post('/api/uploads', requireApiToken, async (request, response) => {
  try {
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) throw new Error('Send audio bytes with Content-Type: application/octet-stream');
    const relative = path.join('uploads', `${randomUUID()}-${safeBaseName(request.header('x-filename') || 'upload.wav')}`).replace(/\\/g, '/');
    await ensureDirectories(); await writeFile(resolveDataFile(relative), request.body); response.status(201).json({ file: relative });
  } catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Upload failed' }); }
});
app.post('/api/jobs', requireApiToken, (request, response) => {
  try {
    const type = request.body?.type; if (!isJobType(type)) throw new Error('Unsupported job type');
    const settings = request.body?.settings && typeof request.body.settings === 'object' ? request.body.settings as Record<string, unknown> : {};
    const input = type === 'generate_voiceover' ? undefined : requireInputReference(request.body?.input);
    response.status(202).json(submitJob(type, input, settings));
  } catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Invalid job request' }); }
});
app.get('/api/jobs/:id', requireApiToken, (request, response) => { const job = queue.get(request.params.id); if (!job) return response.status(404).json({ error: 'Job not found' }); response.json(job); });
app.post('/api/jobs/:id/cancel', requireApiToken, (request, response) => { if (!queue.cancel(request.params.id)) return response.status(409).json({ error: 'Job cannot be cancelled' }); response.status(202).json(queue.get(request.params.id)); });
app.get('/api/files/*', requireApiToken, (request, response) => { try { response.sendFile(resolveDataFile(request.params[0])); } catch { response.status(404).json({ error: 'File not found' }); } });
app.get('/api/providers/loudly', requireApiToken, (_request, response) => response.json(loudlyStatus()));
app.get('/api/providers/elevenlabs/voices', requireApiToken, async (_request, response) => { try { response.json(await listElevenLabsVoices()); } catch (error) { response.status(503).json({ error: error instanceof Error ? error.message : 'ElevenLabs unavailable' }); } });

app.post('/api/ai/orchestrate', requireApiToken, async (request, response) => {
  try {
    const instruction = stringValue(request.body?.instruction, 'instruction');
    const apiKey = process.env.XAI_API_KEY; const model = process.env.XAI_MODEL;
    if (!apiKey || !model) throw new Error('XAI_API_KEY and XAI_MODEL must be configured for orchestration');
    const xaiResponse = await fetch('https://api.x.ai/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(60_000), body: JSON.stringify({ model, messages: [{ role: 'system', content: 'You are SoniMix production planner. Use only provided tools. Never claim a task completed; queued jobs must finish and be verified.' }, { role: 'user', content: instruction }], tools: toolDefinitions, tool_choice: 'auto', parallel_tool_calls: false }) });
    if (!xaiResponse.ok) throw new Error(`xAI returned ${xaiResponse.status}: ${(await xaiResponse.text()).slice(0, 500)}`);
    const data = await xaiResponse.json() as { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }> };
    const message = data.choices?.[0]?.message; const scheduled: AudioJob[] = [];
    for (const call of message?.tool_calls || []) { const name = call.function?.name; if (!isJobType(name)) continue; const settings = JSON.parse(call.function?.arguments || '{}') as Record<string, unknown>; const input = name === 'generate_voiceover' ? undefined : requireInputReference(settings.input); scheduled.push(submitJob(name, input, settings)); }
    response.json({ explanation: message?.content || null, jobs: scheduled });
  } catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Orchestration failed' }); }
});

async function startServer() {
  await ensureDirectories();
  if (process.env.NODE_ENV !== 'production') { const vite = await createViteServer({ server: { middlewareMode: true, host: '0.0.0.0' }, appType: 'spa' }); app.use(vite.middlewares); }
  else { const distPath = path.resolve(process.cwd(), 'dist'); app.use(express.static(distPath)); app.get('*', (_request, response) => response.sendFile(path.resolve(distPath, 'index.html'))); }
  app.listen(PORT, '0.0.0.0', () => console.log(`SoniMix server running on http://0.0.0.0:${PORT}`));
}
void startServer();
