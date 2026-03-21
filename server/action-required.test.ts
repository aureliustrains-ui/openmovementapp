import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActionRequiredItems,
  pickLatestProgressReportForPhase,
} from "../client/src/lib/actionRequired";

test("Action Required includes weekly check-in when due", () => {
  const items = buildActionRequiredItems({
    weeklyDue: true,
    weeklyWeekNumber: 2,
    progressReport: null,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "weekly_checkin");
});

test("Action Required includes progress report when active phase report exists", () => {
  const items = buildActionRequiredItems({
    weeklyDue: false,
    weeklyWeekNumber: 2,
    progressReport: {
      id: "pr_1",
      phaseId: "phase_1",
      status: "requested",
      createdAt: "2026-03-08T10:00:00.000Z",
    },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "progress_report");
});

test("Action Required hides weekly check-in after submission for that week", () => {
  const items = buildActionRequiredItems({
    weeklyDue: false,
    weeklyWeekNumber: 2,
    progressReport: null,
  });
  assert.equal(
    items.some((item) => item.kind === "weekly_checkin"),
    false,
  );
});

test("Action Required hides progress report after client submission", () => {
  const items = buildActionRequiredItems({
    weeklyDue: false,
    weeklyWeekNumber: 2,
    progressReport: {
      id: "pr_submitted",
      phaseId: "phase_1",
      status: "submitted",
      createdAt: "2026-03-08T12:00:00.000Z",
    },
  });
  assert.equal(items.length, 0);
});

test("Action Required hides approved progress reports", () => {
  const items = buildActionRequiredItems({
    weeklyDue: false,
    weeklyWeekNumber: 2,
    progressReport: {
      id: "pr_approved",
      phaseId: "phase_1",
      status: "approved",
      createdAt: "2026-03-08T12:00:00.000Z",
    },
  });
  assert.equal(items.length, 0);
});

test("Action Required returns no items when weekly and progress tasks are absent", () => {
  const items = buildActionRequiredItems({
    weeklyDue: false,
    weeklyWeekNumber: null,
    progressReport: null,
  });
  assert.deepEqual(items, []);
});

test("pickLatestProgressReportForPhase returns newest report for the active phase", () => {
  const report = pickLatestProgressReportForPhase(
    [
      {
        id: "pr_old",
        phaseId: "phase_1",
        status: "requested",
        createdAt: "2026-03-08T08:00:00.000Z",
      },
      {
        id: "pr_latest",
        phaseId: "phase_1",
        status: "submitted",
        createdAt: "2026-03-08T09:00:00.000Z",
      },
      {
        id: "pr_other_phase",
        phaseId: "phase_2",
        status: "requested",
        createdAt: "2026-03-08T10:00:00.000Z",
      },
    ],
    "phase_1",
  );
  assert.ok(report);
  assert.equal(report?.id, "pr_latest");
});
