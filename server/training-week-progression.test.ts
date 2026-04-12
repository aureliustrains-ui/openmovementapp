import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCurrentLifecycleWeek, getTrainingWeekLifecycle } from "../client/src/lib/trainingWeek";

test("when week 1 is completed, week 2 becomes the recommended visible week", () => {
  const lifecycle = getTrainingWeekLifecycle(
    3,
    [
      { week: 1, day: "Monday", slot: "AM", sessionId: "session_1" },
      { week: 2, day: "Monday", slot: "AM", sessionId: "session_2" },
      { week: 2, day: "Wednesday", slot: "AM", sessionId: "session_3" },
    ],
    ["w1_Monday_AM_session_1"],
    "phase_1",
    [{ phaseId: "phase_1", phaseWeekNumber: 1 }],
  );

  assert.equal(lifecycle.weeks[0].state, "completed");
  assert.equal(lifecycle.weeks[1].state, "current");
  assert.equal(lifecycle.currentWeek, 2);
});

test("completed weeks remain explicitly marked as completed in progression status", () => {
  const lifecycle = getTrainingWeekLifecycle(
    4,
    [
      { week: 1, day: "Monday", slot: "AM", sessionId: "session_1" },
      { week: 2, day: "Monday", slot: "AM", sessionId: "session_2" },
      { week: 3, day: "Monday", slot: "AM", sessionId: "session_3" },
    ],
    ["w1_Monday_AM_session_1", "w2_Monday_AM_session_2"],
    "phase_1",
    [
      { phaseId: "phase_1", phaseWeekNumber: 1 },
      { phaseId: "phase_1", phaseWeekNumber: 2 },
    ],
  );

  assert.equal(lifecycle.weeks[0].state, "completed");
  assert.equal(lifecycle.weeks[1].state, "completed");
  assert.equal(lifecycle.weeks[2].state, "current");
});

test("week with all sessions completed but no weekly check-in is ready_for_checkin, not completed", () => {
  const lifecycle = getTrainingWeekLifecycle(
    3,
    [{ week: 1, day: "Monday", slot: "AM", sessionId: "session_1" }],
    ["w1_Monday_AM_session_1"],
    "phase_1",
    [],
  );

  assert.equal(getCurrentLifecycleWeek(lifecycle.weeks), 1);
  assert.equal(lifecycle.weeks[0].state, "ready_for_checkin");
  assert.equal(lifecycle.weeks[0].isCompleted, false);
});

test("zero scheduled sessions never produce ready_for_checkin state", () => {
  const lifecycle = getTrainingWeekLifecycle(2, [], [], "phase_1", []);

  assert.equal(
    lifecycle.weeks.some((week) => week.state === "ready_for_checkin"),
    false,
  );
});

test("incomplete week stays current and not ready_for_checkin", () => {
  const lifecycle = getTrainingWeekLifecycle(
    2,
    [{ week: 1, day: "Monday", slot: "AM", sessionId: "session_1" }],
    [],
    "phase_1",
    [],
  );

  assert.equal(lifecycle.weeks[0].state, "current");
  assert.equal(
    lifecycle.weeks.some((week) => week.state === "ready_for_checkin"),
    false,
  );
});

test("client dashboard renders weekly check-in inside Action Required section", () => {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const homePath = path.resolve(serverDir, "../client/src/pages/client/Home.tsx");
  const myPhasePath = path.resolve(serverDir, "../client/src/pages/client/MyPhase.tsx");
  const homeSource = fs.readFileSync(homePath, "utf8");
  const myPhaseSource = fs.readFileSync(myPhasePath, "utf8");

  assert.ok(
    homeSource.includes('testId="card-home-weekly-checkin"'),
    "Home should include a weekly check-in action card",
  );
  assert.ok(
    myPhaseSource.includes("const weeklyCheckinDue ="),
    "Plan should still compute due-week state for weekly check-in gating",
  );
  assert.equal(
    myPhaseSource.includes('testId="card-home-weekly-checkin"'),
    false,
    "Plan should not duplicate Home action cards",
  );
});

test("week selector keeps all phase weeks visible instead of hiding completed weeks", () => {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const myPhasePath = path.resolve(serverDir, "../client/src/pages/client/MyPhase.tsx");
  const source = fs.readFileSync(myPhasePath, "utf8");

  assert.ok(
    source.includes("Array.from({ length: currentPhase.durationWeeks"),
    "Week selector should render all weeks in phase duration",
  );
  assert.ok(
    source.includes("onClick={() => setSelectedWeek(w)}"),
    "Completed weeks should remain selectable/visible",
  );
  assert.equal(
    source.includes('selectedStatus.state === "completed" && recommendedWeek > selectedWeek'),
    false,
    "Selecting a completed week should not auto-jump away from that week",
  );
});

test("client dashboard keeps selected week synced to the active lifecycle week", () => {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const myPhasePath = path.resolve(serverDir, "../client/src/pages/client/MyPhase.tsx");
  const source = fs.readFileSync(myPhasePath, "utf8");

  assert.ok(
    source.includes("shouldAdvanceWithProgress"),
    "MyPhase should auto-select the lifecycle recommended week when progression advances",
  );
  assert.equal(
    source.includes("selectedWeek !== recommendedWeek"),
    false,
    "MyPhase should not force active week when user manually selects another visible week",
  );
});

