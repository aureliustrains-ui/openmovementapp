import assert from "node:assert/strict";
import test from "node:test";
import { mapWeeklyCheckinTrendData } from "../client/src/lib/checkins";

test("weekly trend mapper keeps numeric injury impact and exposes visible injury event markers", () => {
  const mapped = mapWeeklyCheckinTrendData([
    {
      weekStartDate: "2026-03-10",
      recoveryThisTrainingWeek: 4,
      stressOutsideTrainingThisWeek: 2,
      injuryAffectedTraining: true,
      injuryImpact: 3,
    },
    {
      weekStartDate: "2026-03-17",
      recoveryThisTrainingWeek: 3,
      stressOutsideTrainingThisWeek: 2,
      injuryAffectedTraining: true,
      injuryImpact: 0,
    },
    {
      weekStartDate: "2026-03-24",
      recoveryThisTrainingWeek: 5,
      stressOutsideTrainingThisWeek: 1,
      injuryAffectedTraining: false,
      injuryImpact: null,
    },
  ]);

  assert.equal(mapped[0]?.injuryImpact, 3);
  assert.equal(mapped[0]?.injuryImpactEventLevel, 4.6);
  assert.equal(mapped[1]?.injuryImpact, 0);
  assert.equal(mapped[1]?.injuryImpactEventLevel, 4.6);
  assert.equal(mapped[2]?.injuryImpact, null);
  assert.equal(mapped[2]?.injuryImpactEventLevel, null);
});
