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

Users register and sign in through server-validated email/password endpoints. Passwords are scrypt-hashed; sessions use random HttpOnly, SameSite cookies. The first admin is bootstrapped from `ADMIN_EMAIL` and `ADMIN_PASSWORD` (minimum 14 characters). Admin pages require the administrator role. Projects, jobs, preferences, uploads, exports, and branding settings persist in SQLite.

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

The current SQLite database and in-process worker queue target a single-node deployment; SQLite/file storage is not horizontally scalable, and running jobs are failed on restart rather than falsely resumed. Use a durable queue, shared database/object storage, HTTPS, backups, and production monitoring before multi-node or public production deployment. xAI, ElevenLabs, Loudly, FFmpeg, and Demucs behavior must be verified using the deployment’s real credentials and installed engines.
