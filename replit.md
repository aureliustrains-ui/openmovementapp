# Training Plans SaaS

## Overview
A training plan management platform with role-based access for coaches (Admin) and clients. Coaches build structured training phases, manage exercise templates, review movement check videos, and communicate with clients. Clients view assigned phases, log workouts, submit movement check videos, and chat with their coach.

## Tech Stack
- **Frontend**: React 18, Wouter (routing), TanStack Query (data fetching), TailwindCSS v4, Shadcn/UI
- **Backend**: Express.js, PostgreSQL (Neon), Drizzle ORM
- **Auth**: Zustand store (`client/src/lib/auth.ts`) with role-based guards, impersonation support
- **Dev**: Vite + tsx, runs on port 5000

## Architecture
- `shared/schema.ts` — Drizzle schema (users, phases, sessions, exerciseTemplates, workoutLogs, messages)
- `server/routes.ts` — Express API routes (full CRUD for phases, sessions, exercise-templates, messages, workout-logs)
- `server/storage.ts` — `IStorage` interface + `DatabaseStorage` implementation
- `client/src/lib/api.ts` — Query options + mutation hooks for all endpoints
- `client/src/lib/auth.ts` — Auth store with `login`, `logout`, `impersonate`, `stopImpersonating`

## Key Features
- **Phase Builder** (`admin/PhaseBuilder.tsx`): Full local-state editor for Phase → Sessions → Sections → Exercises hierarchy. Tracks dirty state, warns on unsaved changes, deletes orphaned sessions on save, auto-updates phase schedule.
- **Templates CRUD** (`admin/Templates.tsx`): Full CRUD for exercise templates with create/edit/duplicate/delete, search filtering, and confirmation dialogs.
- **Movement Checks** (`client/MyPhase.tsx` + `admin/ClientProfile.tsx`): Client submits video URL with notes, admin can approve or request resubmission with feedback. Auto-activates phase when all checks approved.
- **Client Session View** (`client/SessionView.tsx`): Per-exercise set/rep/weight logging with completion tracking.
- **Chat** (`client/Chat.tsx`): Real-time messaging between coach and client.

## Data Model
- `phases.movementChecks` (JSONB): `[{name, exerciseId, status, videoUrl, filename, submittedAt, clientNote, feedback}]`
- `phases.schedule` (JSONB): `[{day, week, sessionId}]`
- `sessions.sections` (JSONB): `[{id, name, exercises: [{id, name, sets, reps, load, rpe, tempo, rest, notes}]}]`

## Routes
- Admin: `/app/admin/clients`, `/app/admin/clients/:id`, `/app/admin/clients/:clientId/builder/:phaseId`, `/app/admin/templates`, `/app/admin/analytics`
- Client: `/app/client/my-phase`, `/app/client/session/:sessionId`, `/app/client/chat`, `/app/client/info`
- Shared: `/app/settings`, `/login`

## API Endpoints
- `GET/POST /api/users`
- `GET/POST/PATCH /api/phases`, `GET /api/phases/:id`
- `GET/POST/PATCH /api/sessions`, `GET /api/sessions/:id`, `DELETE /api/sessions/:id`
- `GET/POST/PATCH/DELETE /api/exercise-templates`
- `GET/POST /api/messages`, `GET/POST /api/workout-logs`

## Design
- Font: Outfit (display) + Inter (body)
- Primary: Indigo
- Cards: rounded-2xl, shadows
- Navigation: Top bar with logo, nav tabs, avatar dropdown with logout
- Layout: `AppLayout.tsx` wraps all `/app/*` routes
