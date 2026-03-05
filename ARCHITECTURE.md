# Architecture Overview

## Current Architecture (as-is)

### Module map and responsibilities

- `client/`
  - React app, route-level pages (`client/src/pages/*`) and reusable UI (`client/src/components/*`).
  - Data fetching and mutations in `client/src/lib/api.ts` via TanStack Query.
  - Client auth state in `client/src/lib/auth.ts` (hydrates from `/api/auth/me`, supports impersonation UI state).
- `server/`
  - Express app bootstrap and middleware in `server/index.ts`.
  - API surface in one large route module: `server/routes.ts`.
  - Persistence abstraction + implementation in `server/storage.ts` (`IStorage` + `DatabaseStorage`).
  - DB wiring in `server/db.ts` (Drizzle + Neon).
  - Vite dev middleware and static serving in `server/vite.ts` and `server/static.ts`.
  - Auth crypto helpers in `server/auth.ts`.
  - Cross-cutting HTTP helpers (new step-1 extraction):
    - `server/http/auth-context.ts`
    - `server/http/user-presenter.ts`
- `shared/`
  - Shared Drizzle schema and shared TS types in `shared/schema.ts`.
- `script/`
  - Build orchestration (`script/build.ts`).

### Dependency direction (current)

```text
client/pages,components
        |
        v
 client/lib/api ----> HTTP /api/*
 client/lib/auth ---> HTTP /api/auth/*

server/index.ts --> server/routes.ts --> server/storage.ts --> server/db.ts --> shared/schema.ts
                      |                    ^
                      |                    |
                      +--> server/http/* --+
                      +--> server/auth.ts

server/seed.ts ---------------------------> server/db.ts + shared/schema.ts + server/auth.ts
```

Rules currently observed:

- `client/*` does not import `server/*`.
- `server/*` imports `shared/*`.
- `shared/*` imports no app modules.

### Where logic lives today

- UI concerns: mostly in `client/src/pages/*`, with some page-level business decisions mixed in (role redirects, filtering, optimistic UX flows).
- Business logic: mostly embedded directly in route handlers in `server/routes.ts` (auth, RBAC/ownership checks, unread calculations, workflow state transitions).
- Data access: centralized in `server/storage.ts` (good), but domain rules are not encapsulated there.
- Cross-cutting concerns:
  - Auth/session: `server/index.ts` + `server/routes.ts` + `server/http/auth-context.ts`
  - Authorization: route-level checks (`requireAdmin`, ownership checks)
  - Validation: partial Zod usage in auth/user creation routes only
  - Logging: request/response logging middleware in `server/index.ts`
  - Config: `process.env.*` read directly in bootstrap modules (`server/index.ts`, `server/db.ts`, `drizzle.config.ts`)

### Main scale bottleneck

- `server/routes.ts` is a monolith mixing:
  - transport layer (HTTP),
  - authorization,
  - business rules,
  - orchestration of storage calls.

This increases risk of regressions and makes feature work slower as the API surface grows.

## Proposed Scalable Structure (minimal-change path)

Target boundaries:

```text
server/
  app/            # app bootstrap, middleware wiring, config
  modules/
    auth/
      auth.routes.ts
      auth.service.ts
      auth.schemas.ts
    users/
      users.routes.ts
      users.service.ts
      users.schemas.ts
    phases/
      phases.routes.ts
      phases.service.ts
      phases.schemas.ts
    ... (sessions, templates, messages, logs)
  http/
    auth-context.ts        # session + auth user middleware + role guards
    user-presenter.ts      # DTO shaping
    error-handler.ts
  data/
    storage.ts             # IStorage + implementation (or split repos by aggregate)
    db.ts
shared/
  schema.ts
```

Dependency rules (enforced by convention):

```text
routes  -> services -> data(storage) -> db/shared
routes  -> http middleware/presenters
services -> shared types/schemas (optional), never import routes
data    -> shared schema
shared  -> no imports from app layers
```

No circular dependency policy:

- No barrel files (`index.ts`) that re-export across module layers.
- One-way imports only: `routes -> service -> data`.
- Shared helpers in `http/` and `lib/` only imported downward, never back up.

## Concrete Refactor Plan (8 steps)

1. Extract cross-cutting HTTP concerns from `routes.ts` into `server/http/*` (auth context + user presenter).
2. Split `routes.ts` into per-domain router modules (`auth`, `users`, `phases`, `sessions`, `messages`, `templates`, `logs`).
3. Introduce per-domain `service` modules; move business rules (ownership filtering, unread calculations) out of route handlers.
4. Move/expand Zod validation to every write endpoint and key query params; centralize schema files per module.
5. Add a typed config module (`server/app/config.ts`) to validate env once at startup.
6. Add centralized error mapping (`domain error -> HTTP`) and remove ad-hoc status handling.
7. Add test harness for service layer and API integration smoke tests around auth/RBAC invariants.
8. Add dependency guard in CI (e.g., madge/depcruise) to block circular deps and cross-layer violations.

## Step 1 Implemented

- Added `server/http/auth-context.ts`
  - request augmentation (`req.authUser`)
  - `requireSession`, `attachAuthUser`, `requireUser`, `requireAdmin`, `isAdmin`
- Added `server/http/user-presenter.ts`
  - `toPublicUser()` DTO shaping that strips `passwordHash`
- Updated `server/routes.ts` to consume these modules and remove duplicated cross-cutting helper code.

This is intentionally behavior-preserving and PR-sized.
