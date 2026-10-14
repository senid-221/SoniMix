import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { analyze, master, resample, separate } from './server/audio-worker.js';
import { ensureDirectories, JobQueue, JobType, resolveDataFile, safeBaseName } from './server/lib.js';
import { SoniMixDatabase, SessionUser } from './server/database.js';
import { aceDataSunoStatus, elevenLabsVoiceover, generateAceSunoMusic, generateMusic, listElevenLabsVoices, loudlyStatus, musicGptStatus } from './server/providers.js';

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = 'sonimix_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const requestCounts = new Map<string, { count: number; expiresAt: number }>();
let db: SoniMixDatabase;
let queue: JobQueue;

interface AuthenticatedRequest extends Request { user?: SessionUser }

app.disable('x-powered-by');
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.raw({ type: 'application/octet-stream', limit: '250mb' }));
app.use(express.json({ limit: '1mb' }));

function cookieToken(request: Request) {
  const cookies = request.headers.cookie?.split(';') || [];
  const session = cookies.map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  return session ? decodeURIComponent(session.slice(SESSION_COOKIE.length + 1)) : undefined;
}

function cookieValue(request: Request, name: string) {
  const prefix = `${name}=`;
  const cookie = request.headers.cookie?.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

function appendSetCookie(response: Response, cookie: string) {
  const current = response.getHeader('Set-Cookie');
  const cookies = Array.isArray(current) ? current : typeof current === 'string' ? [current] : [];
  response.setHeader('Set-Cookie', [...cookies, cookie]);
}

function setSessionCookie(response: Response, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  appendSetCookie(response, `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`);
}

function clearSessionCookie(response: Response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  appendSetCookie(response, `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

function setGoogleStateCookie(response: Response, state: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  appendSetCookie(response, `sonimix_google_state=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=600${secure}`);
}

function clearGoogleStateCookie(response: Response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  appendSetCookie(response, `sonimix_google_state=; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=0${secure}`);
}

function rateLimit(bucket: string, limit: number, windowMs: number) {
  return (request: Request, response: Response, next: NextFunction) => {
    const key = `${bucket}:${request.ip || request.socket.remoteAddress || 'unknown'}`;
    const now = Date.now();
    const current = requestCounts.get(key);
    if (!current || current.expiresAt <= now) requestCounts.set(key, { count: 1, expiresAt: now + windowMs });
    else if (current.count >= limit) return response.status(429).json({ error: 'Too many requests. Try again later.' });
    else current.count += 1;
    if (requestCounts.size > 10000) for (const [entry, value] of requestCounts) if (value.expiresAt <= now) requestCounts.delete(entry);
    next();
  };
}

function requireUser(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const user = db.getSession(cookieToken(request));
  if (!user) return response.status(401).json({ error: 'Sign in to continue.' });
  request.user = user;
  next();
}

function requireAdmin(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  if (request.user?.role !== 'admin') return response.status(403).json({ error: 'Administrator access is required.' });
  next();
}

function getGoogleRedirectUri() {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  // Production should use the public Vercel URL; never default to localhost.
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return undefined;
  return undefined;
}

function stringValue(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  return value;
}

function isJobType(value: unknown): value is JobType {
  return ['analyze_audio', 'master_audio', 'separate_stems', 'resample_audio', 'convert_audio', 'generate_voiceover', 'generate_music'].includes(String(value));
}

function requireInputReference(value: unknown, user: SessionUser) {
  const input = stringValue(value, 'input');
  resolveDataFile(input);
  if (!db.canAccessFile(user.id, input, user.role === 'admin')) throw new Error('The selected file is unavailable to this account');
  return input;
}

function submitJob(userId: string, type: JobType, input: string | undefined, settings: Record<string, unknown>) {
  switch (type) {
    case 'analyze_audio': return queue.submit(userId, type, input, (job) => analyze(job));
    case 'master_audio': return queue.submit(userId, type, input, (job, attach) => master(job, {
      profile: typeof settings.profile === 'string' ? settings.profile : undefined,
      targetLufs: typeof settings.targetLufs === 'number' ? settings.targetLufs : undefined,
      bitDepth: settings.bitDepth === 16 ? 16 : 24,
      dsp: settings.dsp && typeof settings.dsp === 'object' ? settings.dsp as Record<string, unknown> : undefined,
      format: settings.format === 'mp3' ? 'mp3' : 'wav',
    }, attach));
    case 'resample_audio': case 'convert_audio': return queue.submit(userId, type, input, (job, attach) => resample(job, {
      sampleRate: Number(settings.sampleRate), format: settings.format === 'mp3' ? 'mp3' : 'wav',
      bitDepth: settings.bitDepth === 16 ? 16 : 24, speed: typeof settings.speed === 'number' ? settings.speed : 1,
      pitchSemitones: typeof settings.pitchSemitones === 'number' ? settings.pitchSemitones : 0, normalize: settings.normalize === true,
    }, attach));
    case 'separate_stems': return queue.submit(userId, type, input, (job, attach) => separate(job, attach));
    case 'generate_voiceover': return queue.submit(userId, type, undefined, (job) => elevenLabsVoiceover(job, {
      text: stringValue(settings.text, 'text'), voiceId: stringValue(settings.voiceId, 'voiceId'),
      modelId: typeof settings.modelId === 'string' ? settings.modelId : undefined,
      outputFormat: typeof settings.outputFormat === 'string' ? settings.outputFormat : undefined,
    }));
    case 'generate_music': return queue.submit(userId, type, undefined, (job) => settings.provider === 'acedata_suno' ? generateAceSunoMusic(job, {
      prompt: stringValue(settings.prompt, 'prompt'), title: typeof settings.title === 'string' ? settings.title : undefined,
      musicStyle: typeof settings.musicStyle === 'string' ? settings.musicStyle : undefined,
      lyrics: typeof settings.lyrics === 'string' ? settings.lyrics : undefined,
      model: typeof settings.model === 'string' ? settings.model : undefined, instrumental: settings.makeInstrumental === true,
    }) : generateMusic(job, {
      prompt: stringValue(settings.prompt, 'prompt'), title: typeof settings.title === 'string' ? settings.title : undefined,
      musicStyle: typeof settings.musicStyle === 'string' ? settings.musicStyle : undefined,
      lyrics: typeof settings.lyrics === 'string' ? settings.lyrics : undefined,
      model: typeof settings.model === 'string' ? settings.model : undefined,
      makeInstrumental: settings.makeInstrumental === true, vocalOnly: settings.vocalOnly === true,
      gender: typeof settings.gender === 'string' ? settings.gender : undefined,
    }));
  }
}

const toolDefinitions = [
  { type: 'function', name: 'analyze_audio', description: 'Inspect an uploaded audio file and return verified metadata.', parameters: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'], additionalProperties: false } },
  { type: 'function', name: 'master_audio', description: 'Create a verified FFmpeg mastered render.', parameters: { type: 'object', properties: { input: { type: 'string' }, profile: { type: 'string', enum: ['balanced', 'warm', 'bright'] }, targetLufs: { type: 'number' }, bitDepth: { type: 'integer', enum: [16, 24] }, format: { type: 'string', enum: ['wav', 'mp3'] } }, required: ['input'], additionalProperties: false } },
  { type: 'function', name: 'separate_stems', description: 'Create genuine Demucs stems from uploaded audio.', parameters: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'], additionalProperties: false } },
  { type: 'function', name: 'resample_audio', description: 'Render verified sample-rate conversion with FFmpeg.', parameters: { type: 'object', properties: { input: { type: 'string' }, sampleRate: { type: 'number', enum: [22050, 32000, 44100, 48000, 88200, 96000] }, format: { type: 'string', enum: ['wav', 'mp3'] } }, required: ['input', 'sampleRate'], additionalProperties: false } },
  { type: 'function', name: 'generate_voiceover', description: 'Generate a voiceover via ElevenLabs.', parameters: { type: 'object', properties: { text: { type: 'string' }, voiceId: { type: 'string' }, modelId: { type: 'string' } }, required: ['text', 'voiceId'], additionalProperties: false } },
  { type: 'function', name: 'generate_music', description: 'Submit a real music generation request to MusicGPT or Suno via Ace Data Cloud and return verified generated audio files.', parameters: { type: 'object', properties: { provider: { type: 'string', enum: ['musicgpt', 'acedata_suno'] }, prompt: { type: 'string', maxLength: 2000 }, title: { type: 'string', maxLength: 120 }, musicStyle: { type: 'string', maxLength: 500 }, lyrics: { type: 'string', maxLength: 5000 }, model: { type: 'string' }, makeInstrumental: { type: 'boolean' }, vocalOnly: { type: 'boolean' }, gender: { type: 'string', enum: ['male', 'female', 'neutral'] } }, required: ['prompt'], additionalProperties: false } },
] as const;

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'SoniMix', authentication: 'session-cookie', engines: { ffmpeg: process.env.FFMPEG_BIN || 'ffmpeg', demucs: process.env.DEMUCS_BIN || 'demucs' }, providers: { xai: Boolean(process.env.XAI_API_KEY && process.env.XAI_MODEL), loudly: loudlyStatus(), elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY), musicgpt: musicGptStatus(), acedataSuno: aceDataSunoStatus() } }));
app.get('/api/app-config', (_request, response) => response.json({ config: db.getAppConfig() || {} }));
app.put('/api/admin/app-config', requireUser, requireAdmin, (request, response) => {
  if (!request.body || typeof request.body !== 'object' || JSON.stringify(request.body).length > 100_000) return response.status(400).json({ error: 'Invalid or oversized app settings.' });
  db.saveAppConfig(request.body as Record<string, unknown>);
  response.json({ config: request.body });
});

app.post('/api/auth/register', rateLimit('register', 5, 60 * 60 * 1000), async (request, response) => {
  try {
    const { user, token } = await db.register(stringValue(request.body?.name, 'Name'), stringValue(request.body?.email, 'Email'), stringValue(request.body?.password, 'Password'));
    setSessionCookie(response, token); response.status(201).json({ user });
  } catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Registration failed' }); }
});

app.post('/api/auth/login', rateLimit('login', 10, 10 * 60 * 1000), async (request, response) => {
  try {
    const { user, token } = await db.login(stringValue(request.body?.email, 'Email'), stringValue(request.body?.password, 'Password'));
    setSessionCookie(response, token); response.json({ user });
  } catch (error) { response.status(401).json({ error: error instanceof Error ? error.message : 'Sign in failed' }); }
});

app.get('/api/auth/google/status', (_request, response) => response.json({ available: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim() && getGoogleRedirectUri()) }));
app.get('/api/auth/google', rateLimit('google-auth', 20, 10 * 60 * 1000), (request, response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = getGoogleRedirectUri();
  if (!clientId?.trim() || !clientSecret || !redirectUri) {
    return response.status(503).send('Google sign-in is not configured on this server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to the production Vercel callback URL in Render Environment.');
  }
  const state = randomBytes(32).toString('base64url');
  setGoogleStateCookie(response, state);
  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' }).toString();
  response.redirect(302, authorization.toString());
});
app.get('/api/auth/google/callback', rateLimit('google-callback', 30, 10 * 60 * 1000), async (request, response) => {
  const receivedState = typeof request.query.state === 'string' ? request.query.state : '';
  const expectedState = cookieValue(request, 'sonimix_google_state') || '';
  clearGoogleStateCookie(response);
  if (!receivedState || !expectedState || receivedState.length !== expectedState.length || !timingSafeEqual(Buffer.from(receivedState), Buffer.from(expectedState))) return response.status(400).send('Google sign-in could not be verified. Please try again.');
  if (request.query.error || typeof request.query.code !== 'string') return response.status(400).send('Google sign-in was cancelled or denied.');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getGoogleRedirectUri();
  if (!clientId?.trim() || !clientSecret?.trim() || !redirectUri) return response.status(503).send('Google sign-in is not configured on this server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to the production Vercel callback URL in Render Environment.');
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15_000),
      body: new URLSearchParams({ code: request.query.code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    if (!tokenResponse.ok) throw new Error('Google authorization code exchange failed');
    const token = await tokenResponse.json() as { access_token?: string; token_type?: string };
    if (!token.access_token || token.token_type?.toLowerCase() !== 'bearer') throw new Error('Google did not return a usable sign-in token');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15_000) });
    if (!profileResponse.ok) throw new Error('Google profile verification failed');
    const profile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: boolean; name?: string };
    if (!profile.sub || !profile.email || profile.email_verified !== true) throw new Error('A verified Google email is required');
    const result = db.loginGoogle({ subject: profile.sub, email: profile.email, name: profile.name || profile.email.split('@')[0] });
    setSessionCookie(response, result.token);
    response.redirect(303, '/');
  } catch (error) {
    response.status(401).send(error instanceof Error ? error.message : 'Google sign-in failed. Please try again.');
  }
});

app.post('/api/auth/admin/login', rateLimit('admin-login', 8, 10 * 60 * 1000), async (request, response) => {
  try {
    const { user, token } = await db.login(stringValue(request.body?.email, 'Email'), stringValue(request.body?.password, 'Password'));
    if (user.role !== 'admin') { db.revokeSession(token); return response.status(403).json({ error: 'Administrator access is required.' }); }
    setSessionCookie(response, token); response.json({ user });
  } catch (error) { response.status(401).json({ error: error instanceof Error ? error.message : 'Sign in failed' }); }
});

app.post('/api/auth/logout', (request, response) => { db.revokeSession(cookieToken(request)); clearSessionCookie(response); response.status(204).end(); });
app.get('/api/auth/session', (request, response) => response.json({ user: db.getSession(cookieToken(request)) }));
app.get('/api/profile', requireUser, (request: AuthenticatedRequest, response) => response.json({ profile: db.getProfile(request.user!.id) }));
app.patch('/api/profile', requireUser, (request: AuthenticatedRequest, response) => {
  try { response.json({ preferences: db.savePreferences(request.user!.id, request.body?.preferences || {}) }); }
  catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Preferences could not be saved' }); }
});
app.get('/api/exports', requireUser, (request: AuthenticatedRequest, response) => response.json({ exports: db.listExports(request.user!.id) }));
app.post('/api/exports', requireUser, (request: AuthenticatedRequest, response) => {
  try {
    const file = stringValue(request.body?.file, 'File');
    resolveDataFile(file);
    if (!db.canAccessFile(request.user!.id, file)) throw new Error('The selected file is unavailable to this account');
    const fileSize = Number(request.body?.fileSize);
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0) throw new Error('Export file size is invalid');
    const id = db.addExport(request.user!.id, file, stringValue(request.body?.title, 'Title'), stringValue(request.body?.format, 'Format'), fileSize);
    response.status(201).json({ id, exports: db.listExports(request.user!.id) });
  } catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Export could not be saved' }); }
});

app.get('/api/projects', requireUser, (request: AuthenticatedRequest, response) => response.json({ projects: db.listProjects(request.user!.id) }));
app.post('/api/projects', requireUser, (request: AuthenticatedRequest, response) => {
  try { response.status(201).json({ project: db.saveProject(request.user!.id, undefined, stringValue(request.body?.name, 'Project name'), request.body?.metadata || {}) }); }
  catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Project could not be created' }); }
});
app.patch('/api/projects/:id', requireUser, (request: AuthenticatedRequest, response) => {
  try { response.json({ project: db.saveProject(request.user!.id, request.params.id, stringValue(request.body?.name, 'Project name'), request.body?.metadata || {}) }); }
  catch (error) { response.status(404).json({ error: error instanceof Error ? error.message : 'Project could not be updated' }); }
});
app.delete('/api/projects/:id', requireUser, (request: AuthenticatedRequest, response) => response.status(db.deleteProject(request.user!.id, request.params.id) ? 204 : 404).end());

app.get('/api/admin/overview', requireUser, requireAdmin, (_request, response) => response.json({ users: db.listUsers(), jobs: queue.list() }));
app.patch('/api/admin/users/:id', requireUser, requireAdmin, (request: AuthenticatedRequest, response) => {
  try {
    const change: { status?: 'active' | 'suspended'; role?: 'user' | 'admin' } = {};
    if (request.body?.status === 'active' || request.body?.status === 'suspended') change.status = request.body.status;
    if (request.body?.role === 'user' || request.body?.role === 'admin') change.role = request.body.role;
    if (!db.updateUser(request.params.id, change, request.user!.id)) return response.status(404).json({ error: 'Account not found' });
    response.json({ users: db.listUsers() });
  } catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Account could not be updated' }); }
});

app.post('/api/uploads', requireUser, async (request: AuthenticatedRequest, response) => {
  try {
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) throw new Error('Send audio bytes with Content-Type: application/octet-stream');
    const maximumBytes = Number(process.env.MAX_UPLOAD_MB || 200) * 1024 * 1024;
    if (request.body.length > maximumBytes) throw new Error('Uploaded audio exceeds the configured size limit');
    const relative = path.join('uploads', `${request.user!.id}-${randomUUID()}-${safeBaseName(request.header('x-filename') || 'upload.wav')}`).replace(/\\/g, '/');
    await ensureDirectories(); await writeFile(resolveDataFile(relative), request.body);
    db.registerUpload(request.user!.id, relative, request.body.length);
    response.status(201).json({ file: relative });
  } catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Upload failed' }); }
});

app.post('/api/jobs', requireUser, (request: AuthenticatedRequest, response) => {
  try {
    const type = request.body?.type; if (!isJobType(type)) throw new Error('Unsupported job type');
    const settings = request.body?.settings && typeof request.body.settings === 'object' ? request.body.settings as Record<string, unknown> : {};
    const input = type === 'generate_voiceover' || type === 'generate_music' ? undefined : requireInputReference(request.body?.input, request.user!);
    response.status(202).json(submitJob(request.user!.id, type, input, settings));
  } catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Invalid job request' }); }
});
app.get('/api/jobs', requireUser, (request: AuthenticatedRequest, response) => response.json({ jobs: db.listJobs(request.user!.id) }));
app.get('/api/jobs/:id', requireUser, (request: AuthenticatedRequest, response) => { const job = db.getJob(request.user!.id, request.params.id); if (!job) return response.status(404).json({ error: 'Job not found' }); response.json(job); });
app.post('/api/jobs/:id/cancel', requireUser, (request: AuthenticatedRequest, response) => {
  if (!queue.cancel(request.params.id, request.user!.id, request.user!.role === 'admin')) return response.status(409).json({ error: 'Job cannot be cancelled' });
  response.status(202).json(db.getJob(request.user!.id, request.params.id));
});
app.get('/api/files/*', requireUser, (request: AuthenticatedRequest, response) => {
  try {
    const file = request.params[0];
    if (!db.canAccessFile(request.user!.id, file, request.user!.role === 'admin')) return response.status(404).json({ error: 'File not found' });
    response.sendFile(resolveDataFile(file));
  } catch { response.status(404).json({ error: 'File not found' }); }
});

app.get('/api/providers/loudly', requireUser, (_request, response) => response.json(loudlyStatus()));
app.get('/api/providers/musicgpt', requireUser, (_request, response) => response.json(musicGptStatus()));
app.get('/api/providers/suno', requireUser, (_request, response) => response.json(aceDataSunoStatus()));
app.get('/api/providers/elevenlabs/voices', requireUser, async (_request, response) => {
  try { response.json(await listElevenLabsVoices()); }
  catch (error) { response.status(503).json({ error: error instanceof Error ? error.message : 'ElevenLabs unavailable' }); }
});

app.post('/api/ai/orchestrate', requireUser, async (request: AuthenticatedRequest, response) => {
  try {
    const instruction = stringValue(request.body?.instruction, 'instruction');
    const apiKey = process.env.XAI_API_KEY; const model = process.env.XAI_MODEL;
    if (!apiKey || !model) throw new Error('xAI is not configured. Add an API key and supported model on the server.');
    const xaiResponse = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ model, input: [{ role: 'system', content: [{ type: 'input_text', text: 'Plan music workflows with the supplied functions. Ask a clarifying question if the request is ambiguous. Never claim processing completed; report queued work as in progress.' }] }, { role: 'user', content: [{ type: 'input_text', text: instruction }] }], tools: toolDefinitions, parallel_tool_calls: false }),
    });
    if (!xaiResponse.ok) throw new Error(`xAI returned ${xaiResponse.status}: ${(await xaiResponse.text()).slice(0, 500)}`);
    const data = await xaiResponse.json() as { id?: string; output?: Array<{ type?: string; name?: string; call_id?: string; arguments?: string; content?: Array<{ text?: string }> }> };
    const scheduled = [];
    const callResults = [];
    for (const call of data.output || []) {
      if (call.type !== 'function_call' || !isJobType(call.name) || !call.call_id) continue;
      try {
        const settings = JSON.parse(call.arguments || '{}') as Record<string, unknown>;
        const input = call.name === 'generate_voiceover' || call.name === 'generate_music' ? undefined : requireInputReference(settings.input, request.user!);
        const job = submitJob(request.user!.id, call.name, input, settings);
        scheduled.push(job);
        callResults.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify({ jobId: job.id, state: job.state, message: job.message }) });
      } catch (error) {
        callResults.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify({ error: error instanceof Error ? error.message : 'Tool request rejected' }) });
      }
    }
    let explanation = data.output?.filter((entry) => entry.type === 'message').flatMap((entry) => entry.content || []).map((item) => item.text || '').join('\n') || null;
    if (callResults.length && data.id) {
      const followUp = await fetch('https://api.x.ai/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(60_000), body: JSON.stringify({ model, previous_response_id: data.id, input: callResults, tools: toolDefinitions }) });
      if (!followUp.ok) throw new Error(`xAI follow-up returned ${followUp.status}: ${(await followUp.text()).slice(0, 500)}`);
      const followUpData = await followUp.json() as { output?: Array<{ type?: string; content?: Array<{ text?: string }> }> };
      explanation = followUpData.output?.filter((entry) => entry.type === 'message').flatMap((entry) => entry.content || []).map((item) => item.text || '').join('\n') || explanation;
    }
    response.json({ explanation, jobs: scheduled });
  } catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Orchestration failed' }); }
});

async function startServer() {
  await ensureDirectories();
  db = await SoniMixDatabase.open();
  queue = new JobQueue((job) => db.saveJob(job, job as unknown as Record<string, unknown>));
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true, host: '0.0.0.0' }, appType: 'spa' }); app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist'); app.use(express.static(distPath));
    app.get('*', (_request, response) => response.sendFile(path.resolve(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`SoniMix server running on http://0.0.0.0:${PORT}`));
}
void startServer();
