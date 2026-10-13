# Vercel persistence migration plan

This branch is being used to prepare a non-destructive serverless migration. Do not route production traffic to the new backend until the storage migration and worker tests are complete.

## Chosen service boundaries

- PostgreSQL: accounts, hashed sessions, projects, jobs, exports, preferences, file ownership, and app settings.
- Private Vercel Blob: upload and output bytes. Store blob pathname metadata in the PostgreSQL `files` table; never use local disk paths as file identifiers.
- Durable job storage in PostgreSQL with an atomic `FOR UPDATE SKIP LOCKED` claim protocol; retry with exponential backoff and idempotent state updates.
- An audio worker runs in a process/container where FFmpeg/FFprobe and (for stem splitting) Python + Demucs/models are actually installed. Vercel functions enqueue work and return; they should not assume subprocesses, model downloads, or local artifacts survive an invocation.

## Required service setup

Create a managed PostgreSQL database and a private Vercel Blob store in Vercel. Configure these server-only variables:

- `DATABASE_URL` — provider-issued PostgreSQL URI
- `BLOB_READ_WRITE_TOKEN` — token created by the attached Blob store
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — initial administrator bootstrap
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — optional Google OAuth
- `AUDIO_WORKER_URL`, `AUDIO_WORKER_TOKEN` — HTTPS worker endpoint and shared secret (if using an external worker)
- `SONIMIX_WORKER_SECRET` — secret used to authenticate the private Vercel worker function if that option is selected

No real values belong in Git.

## Migration order

1. Snapshot/backup the existing persistent SQLite database and audio folders from the current host.
2. Apply `server/postgres-schema.sql` to the empty Postgres database.
3. Import all rows with a one-time migration utility. Preserve password hashes and Google subjects; migrate files to Blob and map old file paths to Blob pathnames. Keep a backup and record row counts.
4. Validate with integration tests and a staging deployment against actual Postgres and Blob services. Check account ownership, Google OAuth, exports, projects, and playback/downloads.
5. Start the audio worker, verify a real analysis/mastering job end-to-end, verify failure/retry and duplicate message handling, then switch production traffic.
6. Retain the previous deployment/data backup through the rollback period.

The current SQLite database is local to the previous host. This repository checkout does not contain its live data or media bytes, so a data import cannot be safely performed by code changes alone.
