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
- **Phase Builder** (`admin/PhaseBuilder.tsx`): Full local-state editor for Phase → Sessions → Sections → Exercises hierarchy. Tracks dirty state, warns on unsaved changes, deletes orphaned sessions on save. Schedule assignment UI maps sessions to weekdays, generates schedule entries for all weeks. Save Draft and Publish Phase buttons. Movement Check Gate selector controls whether phase requires video approval or goes live immediately.
- **Templates CRUD** (`admin/Templates.tsx`): Full CRUD for exercise templates with create/edit/duplicate/delete, search filtering, and confirmation dialogs. Phases/Sessions/Sections tabs show "Coming Soon" for template creation.
- **Movement Checks** (`client/MyPhase.tsx` + `admin/ClientProfile.tsx`): Client submits video URL with notes, admin can approve or request resubmission with feedback. Auto-activates phase when all checks approved. Publishing with gate=yes auto-generates movement check items from exercise names.
- **Client Session View** (`client/SessionView.tsx`): Per-exercise set/rep/weight logging with completion tracking.
- **Chat** (`client/Chat.tsx` + `admin/ClientProfile.tsx` Chat tab): Bidirectional real-time messaging. Client chat polls every 5s. Admin chat tab in ClientProfile with full send/receive, auto-scroll, polling. Message button in profile header switches to Chat tab.
- **QA Checklist** (`admin/QAChecklist.tsx`): Admin-only page with data counts, quick navigation links, impersonation shortcuts, and visual QA checklist.
- **Coming Soon Dialog** (`components/ComingSoonDialog.tsx`): Reusable dialog for unimplemented features. Used across Settings, ClientsList, SessionView, Templates pages.

## Data Model
- `phases.movementChecks` (JSONB): `[{name, exerciseId, status, videoUrl, filename, submittedAt, clientNote, feedback}]`
- `phases.schedule` (JSONB): `[{day: "Monday", week: 1, sessionId: "..."}]` — day is weekday name, week is 1-indexed, duplicated for each week of the phase
- `sessions.sections` (JSONB): `[{id, name, exercises: [{id, name, sets, reps, load, rpe, tempo, rest, notes}]}]`

## Routes
- Admin: `/app/admin/clients`, `/app/admin/clients/:id`, `/app/admin/clients/:clientId/builder/:phaseId`, `/app/admin/templates`, `/app/admin/analytics`, `/app/admin/qa`
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
- Admin nav: Clients, Templates, Analytics, QA, Settings
- Client nav: My Phase, Chat, Settings, Info
