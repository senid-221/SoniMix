# SoniMix authentication and Vercel deployment

## Existing authentication routes

- `GET /api/health` — service status
- `POST /api/auth/register` — user registration
- `POST /api/auth/login` — email/password sign-in
- `POST /api/auth/admin/login` — admin-only sign-in
- `GET /api/auth/session` — current session
- `POST /api/auth/logout` — revoke current session
- `GET /api/auth/google/status` — reports whether OAuth settings exist
- `GET /api/auth/google` — start Google authorization-code flow
- `GET /api/auth/google/callback` — validate OAuth state and establish session

## Google OAuth settings

Set these exact server-side variables in Vercel:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

For production, `GOOGLE_REDIRECT_URI` must be the exact HTTPS production URL ending in `/api/auth/google/callback`. Add the identical URL to the OAuth client's Authorized redirect URIs in Google Cloud Console. Do not prefix server secrets with `VITE_` or expose them to browser code.

The current frontend disables the Google button whenever `/api/auth/google/status` returns `available: false`. If false, check the three settings above in the Vercel Production environment and redeploy.

## Vercel storage compatibility

The original runtime uses Node's built-in SQLite, local file paths for audio uploads/outputs, and a process-local queue. A Vercel serverless rewrite alone does not make those durable. This branch adds a PostgreSQL schema and storage/queue contracts plus a migration plan, but the **full runtime migration is not yet complete**: the live persistence drivers, file transfer, Vercel handlers, and external worker have not been integration-tested against provisioned service instances. Do not deploy this branch to Production or merge it as a completed runtime fix yet.

See:
- `server/postgres-schema.sql` for the target durable schema
- `server/storage-contract.ts` for object store/queue interfaces
- `server/durable-queue-contract.ts` for atomic claim/retry SQL
- `server/storage-migration-status.ts` for deployment readiness checks
- `VERCEL_PERSISTENCE_MIGRATION.md` for required service setup and data migration

Target architecture:
- PostgreSQL for users, sessions, projects, jobs, preferences, exports, files, and app settings
- Private Vercel Blob for audio bytes
- An external audio worker that actually has FFmpeg/FFprobe and Demucs available
- PostgreSQL-backed atomic job claims/retries or a supported durable queue

## Existing SQLite tables

The current schema creates `users`, `sessions`, `projects`, `jobs`, `exports`, `user_preferences`, `files`, and `app_settings`. It adds Google account linking and compatibility columns on startup. The PostgreSQL schema is provided as a target schema; migration of existing rows and media bytes must happen from a backup of the original persistent host.

## Rollout verification

1. Back up SQLite and all media from the original persistent host.
2. Provision PostgreSQL and private Blob, then apply the schema and migrate rows/media.
3. Provision the audio worker, and verify a real audio job completes with the result stored durably.
4. Verify `/api/health` and `/api/auth/google/status` on a staging deployment.
5. Test user login, administrator login, Google OAuth callback, refresh/session persistence, projects, exports, and file ownership/URLs.
6. Switch production only after these tests pass, and keep the former deployment/backup available for rollback.

Never add secret values to Git.