# SoniMix deployment: Vercel frontend + Render Express backend

## Required architecture

- **Vercel remains the frontend host** for the Vite SPA.
- **Render runs the full Express backend** from `server.ts`, including authentication, Google OAuth, SQLite, file uploads, audio jobs, and provider APIs.
- The Vercel rewrite in `vercel.json` forwards browser requests matching `/api/*` to the Render service, so frontend code can keep using relative `/api/...` URLs and the browser sees them as same-origin requests to Vercel.

## Deploy the Render backend

1. Create a Render Blueprint using the repository branch that contains `render.yaml` and this document.
2. Render reads `render.yaml`, runs `npm install && npm run build`, starts `npm run start`, and checks `/api/health`.
3. Render provisions the configured persistent disk mounted at `/opt/render/project/src/data` for the existing SQLite database and user audio files.
4. Set the required secrets in Render's environment dashboard; never commit secrets.

### Required Render environment variables

- `ADMIN_EMAIL`: email for the initial administrator.
- `ADMIN_PASSWORD`: unique password of at least 14 characters.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: credentials for a Google OAuth Web application.
- `GOOGLE_REDIRECT_URI`: use the public **Vercel domain**, followed by `/api/auth/google/callback`, e.g. `https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/google/callback`.

Use the Vercel domain for the Google callback because the Vercel rewrite forwards the callback request to Render while keeping the browser on the Vercel domain. Add that exact URL to **Authorized redirect URIs** in Google Cloud Console. Google redirect URI and `GOOGLE_REDIRECT_URI` must match exactly.

Optional provider settings: `XAI_API_KEY`, `XAI_MODEL`, `ELEVENLABS_API_KEY`, `MUSICGPT_API_KEY`, and `ACEDATA_API_KEY`.

## Configure the Vercel frontend

1. Keep the existing Vercel project connected to this repository.
2. Update `vercel.json` by replacing `YOUR-RENDER-SERVICE` in the rewrite destination with the actual Render service name, for example `https://sonimix-api.onrender.com/api/:path*`.
3. Deploy the branch containing that rewrite to Vercel, or merge it after reviewing the PR.
4. No Google OAuth secrets belong in Vercel for the proxy design. Keep OAuth secrets only in Render. The Vercel rewrite simply forwards the request.

## Verify both deployments

1. Direct Render health: `https://YOUR-RENDER-SERVICE.onrender.com/api/health` should return JSON with `"status":"ok"`.
2. Proxied status through Vercel: `https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/google/status` should return `{"available":true}` after all three Google variables are set on Render.
3. From the Vercel-hosted homepage, test registration, email/password login, Google sign-in, and admin login.

## Important limits

- This service uses `node:sqlite`, local files, and an in-memory job queue; keep it as a **single persistent Render service**. Do not scale to multiple instances or point multiple services at the same SQLite file.
- A persistent disk protects data during normal deploys/restarts but is not a backup. Back up the SQLite database and audio directories before storage changes.
- Verify FFmpeg/FFprobe and real audio processing on Render. Demucs is a separate Python toolchain and is not installed by the default Node build; stem separation needs explicit installation/configuration and is not guaranteed by this configuration.
- This configuration is for the intended split architecture: Vercel frontend, Render backend. Do not deploy the frontend from Render.
