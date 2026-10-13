# Vercel backend migration status

The original `server.ts` backend is a persistent Express server intended to run as `pnpm dev` or `pnpm start`. It creates a local SQLite database, stores uploads/outputs on local disk, and launches an in-memory audio job queue. Those runtime assumptions are incompatible with a stateless Vercel function. A rewrite that sends every URL to the old server is not a fix.

## Production target
- PostgreSQL for users, sessions, projects, preferences, jobs, file metadata, exports, and application settings.
- Private Vercel Blob storage for audio source/output data.
- A durable queue/worker for job execution. FFmpeg and especially Demucs must execute in a worker runtime with binaries/models installed; the Vercel API function should enqueue work and return promptly.
- Vercel functions handle HTTP/auth/API requests; Vite continues to build the static React client.

## Safe migration rules
1. Create the PostgreSQL database and Blob store before switching the production deployment.
2. Take a backup of the existing SQLite file and any `data/uploads` and `data/outputs` files from the current persistent host. Vercel does not expose serverless local storage as a migration source.
3. Import users with password hashes/salts, sessions if desired, projects, preferences, jobs/history, exports, file metadata, and app settings. Copy all referenced files to Blob and replace stored file references with stable Blob pathnames.
4. Validate row counts, sample account logins, account ownership, and download references before redirecting traffic.
5. Keep the old persistent deployment and backup until smoke tests pass.

## Current code warning

This branch does not yet claim the production migration is complete. It deliberately does not deploy a generic rewrite, switch storage drivers incompletely, or silently discard audio uploads. Complete implementation requires integration tests against configured PostgreSQL and Blob resources plus an executable durable worker. Do not merge or point Production at this branch until all migration tests pass.
