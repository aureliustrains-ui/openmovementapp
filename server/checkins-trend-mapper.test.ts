import assert from "node:assert/strict";
import test from "node:test";
import { mapWeeklyCheckinTrendData } from "../client/src/lib/checkins";

test("weekly trend mapper keeps numeric injury impact as a normal weekly metric", () => {
  const mapped = mapWeeklyCheckinTrendData([
    {
      weekStartDate: "2026-03-10",
      recoveryThisTrainingWeek: 4,
      stressOutsideTrainingThisWeek: 2,
      injuryAffectedTraining: true,
      injuryImpact: 5,
    },
    {
      weekStartDate: "2026-03-17",
      recoveryThisTrainingWeek: 3,
      stressOutsideTrainingThisWeek: 2,
      injuryAffectedTraining: true,
      injuryImpact: 1,
    },
    {
      weekStartDate: "2026-03-24",
      recoveryThisTrainingWeek: 5,
      stressOutsideTrainingThisWeek: 1,
      injuryAffectedTraining: false,
      injuryImpact: null,
    },
  ]);

  assert.equal(mapped[0]?.injuryImpact, 5);
  assert.equal(mapped[1]?.injuryImpact, 1);
  assert.equal(mapped[2]?.injuryImpact, null);
});

test("weekly trend mapper uses training-week identity for x-axis key so same weekStartDate does not collapse points", () => {
  const mapped = mapWeeklyCheckinTrendData([
    {
      id: "wc_1",
      phaseId: "phase_a",
      phaseWeekNumber: 1,
      weekStartDate: "2026-03-16",
      recoveryThisTrainingWeek: 4,
      stressOutsideTrainingThisWeek: 2,
      injuryAffectedTraining: false,
      injuryImpact: null,
    },
    {
      id: "wc_2",
      phaseId: "phase_a",
      phaseWeekNumber: 2,
      weekStartDate: "2026-03-16",
      recoveryThisTrainingWeek: 5,
      stressOutsideTrainingThisWeek: 3,
      injuryAffectedTraining: true,
      injuryImpact: 2,
    },
  ]);

  assert.equal(mapped[0]?.trendWeekLabel, "W1");
  assert.equal(mapped[1]?.trendWeekLabel, "W2");
  assert.notEqual(mapped[0]?.trendWeekKey, mapped[1]?.trendWeekKey);
});
