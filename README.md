# SoniMix Production Backend

SoniMix now exposes an asynchronous, server-side audio-processing API. A job is only marked `completed` after its rendered output passes `ffprobe` validation. Missing engines or credentials produce a failed job with the actual prerequisite; no audio operation is simulated.

## Prerequisites

- Node.js 20+
- FFmpeg and FFprobe on `PATH` (or configure `FFMPEG_BIN` and `FFPROBE_BIN`)
- Demucs on `PATH` (or configure `DEMUCS_BIN`) for genuine four-stem separation
- An API token in `SONIMIX_API_TOKEN`
- Optional: `XAI_API_KEY` plus a supported `XAI_MODEL` for orchestration
- Optional: `ELEVENLABS_API_KEY` for text-to-speech

Copy `.env.example` to `.env`, set the required values, then install and run:

```sh
pnpm install
pnpm dev
```

## API workflow

All processing endpoints require `Authorization: Bearer <SONIMIX_API_TOKEN>`.

1. `POST /api/uploads` with `Content-Type: application/octet-stream` and `X-Filename` uploads audio and returns a server-side file reference.
2. `POST /api/jobs` submits `analyze_audio`, `master_audio`, `separate_stems`, `resample_audio`, `convert_audio`, or `generate_voiceover` work.
3. `GET /api/jobs/:id` returns real state: `queued`, `processing`, `completed`, `failed`, or `cancelled`.
4. Once complete, use `GET /api/files/*` to retrieve only the verified files listed in `outputs`.

`POST /api/ai/orchestrate` calls xAI with a fixed function registry. Tool arguments are schema-restricted and can only enqueue approved audio jobs; model output never reaches a shell or arbitrary code executor.

## Provider behavior

ElevenLabs voice generation uses its documented synchronous text-to-speech endpoint and verifies the returned audio before completion. The Loudly integration stays explicitly unavailable until an account-specific official API contract is configured; SoniMix does not guess provider endpoints or licensing terms.

## Production notes

The included queue is process-local and intended for development or a single-node deployment. Move jobs and metadata to a durable queue/database (for example Redis plus Postgres), use object storage with time-limited signed downloads, and replace the shared API token with authenticated user sessions before multi-user deployment.
