# Current implementation status

This branch adds schema/contract/test foundations only. The existing production runtime in `server.ts` still uses `SoniMixDatabase` with `node:sqlite`, calls local filesystem helpers, and runs the process-local `JobQueue`. Those call sites have **not** been switched to PostgreSQL, private Blob, or a durable worker yet.

Do not assume these new files alone make deployment Vercel compatible.

## Implemented in this branch

- `server/postgres-schema.sql`: relational schema for eight existing application tables plus migration tracking and queue-claim fields
- `server/storage-contract.ts`: type contracts for a durable object store and durable job queue
- `server/durable-queue-contract.ts`: atomic PostgreSQL claim/completion/retry SQL
- `server/storage-migration-status.ts`: required environment-variable checks
- `tests/storage-migration-status.test.ts`: readiness helper tests
- `VERCEL_PERSISTENCE_MIGRATION.md`: provisioning, backup, migration, staging and rollback sequence

## Still required before a real deployment

1. Replace `node:sqlite` calls with an implemented PostgreSQL driver while preserving existing API response shapes and auth/session semantics.
2. Implement a real `@vercel/blob` private object-store adapter, metadata/ownership checks, short-lived download access, and the browser direct-upload flow for large audio assets.
3. Replace the in-process queue with PostgreSQL-backed enqueue/claim/cancel/status and a separately deployed, authenticated audio worker. Ensure idempotency and worker lease recovery.
4. Move the FFmpeg/Demucs workflow to a worker with the required binaries/models installed; Vercel API functions only coordinate.
5. Add a Vercel API entrypoint/routing configuration and make the Vite frontend build to static assets. Verify OAuth callback and cookies through the deployed domain.
6. Add integration tests using a disposable PostgreSQL database and a Blob test store, and verify a real audio job on staging.
7. Add a one-time importer for SQLite data and media. This must read from an explicit backup supplied by the operator; it must never invent legacy data or delete the source.
8. Run `pnpm build`, `pnpm lint`, unit/integration tests and real staging smoke tests. Fix only regressions from the migration.

Current tests cannot validate actual database, Blob, Vercel routing, Google OAuth, or audio worker behavior because the provisioned service instances/credentials are not available inside this repository editing session.
