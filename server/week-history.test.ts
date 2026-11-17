import test from "node:test";
import assert from "node:assert/strict";
import { buildWeekHistory } from "../client/src/lib/weekHistory";

const schedule = [1, 2, 3].flatMap((week) => [
  { week, day: "Monday", slot: "AM", sessionId: "a" },
  { week, day: "Tuesday", slot: "AM", sessionId: "b" },
]);

test("weeks are listed newest first with sessions, recap and average effort", () => {
  const history = buildWeekHistory({
    phaseId: "p1",
    durationWeeks: 3,
    schedule,
    completedInstances: ["w1_Monday_AM_a", "w1_Tuesday_AM_b", "w2_Monday_AM_a"],
    phaseSessionIds: ["a", "b"],
    weeklyRecaps: [
      { phaseId: "p1", phaseWeekNumber: 1, submittedAt: "2026-11-08T10:00:00Z", sleepWeek: 4, energyWeek: 2 },
      { phaseId: "other", phaseWeekNumber: 2, submittedAt: "2026-11-09T10:00:00Z", sleepWeek: 1, energyWeek: 5 },
    ],
    sessionRecaps: [
      { sessionId: "a", submittedAt: "2026-11-03T10:00:00Z", rpeOverall: 6 },
      { sessionId: "b", submittedAt: "2026-11-05T10:00:00Z", rpeOverall: 8 },
      { sessionId: "a", submittedAt: "2026-11-10T10:00:00Z", rpeOverall: 5 },
      { sessionId: "zzz", submittedAt: "2026-11-10T11:00:00Z", rpeOverall: 10 },
    ],
    currentWeek: 2,
  });
  assert.equal(history.length, 2);
  const [week2, week1] = history;
  assert.equal(week2.week, 2);
  assert.equal(week2.isCurrent, true);
  assert.equal(week2.recap, null);
  assert.equal(week2.completedCount, 1);
  assert.equal(week2.averageEffort, 5);
  assert.equal(week1.week, 1);
  assert.equal(week1.isCurrent, false);
  assert.deepEqual(week1.recap, { recovery: 4, stress: 2, painAffected: false });
  assert.equal(week1.completedCount, 2);
  assert.equal(week1.averageEffort, 7);
  assert.equal(week1.sessionRecapCount, 2);
});

test("a fresh phase shows only the current week", () => {
  const history = buildWeekHistory({
    phaseId: "p1",
    durationWeeks: 3,
    schedule,
    completedInstances: [],
    phaseSessionIds: ["a", "b"],
    weeklyRecaps: [],
    sessionRecaps: [],
    currentWeek: 1,
  });
  assert.equal(history.length, 1);
  assert.equal(history[0].week, 1);
  assert.equal(history[0].averageEffort, null);
});
