# SoniMix authentication and Vercel deployment check

This note records the current authentication contract without changing the studio UI or replacing the existing storage implementation.

## Current authentication routes

- `GET /api/health` — service and provider status
- `POST /api/auth/register` — user registration
- `POST /api/auth/login` — user email/password sign-in
- `POST /api/auth/admin/login` — administrator-only email/password sign-in
- `GET /api/auth/session` — current cookie-backed session
- `POST /api/auth/logout` — revoke current session
- `GET /api/auth/google/status` — whether all server-side OAuth settings exist
- `GET /api/auth/google` — begin Google authorization-code flow
- `GET /api/auth/google/callback` — validate state, exchange code, verify Google identity, create a session

## Vercel environment settings

The OAuth code reads these exact **server-side** environment variable names:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

For production, `GOOGLE_REDIRECT_URI` must equal the exact public origin plus `/api/auth/google/callback`, for example:

```text
https://YOUR-DEPLOYMENT-DOMAIN/api/auth/google/callback
```

The identical URI must be listed in the OAuth client's **Authorized redirect URIs** in Google Cloud Console. Add the deployed domain to the OAuth consent application's authorized domains when required. Apply the changes to the Vercel Production environment and redeploy. Do not prefix these secrets with `VITE_` or expose them to browser code.

The Google button is disabled by the current frontend when `/api/auth/google/status` returns `available: false`. Check that endpoint on the deployed host; if it is false, at least one of the three settings is absent from the running server's environment.

## Important deployment constraint

The current backend is a long-lived Express server started by `tsx server.ts`. It uses Node's built-in SQLite database at `SONIMIX_DATA_DIR/database/sonimix.sqlite`, a process-local job queue, and local files for uploads/outputs. These are not a durable Vercel serverless storage design. Vercel environment variables alone cannot turn a local SQLite file into shared persistent storage, nor can this backend assume that its in-memory queue survives between invocations.

Do not expose this as fixed by merely adding a `vercel.json` rewrite: route rewriting alone would not make SQLite sessions, database schema, jobs, and uploads durable. A complete Vercel migration needs a persistent database (for example PostgreSQL), object storage for uploaded/output files, and suitable worker/queue execution, with tests and migration of the existing schema/data. This is deliberately not attempted in this minimal, non-destructive change because switching persistence without a deployment database connection and credentials could break existing users/data.

## Existing tables

The current SQLite schema creates these tables on backend startup:

- `users` — user/admin identities, password hashes, status, optional Google subject
- `sessions` — hashed session tokens and expiry
- `projects` — account-owned projects
- `jobs` — persisted job state/payload
- `exports` — user export history
- `user_preferences` — account preferences
- `files` — ownership records for uploads/outputs
- `app_settings` — admin-configurable application settings

The database bootstrap also adds the `google_sub`, `status`, and `file_size` columns/indexes for compatible existing databases and bootstraps the administrator from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Verification steps after deployment

1. Open `https://YOUR-DEPLOYMENT-DOMAIN/api/health`.
2. Open `https://YOUR-DEPLOYMENT-DOMAIN/api/auth/google/status`; it should return `{"available":true}`.
3. Verify the Google OAuth redirect URI exactly matches `GOOGLE_REDIRECT_URI`.
4. Test user registration/login and administrator login using the configured admin account.
5. Test a refresh after login. If the session disappears or a database/file error occurs across requests, deploy the persistent-storage migration before relying on production accounts.

Never add private secret values to this document or commit them to Git.
