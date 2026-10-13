# SoniMix

SoniMix is a React audio-production workspace with a Node.js API, SQLite persistence, email/password sessions, and asynchronous audio jobs. Processing is only reported complete after output validation. Browser-side mixer/cover actions remain distinct from server-side FFmpeg/Demucs jobs.

## Local setup

Requirements: Node.js 22 or later, FFmpeg + FFprobe, and (for stem separation) Demucs with the selected model available. Configure provider keys only on the server. Copy `.env.example` to `.env`, set a unique administrator email/password, and run:

```sh
pnpm install
pnpm dev
```

The database and files live under `SONIMIX_DATA_DIR` (default `./data`). Do not expose or commit this directory. Configure `FFMPEG_BIN`, `FFPROBE_BIN`, and `DEMUCS_BIN` for deployment as needed. If a required engine or provider credential is missing, that operation returns a real failure rather than fabricated output.

## Accounts and administration

Users register and sign in through server-validated email/password endpoints or optional Google OpenID Connect. Google sign-in validates OAuth state, exchanges the authorization code server-side, requires a verified email, and stores the stable Google subject on the existing user record. Passwords are scrypt-hashed; sessions use random HttpOnly cookies. The admin is bootstrapped from `ADMIN_EMAIL` and `ADMIN_PASSWORD` (minimum 14 characters). At startup, that account is granted the admin role, reactivated, and its password is synchronized from the server environment. Admin middleware protects administrative routes; administrators can manage users and jobs and access account-owned files. Users, sessions, projects, jobs, preferences, files, exports, and app settings persist in SQLite on a persistent single-node server.

To enable Google sign-in, create an OAuth client of type **Web application** in Google Cloud Console. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` on the server. Add the exact redirect URI to the OAuth client. For production with the Vercel frontend proxying `/api/*` to Render, set `GOOGLE_REDIRECT_URI` to `https://YOUR-VERCEL-DOMAIN/api/auth/google/callback` and add that exact same URI under **Authorized redirect URIs** in Google Cloud Console. Keep `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` on the Render backend only; do not put secrets in Vercel `VITE_*` variables. For local development, use `http://localhost:3000/api/auth/google/callback`. The Google button stays clickable; the server still requires all three settings before it can complete sign-in. Google documents the code flow, exact redirect URI matching, `state` validation, and verified-email claims in its [web server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server) and [OpenID Connect docs](https://developers.google.com/identity/openid-connect/openid-connect).

## Server API

- `POST /api/uploads` accepts `application/octet-stream` and returns an account-owned file reference.
- `POST /api/jobs` queues `analyze_audio`, `master_audio`, `separate_stems`, `resample_audio`, `convert_audio`, `generate_voiceover`, or `generate_music`.
- `GET /api/jobs/:id` returns persisted status; downloadable output references are checked against ownership.
- `/api/projects`, `/api/exports`, `/api/profile` provide account-scoped persistence.
- `/api/ai/orchestrate` invokes xAI Responses function calling for a restricted set of supported jobs. Jobs are enqueued server-side; Grok is not treated as the audio processor.
- ElevenLabs TTS and voice listing require `ELEVENLABS_API_KEY`.
- MusicGPT music generation requires a server-only `MUSICGPT_API_KEY`. SoniMix submits an asynchronous provider task, polls its real status, downloads returned tracks, and verifies each file with FFprobe before marking the job complete. Configure the key in `.env`; check `/api/providers/musicgpt` while signed in. MusicGPT account credits and API permissions are required.
- Suno music generation via Ace Data Cloud requires a server-only `ACEDATA_API_KEY`. SoniMix submits to `/suno/audios`, polls `/suno/tasks`, downloads the actual result from an allowlisted media host, and verifies it with FFprobe. The Ace Data Cloud account must have the Suno and task-query API permissions and sufficient credit; check `/api/providers/suno` while signed in.
- Loudly remains unavailable until the account’s API access and exact endpoint contract are configured. No provider endpoint or entitlement is assumed.

## Server environment keys

Set provider credentials only in the server-side `.env` file (never in `VITE_*` variables or browser code):

- `XAI_API_KEY` and `XAI_MODEL` — optional AI request orchestration; both are required to enable it.
- `ELEVENLABS_API_KEY` — optional text-to-speech and voice listing.
- `MUSICGPT_API_KEY` — optional MusicGPT generation.
- `ACEDATA_API_KEY` — optional Suno generation through Ace Data Cloud.
- There is no Loudly key configured because SoniMix does not yet have a verified Loudly API adapter.

Core audio processing does not require an external API key; it requires the configured FFmpeg/FFprobe binaries and Demucs model as applicable. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are required for initial administrator setup; they are credentials, not provider API keys. Copy `.env.example` to `.env` and set only the integrations you use.

## Deployment boundaries

The current SQLite database and in-process worker queue target a persistent single-node deployment; SQLite/local files are not durable across Vercel serverless instances, and running jobs are failed on restart rather than falsely resumed. Use a persistent database, object storage, and durable queue before deploying to Vercel or multiple nodes. xAI, ElevenLabs, Loudly, FFmpeg, and Demucs behavior must be verified using the deployment’s real credentials and installed engines.