test("client dashboard defaults selected phase to active phase with deterministic fallback", () => {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const myPhasePath = path.resolve(serverDir, "../client/src/pages/client/MyPhase.tsx");
  const helperPath = path.resolve(serverDir, "../client/src/lib/clientPhase.ts");
  const myPhaseSource = fs.readFileSync(myPhasePath, "utf8");
  const helperSource = fs.readFileSync(helperPath, "utf8");

  assert.ok(
    myPhaseSource.includes('import { pickDefaultVisiblePhase } from "@/lib/clientPhase";'),
    "MyPhase should import default visible phase logic from shared helper",
  );
  assert.ok(
    helperSource.includes("export function pickDefaultVisiblePhase"),
    "Shared client phase helper should expose deterministic default visible phase selection",
  );
  assert.ok(
    helperSource.includes(
      'const activePhases = phases.filter((phase) => phase.status === "Active");',
    ),
    "Default phase should prioritize active phases",
  );
  assert.ok(
    helperSource.includes("const orderedActivePhases = [...activePhases].sort((a, b) => {"),
    "When multiple phases are active, ordering should be deterministic",
  );
  assert.ok(
    helperSource.includes(
      "parsePhaseStartDateForSort(b.startDate) - parsePhaseStartDateForSort(a.startDate)",
    ),
    "Deterministic active-phase fallback should prefer most recently started phase",
  );
  assert.ok(
    helperSource.includes("return pendingPhase || phases[0];"),
    "When no active phase exists, keep existing safe fallback behavior",
  );
});

test("weekly action visibility uses server due status with lifecycle fallback", () => {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const myPhasePath = path.resolve(serverDir, "../client/src/pages/client/MyPhase.tsx");
  const homePath = path.resolve(serverDir, "../client/src/pages/client/Home.tsx");
  const source = fs.readFileSync(myPhasePath, "utf8");
  const homeSource = fs.readFileSync(homePath, "utf8");

  assert.ok(
    source.includes("weeklyCheckinsCurrentOrDueQuery"),
    "MyPhase should read authoritative weekly due status from the current-or-due endpoint",
  );
  assert.ok(
    source.includes(
      "const recommendedWeek = dueWeek?.week ?? serverPhaseWeek ?? lifecycle.currentWeek;",
    ),
    "Selected week progression should keep due week visible before falling back",
  );
  assert.ok(
    source.includes("const weeklyCheckinDue ="),
    "Weekly action visibility should derive from combined due signals",
  );
  assert.ok(
    source.includes('weekStatuses.find((status) => status.state === "ready_for_checkin") || null'),
    "Lifecycle ready-for-checkin fallback should remain in place",
  );
  assert.ok(
    source.includes("Boolean(dueWeekStatus) ||"),
    "Weekly action visibility should never hide due card when lifecycle marks a due week",
  );
  assert.ok(
    homeSource.includes("const weeklyCheckinDue = Boolean("),
    "Home action cards should derive weekly due state from notification summary",
  );
  assert.ok(
    homeSource.includes('testId="card-home-weekly-checkin"'),
    "Home should expose weekly check-in entry card when due",
  );
});

test("client check-in actions are gated by real session identity and impersonation state", () => {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const myPhasePath = path.resolve(serverDir, "../client/src/pages/client/MyPhase.tsx");
  const sessionViewPath = path.resolve(serverDir, "../client/src/pages/client/SessionView.tsx");
  const myPhaseSource = fs.readFileSync(myPhasePath, "utf8");
  const sessionViewSource = fs.readFileSync(sessionViewPath, "utf8");

  assert.ok(
    myPhaseSource.includes(
      "const isCheckinReadOnly = impersonating || !isClientSession || !isClientContextMatch;",
    ),
    "MyPhase should treat client check-ins as read-only outside a real client session context",
  );
  assert.ok(
    sessionViewSource.includes(
      "const isCheckinReadOnly = impersonating || !isClientSession || !isClientContextMatch;",
    ),
    "SessionView should treat after-session check-ins as read-only outside a real client session context",
  );
});

test("client dashboard keeps core main items rendered in the same conditional flow", () => {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const homePath = path.resolve(serverDir, "../client/src/pages/client/Home.tsx");
  const myPhasePath = path.resolve(serverDir, "../client/src/pages/client/MyPhase.tsx");
  const homeSource = fs.readFileSync(homePath, "utf8");
  const source = fs.readFileSync(myPhasePath, "utf8");

  assert.ok(source.includes('data-testid="card-start-next-session"'));
  assert.ok(source.includes('data-testid="button-start-next-session"'));
  assert.ok(source.includes('data-testid="card-schedule-grid"'));
  assert.ok(source.includes('data-testid="text-week-progress"'));
  assert.ok(homeSource.includes('data-testid="button-home-start-next-session"'));
  assert.ok(homeSource.includes('testId="card-home-weekly-checkin"'));
  assert.ok(homeSource.includes('testId="card-home-progress-update"'));
  assert.ok(homeSource.includes('testId="card-home-movement-check"'));
});

test("week area is compact and non-horizontal-scroll while keeping schedule content", () => {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const myPhasePath = path.resolve(serverDir, "../client/src/pages/client/MyPhase.tsx");
  const source = fs.readFileSync(myPhasePath, "utf8");

  assert.equal(source.includes("Weekly Schedule"), false);
  assert.ok(source.includes("CalendarDays"));
  assert.equal(source.includes("overflow-x-auto"), false);
  assert.equal(source.includes("min-w-[500px]"), false);
  assert.ok(source.includes("data-testid={`sched-session-${day}-${slotVal}-${i}`}"));
});
