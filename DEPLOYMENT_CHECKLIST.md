# CoachingApp Deployment Checklist

## 1) Prerequisites

- Create separate environments: `development`, `staging`, `production`.
- Provision managed PostgreSQL (Neon/Supabase/RDS).
- Set `DATABASE_URL` for each environment.
- Generate strong session secret for each environment:
  - `openssl rand -base64 48`

## 2) Required Environment Variables

- `NODE_ENV=production`
- `PORT=5000` (or platform-provided port)
- `DATABASE_URL=<postgres connection string>`
- `SESSION_SECRET=<strong random secret>`

## 3) First Production DB Setup

1. Install dependencies:
   - `npm install`
2. Apply schema:
   - `npm run db:push`
3. Seed initial users/data (optional):
   - `tsx server/seed.ts`

## 4) Build and Start Commands

- Build: `npm run build`
- Start: `npm run start`

## 5) Hosting Setup (Render/Railway/Fly)

- Create a web service from this repo.
- Set build command to `npm run build`.
- Set start command to `npm run start`.
- Configure all env vars listed above.
- Enable automatic deploys from your main branch.

## 6) Domain + HTTPS

- Attach custom domain (for example `app.yourdomain.com`).
- Point DNS records to your host.
- Enforce HTTPS.
- Verify secure cookies work on production domain.

## 7) Security Before Go-Live

- Confirm all app routes require session auth.
- Confirm RBAC behavior:
  - Admin can access all client data.
  - Client can only access own phases/sessions/messages/logs.
- Disable default/fallback session secrets in production.

## 8) CI/CD Minimum

- Add pipeline for:
  - install
  - typecheck (`npm run check`)
  - build (`npm run build`)
- Deploy only if all checks pass.

## 9) Monitoring and Reliability

- Add error tracking (Sentry).
- Add uptime monitor on `/api/auth/me` and main app URL.
- Set database backups and test restore procedure.

## 10) Launch Validation

- Admin login works.
- Client signup and login works.
- Page refresh keeps session.
- Logout invalidates session.
- Unauthorized API calls return `401`.
- Forbidden cross-client API calls return `403`.
