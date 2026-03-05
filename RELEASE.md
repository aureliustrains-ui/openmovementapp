# Production Release Checklist

## 1) Preconditions
- [ ] `main` is green in CI (`format:check`, `lint`, `typecheck`, `test`).
- [ ] `npm audit --omit=dev` reports `0 vulnerabilities`.
- [ ] Required env vars are set in deployment target:
  - `DATABASE_URL`
  - `SESSION_SECRET` (min 16 chars, never default in production)
  - `NODE_ENV=production`
  - `PORT`
  - `SHUTDOWN_TIMEOUT_MS` (default `10000`)

## 2) Build and verify locally
- [ ] Install dependencies: `npm ci`
- [ ] Validate code quality: `npm run lint && npm run typecheck && npm test`
- [ ] Build app: `npm run build`
- [ ] Start app (prod mode): `NODE_ENV=production npm start`
- [ ] Verify health checks:
  - `GET /healthz` returns `200`
  - `GET /readyz` returns `200` when DB is reachable

## 3) Database migration strategy
- Current strategy is schema-first with Drizzle.
- Use one of:
  - Fast sync (current): `npm run db:push`
  - Versioned migrations (recommended for teams):
    1. `npx drizzle-kit@0.31.9 generate`
    2. Commit generated files under `migrations/`
    3. Apply in deploy pipeline with `npx drizzle-kit@0.31.9 migrate`
- [ ] Back up production DB before applying schema changes.
- [ ] Never run destructive migration without tested rollback.

## 4) Runtime operations
- Structured logs are JSON lines (`timestamp`, `level`, `source`, `message`, metadata).
- Graceful shutdown is enabled:
  - On `SIGTERM`/`SIGINT`, HTTP server stops accepting new requests.
  - DB pool closes before process exit.
  - Forced exit occurs after `SHUTDOWN_TIMEOUT_MS`.
- Error reporting strategy:
  - All uncaught API errors are normalized by `server/http/error-handler.ts`.
  - At minimum, collect stderr/stdout logs centrally.
  - Optional next step: wire a provider (Sentry/Datadog) in `errorHandler` for alerting.

## 5) Deploy steps
- [ ] Deploy build artifact/container.
- [ ] Run DB migration step (`db:push` or `migrate`) against target DB.
- [ ] Run smoke checks:
  - Login works
  - Admin-only endpoints enforce `403` for clients
  - `/healthz` and `/readyz` healthy
- [ ] Monitor logs/error rate for 15-30 minutes.

## 6) Rollback plan
- App rollback:
  - [ ] Redeploy last known good artifact/image.
- DB rollback:
  - [ ] If migration is backward-compatible: rollback app only.
  - [ ] If migration is breaking: restore from backup or apply tested down-migration.
- [ ] Re-run smoke checks after rollback.

