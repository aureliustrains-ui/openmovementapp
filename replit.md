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
- **Phase Builder** (`admin/PhaseBuilder.tsx`): Full local-state editor for Phase → Sessions → Sections → Exercises hierarchy. Tracks dirty state (including schedule changes), warns on unsaved changes, deletes orphaned sessions on save. **Weekly Schedule Grid Editor**: Day 1-7 rows × AM/PM columns, week selector tabs, assign sessions to time slots, copy week to all weeks. Schedule entries have `{day, week, slot, sessionId}` format. Save Draft atomically persists phase + sessions + schedule, syncs local state with canonical DB IDs (no re-init race condition). Publish Phase button with confirmation dialog. Movement Check Gate selector.
- **Client Management** (`admin/ClientProfile.tsx`): Programming tab shows Current Phase (Active/Waiting), Drafts In Progress section (with edit links and session counts), and Phase History. Weekly schedule grid preview for active phase. Create Phase button always visible. Chat, Movement Checks, and Logs tabs.
- **Client My Phase** (`client/MyPhase.tsx`): Active phase view with week selector. Schedule grid (read-only, AM/PM columns) when schedule has slot data. Session chips are clickable (navigate to session detail). Falls back to card layout for legacy schedule format. Movement Check flow for pending phases.
- **Templates CRUD** (`admin/Templates.tsx`): Full CRUD for exercise templates with create/edit/duplicate/delete, search filtering, and confirmation dialogs.
- **Movement Checks** (`client/MyPhase.tsx` + `admin/ClientProfile.tsx`): Client submits video URL with notes, admin can approve or request resubmission with feedback. Auto-activates phase when all checks approved. Publishing with gate=yes auto-generates movement check items from exercise names.
- **Client Session View** (`client/SessionView.tsx`): Per-exercise set/rep/weight logging with completion tracking.
- **Chat** (`client/Chat.tsx` + `admin/ClientProfile.tsx` Chat tab): Bidirectional real-time messaging with polling.
- **QA Checklist** (`admin/QAChecklist.tsx`): Data counts, quick navigation, impersonation shortcuts, visual checklist, automated Save/Publish test.
- **Coming Soon Dialog** (`components/ComingSoonDialog.tsx`): Reusable dialog for unimplemented features.

## Data Model
- `phases.movementChecks` (JSONB): `[{name, exerciseId, status, videoUrl, filename, submittedAt, clientNote, feedback}]`
- `phases.schedule` (JSONB): `[{day: "Monday", week: 1, slot: "AM"|"PM", sessionId: "..."}]` — day is weekday name, week is 1-indexed, slot is AM/PM time-of-day
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

## Save Draft Flow (PhaseBuilder)
1. Create/update phase record in DB
2. Create/update/delete sessions individually, collect canonical DB IDs
3. Remap schedule entries from temp IDs to canonical DB IDs
4. Filter out schedule entries referencing non-existent sessions
5. Save schedule to phase record
6. Update local state in-place with canonical IDs (NO `setInitializedForPhase(null)` — avoids race condition with TanStack Query cache invalidation)
7. Show "Saved at [time]" badge, clear dirty flag
