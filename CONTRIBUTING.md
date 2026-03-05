# Contributing

## Local setup

1. Copy env template and set secrets locally:
   - `cp .env.example .env` (or export variables in your shell)
2. Install dependencies:
   - `npm install`
3. Start the app:
   - `npm run dev`

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
