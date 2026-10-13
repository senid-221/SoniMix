# SoniMix deployment: Render backend + Vercel frontend

## Recommended layout

- **Render** runs the full Express server from `server.ts`. It serves both API routes and the built Vite app from the same origin.
- **Vercel** can continue hosting the static frontend if desired, but its frontend must call the Render API origin. The current frontend uses relative `/api/...` requests, so keeping Vercel as the frontend requires a same-origin proxy/rewrite and cookie-domain decisions. The simplest first deployment is to serve the UI and API together from the Render service and verify login there before splitting them across domains.

## Create the Render service

1. Push/merge this branch to the repository (or choose the branch explicitly when creating the Render service).
2. In Render, choose **New + → Blueprint** and connect `senid-221/SoniMix`; select the branch containing `render.yaml`.
3. Render reads `render.yaml`, builds with `npm install && npm run build`, starts with `npm run start`, and checks `/api/health`.
4. Set the required values marked `sync: false` in Render's environment dashboard. Never commit real credentials.
5. Keep the persistent disk mounted at `/opt/render/project/src/data`. The SQLite database and uploaded/output files live under `SONIMIX_DATA_DIR`. Do not remove the disk after real users create accounts or files.

## Required environment settings

- `ADMIN_EMAIL`: email for the initial administrator.
- `ADMIN_PASSWORD`: unique password of at least 14 characters.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: credentials for a Google OAuth Web application.
- `GOOGLE_REDIRECT_URI`: set to the exact Render URL followed by `/api/auth/google/callback`, e.g. `https://YOUR-RENDER-SERVICE.onrender.com/api/auth/google/callback`.

In Google Cloud Console, add that exact URL to **Authorized redirect URIs** for the OAuth client. After adding/changing the environment values, redeploy the service.

Optional API provider settings: `XAI_API_KEY`, `XAI_MODEL`, `ELEVENLABS_API_KEY`, `MUSICGPT_API_KEY`, and `ACEDATA_API_KEY`.

## Verify deployment

1. Open `https://YOUR-RENDER-SERVICE.onrender.com/api/health` and confirm it responds with JSON and `"status":"ok"`.
2. Open `https://YOUR-RENDER-SERVICE.onrender.com/api/auth/google/status`; it should return `{"available":true}` after all three Google variables are set.
3. Open the Render-served homepage and test account registration, email/password login, Google sign-in, and administrator login.
4. Keep `GOOGLE_REDIRECT_URI` and the Google Console redirect URI identical, character-for-character.

## Important limits

- This service uses `node:sqlite`, a local persistent disk, local audio files, and an in-memory job queue. Keep it as a **single persistent Render service** for now; do not scale it to multiple instances and do not run a second service against the same SQLite file.
- A persistent disk protects data from normal deploys/restarts, but it is not a replacement for backups. Back up the SQLite database and audio directories before future storage changes.
- FFmpeg is expected to exist on the host; verify `/api/health` and an actual audio task after deployment. Demucs is a separate Python toolchain and is not installed by this Node build command. Stem separation requires Demucs to be installed and configured; it must not be assumed ready solely because this service deployed.
- A Vercel-hosted frontend should not call its own Vercel functions for authentication if the full auth service is on Render. Either serve the frontend from Render with the API (simplest) or explicitly configure a Vercel rewrite/proxy to Render and verify cookies and OAuth callback handling across the chosen domains.
