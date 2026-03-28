import assert from "node:assert/strict";
import test from "node:test";
import { buildReadinessSummaryCards } from "../client/src/lib/readinessSummary";

test("readiness summary cards use latest values with contextual comparison", () => {
  const cards = buildReadinessSummaryCards({
    weeklyTrendData: [
      { recoveryThisTrainingWeek: 3, stressOutsideTrainingThisWeek: 2 },
      { recoveryThisTrainingWeek: 3, stressOutsideTrainingThisWeek: 2 },
      { recoveryThisTrainingWeek: 5, stressOutsideTrainingThisWeek: 4 },
    ],
    sessionTrendData: [{ rpeOverall: 5 }, { rpeOverall: 6 }, { rpeOverall: 8 }],
  });

  const recoveryCard = cards.find((card) => card.key === "recovery");
  const stressCard = cards.find((card) => card.key === "stress");
  const effortCard = cards.find((card) => card.key === "effort");

  assert.equal(recoveryCard?.primary, "This week: 5/5");
  assert.equal(recoveryCard?.secondary, "Above your recent average");
  assert.equal(stressCard?.primary, "This week: 4/5");
  assert.equal(stressCard?.secondary, "Above your recent average");
  assert.equal(effortCard?.primary, "Last session: 8/10");
  assert.equal(effortCard?.secondary, "Above your recent average");
});

test("readiness summary cards show in-line comparison when latest values are near baseline", () => {
  const cards = buildReadinessSummaryCards({
    weeklyTrendData: [
      { recoveryThisTrainingWeek: 4, stressOutsideTrainingThisWeek: 2 },
      { recoveryThisTrainingWeek: 4, stressOutsideTrainingThisWeek: 2.2 },
      { recoveryThisTrainingWeek: 4.1, stressOutsideTrainingThisWeek: 2.1 },
    ],
    sessionTrendData: [{ rpeOverall: 7 }, { rpeOverall: 7.2 }, { rpeOverall: 7.1 }],
  });

  const recoveryCard = cards.find((card) => card.key === "recovery");
  const stressCard = cards.find((card) => card.key === "stress");
  const effortCard = cards.find((card) => card.key === "effort");

  assert.equal(recoveryCard?.secondary, "In line with recent weeks");
  assert.equal(stressCard?.secondary, "In line with recent weeks");
  assert.equal(effortCard?.secondary, "In line with recent sessions");
});

test("readiness summary cards fall back cleanly when data is sparse", () => {
  const cards = buildReadinessSummaryCards({
    weeklyTrendData: [{ recoveryThisTrainingWeek: 4 }],
    sessionTrendData: [],
  });

  const recoveryCard = cards.find((card) => card.key === "recovery");
  const stressCard = cards.find((card) => card.key === "stress");
  const effortCard = cards.find((card) => card.key === "effort");

  assert.equal(recoveryCard?.primary, "This week: 4/5");
  assert.equal(recoveryCard?.secondary, "No recent trend yet");
  assert.equal(stressCard?.primary, "This week: —/5");
  assert.equal(stressCard?.secondary, "No data yet");
  assert.equal(effortCard?.primary, "Last session: —/10");
  assert.equal(effortCard?.secondary, "No data yet");
});
