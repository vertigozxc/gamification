# Life RPG Online (React + Node + Prisma)

Full rewrite of the app with:
- React frontend (Vite)
- Node.js/Express backend
- Prisma ORM with SQLite locally (switchable to PostgreSQL for production)
- Invite links and friend level visibility

## Project Structure

- `client/`: React app
- `server/`: Express API + Prisma schema

## Local Development

1. Install dependencies:

```bash
npm run install:all
```

2. Configure backend env:

```bash
cp server/.env.example server/.env
```

On Windows PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

3. Generate Prisma client and run migration:

```bash
npm --prefix server run prisma:generate
npm --prefix server run prisma:migrate
```

4. Configure frontend env:

```bash
cp client/.env.example client/.env
```

On Windows PowerShell:

```powershell
Copy-Item client/.env.example client/.env
```

Set Firebase values in `client/.env` for Google Authentication:

```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id
```

In Firebase Console:
- Create a project
- Enable Authentication -> Sign-in method -> Google
- Add `http://localhost:5173` to Authorized domains for local testing

5. Start both apps:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## API Overview

- `POST /api/profiles/upsert` create or update user profile
- `GET /api/game-state/:username` fetch user progression + daily completions
- `POST /api/quests/complete` complete quest and gain XP
- `POST /api/invites/create` create invite code/link
- `POST /api/invites/accept` accept invite and create friendship
- `GET /api/friends/:username` list friends and levels

## Deployment (Custom Backend Control)

### One-Click Render (Recommended)

This repository now includes [render.yaml](render.yaml) to deploy both API and client.

1. Push repo to GitHub.
2. In Render: New -> Blueprint -> connect your repo.
3. Render will create:
	- `life-rpg-api` (Node web service, SQLite on persistent disk)
	- `life-rpg-client` (static site)
4. After first deploy, update environment values in Render:
	- API `CLIENT_ORIGIN` -> your real client URL
	- Client `VITE_API_BASE_URL` -> your real API URL
5. Redeploy both services.

Firebase/Auth checklist after deploy:
- In Firebase Console -> Authentication -> Settings -> Authorized domains:
  - add your deployed frontend domain
  - add any preview domains you use

Health check endpoint:
- `GET /healthz` should return `{ "ok": true }`

### Multi-Region API (US + EU) + Geo Routing

This repo is now prepared for a dual-region setup:
- API US service: `life-rpg-api-us` (Oregon)
- API EU service: `life-rpg-api-eu` (Frankfurt)
- Global router endpoint used by web/mobile: `https://api.life-rpg.app`

Important data note:
- Production should use one shared PostgreSQL database for both API regions.
- Cloudflare Worker is configured with safe default `ENABLE_GEO_ROUTING=0` (all traffic to US) until shared DB is ready.

Rollout steps (Render + Cloudflare):

1. Apply Render blueprint from `render.yaml`.
2. In Render dashboard:
	- Ensure US API is named `life-rpg-api-us`.
	- Ensure EU API is created as `life-rpg-api-eu` in Frankfurt.
	- If your existing service is still `life-rpg-api`, rename it manually to `life-rpg-api-us`.
3. Deploy Cloudflare Worker from `infra/cloudflare/worker.js`.
4. Attach route `api.life-rpg.app/*` to the Worker.
5. Point DNS `api.life-rpg.app` to Cloudflare (proxied).
6. In Worker variables set `ENABLE_GEO_ROUTING=0` first, then deploy and validate.
7. Verify routing headers:
	- `x-liferpg-origin`
	- `x-liferpg-country`
	- `x-liferpg-geo-enabled`
8. Redeploy client and mobile app so they use `https://api.life-rpg.app`.
9. After shared Postgres is connected and validated in both regions, set `ENABLE_GEO_ROUTING=1`.

### Shared PostgreSQL (US + EU) and Full Reset

Use this when you want one common database for both regions and want to wipe all old data.

1. Create one PostgreSQL instance (Render Postgres, Neon, Supabase, etc).
2. Copy its connection string (`postgresql://...`).
3. In Render set `DATABASE_URL` to the same value for both:
	- `life-rpg-api-us`
	- `life-rpg-api-eu`
4. Keep `ENABLE_GEO_ROUTING=0` during migration/reset.

Full reset (delete all data and recreate schema):

1. In Render, scale `life-rpg-api-eu` to `0` instances.
2. On `life-rpg-api-us`, open Shell and run:

```bash
npm run prisma:reset
```

3. Redeploy `life-rpg-api-us`.
4. Scale `life-rpg-api-eu` back to `1` and redeploy it.
5. Validate both regions:

```bash
curl -i https://life-rpg-api-us.onrender.com/healthz
curl -i https://life-rpg-api-eu.onrender.com/healthz
```

6. After validation, set `ENABLE_GEO_ROUTING=1` in Cloudflare Worker.

Notes:
- `npm run prisma:reset` is destructive and wipes all application tables.
- Use it only when you intentionally want a clean start.

Quick verification:

```bash
curl -I https://api.life-rpg.app/healthz
curl -I https://api.life-rpg.app/api/health
```

### Option A: Deploy Backend on Render + Frontend on Vercel

1. Push repo to GitHub.
2. Create a PostgreSQL database (Render Postgres, Neon, Supabase, or Railway).
3. In `server/prisma/schema.prisma`, switch datasource provider from `sqlite` to `postgresql`.
4. Set `DATABASE_URL` in backend host environment.
5. Deploy backend service from `server/` with build command:

```bash
npm install && npm run prisma:generate && npm run prisma:deploy
```

Start command:

```bash
npm run start
```

6. Deploy frontend from `client/` on Vercel with build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

7. Set frontend env var `VITE_API_BASE_URL` to your deployed backend URL.
8. Set backend env var `CLIENT_ORIGIN` to your deployed frontend URL.

### Option B: Single Host (Railway/Fly.io)

- Deploy backend and PostgreSQL in same platform.
- Deploy frontend as static site in same platform or Vercel.
- Keep `VITE_API_BASE_URL` and `CLIENT_ORIGIN` aligned.

## Future Backend Control Suggestions

- Add real auth (JWT + refresh tokens or Clerk/Auth0)
- Add rate limiting and invite expiry cron job
- Add audit logs for progression events
- Add admin APIs for balancing quests/XP
- Add WebSocket live updates for friend activity
