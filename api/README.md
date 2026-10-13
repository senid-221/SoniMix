# Vercel API functions

This repository's browser UI is a Vite SPA, while `server.ts` is a long-running Express application that uses `node:sqlite`, the local filesystem, FFmpeg/Demucs and an in-memory worker queue. Vercel does not run that Express process merely because `server.ts` exists.

The function in `api/auth/google/status.ts` only provides the lightweight OAuth availability check used by the sign-in modal. It does not implement the Google callback, database-backed account/session operations, or the audio job API.

For Google sign-in to complete, all OAuth routes must be hosted by a persistent Node service or implemented as Vercel functions using a persistent database/session store. Do not route OAuth callbacks to this status-only function. Required server environment values are `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the exact `GOOGLE_REDIRECT_URI` registered in Google Cloud Console.
