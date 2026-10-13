# SoniMix: transfer environment variables to Render

I cannot retrieve private Vercel environment-variable values through this repository connection. Use this checklist to transfer only the values that the Express backend needs. Never commit a real `.env` file to GitHub.

## 1. Export from Vercel locally (optional)

From a trusted local terminal with the Vercel CLI:

```sh
npm install -g vercel
vercel login
vercel link
vercel env pull .env.production.local --environment=production
```

Keep `.env.production.local` private. Do not paste its contents into chat or commit it.

## 2. Add values to Render

In Render Dashboard → SoniMix backend service → Environment, add the relevant values manually. The current Express backend recognizes these keys:

Required for account/admin setup:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` (at least 14 characters)

Required for Google OAuth:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` = `https://YOUR-VERCEL-DOMAIN/api/auth/google/callback` when Vercel proxies `/api/*` to Render. Register the exact same URL in Google Cloud Console.

Optional providers:
- `XAI_API_KEY`
- `XAI_MODEL`
- `ELEVENLABS_API_KEY`
- `MUSICGPT_API_KEY`
- `ACEDATA_API_KEY`

The runtime also has these operational settings, normally set to the supplied values in the Render Blueprint:
- `NODE_ENV=production`
- `SONIMIX_DATA_DIR=/opt/render/project/src/data`
- `MAX_UPLOAD_MB=200`
- `FFMPEG_BIN=ffmpeg`
- `FFPROBE_BIN=ffprobe`
- `DEMUCS_BIN=demucs` (only works if Demucs is installed and configured on the service)

## 3. Vercel configuration

Set `vercel.json` rewrite destination to the real Render backend:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-RENDER-SERVICE.onrender.com/api/:path*"
    }
  ]
}
```

Replace the hostname placeholder with the actual Render service hostname before deploying Vercel.

For the proxy approach, keep OAuth secrets on Render; do not duplicate them into Vercel. The frontend makes relative `/api/...` requests and Vercel forwards those to Render.

## 4. Verify

- Render: `https://YOUR-RENDER-SERVICE.onrender.com/api/health` returns JSON with `"status":"ok"`.
- Vercel proxy: `https://YOUR-VERCEL-DOMAIN/api/auth/google/status` returns `{"available":true}` once the three Google variables are set in Render.
- Test Google login and email/password login from the Vercel-hosted site.

## Important

A CLI export contains secrets. Treat it like a password vault export; do not upload it to GitHub, send it to other people, or paste it into a support conversation. Vercel dashboard variables are not automatically copied to Render.
