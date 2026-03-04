# Objective
Fix Save Draft + Publish flow in PhaseBuilder so that: (1) Save Draft reliably persists sessions, schedule, and movement-check gate selection, (2) local state is correctly restored from the DB after save without race conditions, and (3) Publish works immediately after Save Draft without data loss or blocked buttons.

# Tasks

### T001: Fix initialization race condition after save
- **Blocked By**: []
- **Details**:
  - **Root cause**: `handleSave` calls `setInitializedForPhase(null)` which triggers the init `useEffect`. But at that moment, TanStack Query is invalidating caches, so `phaseSessions` is temporarily `[]`, causing the effect to reset `localSessions` to a blank session.
  - **Fix**: Do NOT call `setInitializedForPhase(null)` after save. Instead, after a successful save:
    - For the **new phase** path: navigate to the saved phase URL. The URL change will update `currentPhaseId`, which naturally triggers re-init since `initializedForPhase !== newPhaseId`.
    - For the **existing phase update** path: don't reset at all. The local state already matches what was saved. Just show the toast. If the admin wants to see DB state, they can navigate away and back.
    - To handle the edge case where newly created sessions don't have `dbId` set after save, manually update `localSessions` in place to assign the real DB IDs after the `createSession` calls return. This keeps local state in sync without needing re-init.
  - **Additionally**: In the init `useEffect`, add a guard: only run the existing-phase branch when `phaseSessions.length > 0` OR when the phase has an empty schedule (truly no sessions). Currently `phaseSessions.length === 0` during refetch falsely triggers the blank-session fallback. Fix by checking that the query is not in a loading/fetching state before initializing.
  - Files: `client/src/pages/admin/PhaseBuilder.tsx`
  - Acceptance: After Save Draft, sessions/exercises/schedule remain visible in the builder. No flash of empty state. No stale data.

### T002: Persist movement-check gate selection across save
- **Blocked By**: []
- **Details**:
  - The `movementCheckGate` value ("yes"/"no") is currently local-only state that is lost after save because the init effect infers it from `existingPhase.movementChecks` (which is `[]` for drafts).
  - **Fix**: Store the gate preference in the phase record. Two options:
    - **Option A (simple)**: Save it as a field in the phase's existing JSONB. E.g., when saving the phase, include `movementChecks` as `[{_gateEnabled: true}]` sentinel, or better yet just use the `schedule` or `goal` field convention.
    - **Option B (cleaner)**: Add a `movementCheckGate` boolean/text column to the `phases` schema. This is a schema change though.
    - **Option C (pragmatic, no schema change)**: Keep gate state local but DON'T reset it on save. Since we're fixing Bug 1 to not re-run init after save, the gate will naturally survive. For the init from DB, infer from `existingPhase.status === 'Waiting for Movement Check'` OR `movementChecks.length > 0`. For brand new loads of Draft phases that haven't been published yet, default to `"yes"` (current behavior is fine once Bug 1 is fixed).
  - **Chosen approach**: Option C — fixing Bug 1 (T001) means the gate survives save. For existing phases loaded from DB, the current inference logic at line 174-175 is sufficient.
  - Files: `client/src/pages/admin/PhaseBuilder.tsx`
  - Acceptance: Admin sets gate to "Bypass", saves draft, gate still shows "Bypass". Admin sets gate to "Require video", publishes, phase gets movement checks.

### T003: Fix Publish button disabled state after save
- **Blocked By**: [T001]
- **Details**:
  - **Root cause**: The Publish disabled condition checks `localSessions.every(s => s.sections.every(sec => sec.exercises.length === 0))`. After Bug 1 wipes sessions, this is always true → button blocked.
  - **Fix**: Once T001 is fixed (local state survives save), this is automatically resolved. No additional code change needed for the disabled condition itself.
  - **However**, also fix the Publish flow's internal save call: `handlePublish` currently calls `savePhase()` when `isNew || isDirty`. After T001's fix, `isDirty` will correctly be `false` after a save, so `savePhase()` won't be called unnecessarily. But verify `handlePublish` uses `params?.phaseId` correctly after a new-phase save+redirect (the URL will have changed, so params should have the real ID by the time the user clicks Publish).
  - Files: `client/src/pages/admin/PhaseBuilder.tsx`
  - Acceptance: After Save Draft, Publish button is enabled (assuming exercises exist). Clicking Publish correctly sets status without overwriting sessions.

### T004: Verify end-to-end flow works
- **Blocked By**: [T001, T002, T003]
- **Details**:
  - Test the full flow in the running app:
    1. Admin → Client Profile → Create New Phase
    2. Name it, add exercises, set schedule days, set movement check gate
    3. Click "Save Draft" → verify sessions/schedule/gate persist in the builder
    4. Click "Publish Phase" → verify confirmation dialog shows correct data
    5. Confirm publish → verify phase status changes correctly
    6. Impersonate client → verify phase shows in MyPhase with correct days
  - Restart the workflow after code changes to verify
  - Files: `client/src/pages/admin/PhaseBuilder.tsx`
  - Acceptance: Full flow works without data loss at any step
