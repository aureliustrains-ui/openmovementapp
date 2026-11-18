# Multi-coach plan (prepared 2026-11-18, nothing built yet)

Goal: Aurelius is the owner of the platform. Other coaches (first: Michelle) can use it for their own clients. Only the owner adds/removes coaches and sees all coaches. Coaches see only their own clients. One shared exercise library where every exercise shows who added it.

Decisions already made by the owner:
- Coaches see **only their own clients**. The owner sees everyone.
- **One shared exercise library** with an "added by" label. A coach edits only their own exercises.
- **Coaches can create folders** in the shared library.
- **Removing a coach changes nothing else:** the coach account is marked `Removed` (row kept, so `coach_id` links stay valid); their clients, plans, logs and the contacts (emails) stay in the database untouched and stay visible to the owner. No automatic reassignment or deletion.
- **The owner can open every coach's clients** (his platform). Planned: opening another coach's client is **read-only by default** to avoid accidental edits; the owner can switch to edit when needed. Coaches are told in their terms; the privacy notice for clients should say the platform owner can see plans and logs.

## What the code does today (audit)

- `users.role` is `Admin` or `Client`. No coach link on clients. `users` has no `coachId`.
- Production admin = `role === "Admin"` AND email equals the primary admin email (`server/modules/authz/admin-access.ts`, default `aureliustrains@gmail.com`).
- **Boot demotion:** `maybeBootstrapAdminUser` in `server/routes.ts` (about lines 610-680) turns every non-primary Admin into `Client` at every production start. This is the likely reason "Michelle" shows up as a client. It must change before any coach exists, or coaches are demoted on every deploy.
- About 76 API routes, 61 `requireAdmin/isAdmin` checks in `server/routes.ts`. Most admin routes return **all** rows (`getUsers`, `getPhases`, `getSessions`, templates, messages, notification summary). `assertCanReadClientCheckins` already tolerates a `Coach` role (first small step exists).
- Templates (`exercise_templates`, `section_templates`, `session_templates`, `phase_templates`, `template_folders`) have no author column.
- Frontend gates by `role === "Admin"` in `App.tsx`, `AppLayout.tsx`, `Login.tsx`, `ClientsList.tsx`, `ClientProfile.tsx`.
- Impersonation was removed from the client page, so there is no way to look "as" another coach in the UI. Test with real second accounts.
- Tests: `npm test` uses `tsx` and cannot run in the Claude sandbox (esbuild is the macOS build). Tests run on the owner's Mac. `npx tsc --noEmit -p .` works everywhere.

## Target model

Roles: `Admin` (= owner, still tied to the primary email), `Coach`, `Client`.
Keep `Admin` as the owner role (least change; existing checks stay valid for the owner).

Schema (additive, applied by `server/schema-upgrades.ts` like the other upgrades):
- `users.coach_id` varchar null. For clients: the coach who owns them. Null = owner (legacy rows).
- `exercise_templates.created_by` varchar null (+ same on section/session/phase templates and folders so "added by" is consistent). Backfill with the owner id.
- Optional later: `users.created_at` / `last_active_at` for the coaches overview.

Authorization helper (new `server/modules/authz/access.ts`):
- `isOwner(user)`, `isStaff(user)` (owner or coach), `requireStaff`, `requireOwner`.
- `canAccessClient(user, clientId)`: owner always; coach only if `client.coachId === coach.id`; client only for itself.
- `canEditTemplate(user, template)`: owner always; coach only if `createdBy === coach.id`.
- One place, used by every route, so a coach cannot reach another coach's client by guessing an id.

## Route plan (every route must be one of these)

| Area | Rule |
| --- | --- |
| `GET /api/users` | Owner: all. Coach: self + own clients only. |
| `POST /api/users` | Coach: may create only `Client` with `coachId = self`. Owner: may create Clients (assign a coach) and Coaches. Only the owner creates/removes Coaches. |
| `PATCH /api/users/:id/status`, `DELETE /api/users/:id` | Owner any. Coach: own clients only. Only the owner for Coach accounts. |
| Phases / sessions (list, get, create, patch, delete) | Via the phase's `clientId` -> `canAccessClient`. List endpoints filter by accessible clients. |
| Workout logs, check-ins, progress reports, movement checks, specifics, messages, chat read, notification summaries | `canAccessClient(clientId)`; summaries filter to accessible clients. |
| `GET /api/admin/contacts.csv` | Owner only. |
| Exercise / section / session / phase templates + folders | Read: all staff (shared library). Create (including folders): any staff, stamps `createdBy`. Edit/delete: owner any, coach own only. |
| New `GET /api/admin/coaches` (+ POST/PATCH/DELETE) | Owner only. Returns name, email, status, client count, exercises added. |

Also: `getTemplatesForPhase/insert-from-template` copies must keep working for coaches; stored plans stay private to the coach's client.

## UI plan

- New owner-only page `/app/admin/coaches`: table of coaches (name, email, status, #clients, #exercises added), Add coach (name, email, initial password set by the owner; the coach changes it via the existing change-password flow), Deactivate, Remove (clients must be reassigned first).
- Clients list/rail: owner sees a coach tag and a coach filter; coaches see only their clients.
- Exercise library: "Added by" name on each exercise, a filter "Added by me / by others", edit/delete disabled on others' exercises.
- Top nav: "Coaches" tab visible to the owner only.
- Gates in `App.tsx`, `AppLayout.tsx`, `Login.tsx`: treat `Coach` like `Admin` for the admin area; owner-only parts keep `Admin`.

## Order of work (one commit per step, each type-checked)

1. Remove the boot demotion; replace with "only the primary email may be Admin; Coach role is left alone". (Without this, nothing else survives a deploy.)
2. Schema upgrades + backfill (`coach_id` null/owner, `created_by` = owner). Idempotent.
3. `access.ts` helper + unit tests (two coaches, owner, client).
4. Convert routes group by group to the helper (users, phases/sessions, logs/check-ins/reports, messages/notifications, templates). After each group: tests + tsc.
5. Coaches API + owner-only page.
6. "Added by" in the exercise library (+ author stamp on create).
7. Frontend role gates; coach-scoped client list.
8. Isolation test pass with two real coach accounts (owner, Coach A, Coach B, one client each): every route returns 403/404 for the other coach's data.

## Before starting (checklist for the owner)

1. **Back up the database** (Railway/Neon snapshot) before the schema step.
2. Ask Michelle whether she made the existing client account "Michelle Eichmann" (no active phase). Decide: keep it as her coach login (convert to Coach) or delete it and create a fresh Coach account.
3. Confirm the primary owner email (default `aureliustrains@gmail.com`) and that `PRIMARY_ADMIN_EMAIL` on Railway matches.
4. Decide how Michelle gets her password (owner sets one; she changes it on first login).
5. Have a local test database ready (the Neon one from `.env.local`; run `npm run db:push`, then create local test accounts). Coach isolation must be tested with two coach accounts and one client each.
6. Out of scope for now: billing/prices, invitations by email, coach-visible branding, client self-signup.

## Open questions

- Read-only by default for the owner on other coaches' clients: confirm.
- Wording for coach terms / client privacy notice (owner can see plans and logs).

## Build status (feat/multi-coach)
- Server: done and committed (coach role, `coachId`, `createdBy`, access checks on all client routes, coaches API, boot converts other admins to Coach).
- Frontend: Coaches page (owner), "Added by" + "Only mine / Added by others" in the exercise library, role gates, coach label on a client.
- Not built: owner "read-only unless Edit anyway" lock on another coach's client (only a label for now); folder rename/delete buttons are still shown to coaches on other people's folders (the server refuses them).
