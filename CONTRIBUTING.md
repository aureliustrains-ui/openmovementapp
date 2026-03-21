# Contributing

## Local setup

1. Copy env template and set secrets locally:
   - `cp .env.example .env.local`
2. Install dependencies:
   - `npm install`
3. Start the app:
   - `npm run dev`

## Local env safety

- Local runtime and db tooling now load env files in this order:
  1. explicit shell env vars (highest priority)
  2. `.env.local`
  3. `.env`
- Keep local secrets in `.env.local` only.
- `.env.local` and `.env.*.local` are gitignored and must never be committed.
- Railway uses its own service Variables at runtime. Do not commit DB URLs/secrets to GitHub.

## Local database commands

- Apply schema to your local dev DB target:
  - `npm run db:push`
- Create/update a local dev admin account (uses env vars + local DB target):
  - `BOOTSTRAP_ADMIN_EMAIL=<your-email> BOOTSTRAP_ADMIN_PASSWORD=<set-in-shell> BOOTSTRAP_ADMIN_NAME="Dev Admin" npm run admin:bootstrap`

## Quality checks (must pass before PR)

- Format check: `npm run format:check`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit tests: `npm test`

You can auto-format with:

- `npm run format`

## Architecture and boundaries

This repository follows a modular monolith style:

- `client/` UI and page composition only.
- `server/` HTTP + application logic + data access.
- `shared/` shared schema/types only.

Dependency direction:

```text
client -> HTTP API
server/routes -> server/http + server/storage
server/storage -> server/db -> shared/schema
shared -> (no app imports)
```

Rules:

- Keep transport concerns in route files (request/response mapping).
- Keep cross-cutting HTTP logic in `server/http/*` (auth context, DTO presenters, error handling, logging).
- Do not import `client/*` from `server/*`.
- Do not create circular dependencies across `server` modules.
- Prefer explicit module names:
  - `*.routes.ts` for route registration
  - `*.service.ts` for business logic orchestration
  - `*.test.ts` for unit tests

## Env/config

- Runtime config is validated in `server/config.ts`.
- Never commit secrets. Use `.env.example` as the contract for required variables.
- Required:
  - `DATABASE_URL`
  - `SESSION_SECRET`
  - `NODE_ENV`
  - `PORT`
