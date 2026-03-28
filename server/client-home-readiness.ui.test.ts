import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const adminProfilePath = path.resolve(serverDir, "../client/src/pages/admin/ClientProfile.tsx");
const clientHomePath = path.resolve(serverDir, "../client/src/pages/client/Home.tsx");
const clientReadinessPath = path.resolve(serverDir, "../client/src/pages/client/Readiness.tsx");
const clientReadinessSectionPath = path.resolve(
  serverDir,
  "../client/src/components/client/ClientReadinessSection.tsx",
);
const checkinsLibPath = path.resolve(serverDir, "../client/src/lib/checkins.ts");

test("admin and client readiness charts use the same trends endpoint contract", () => {
  const adminSource = fs.readFileSync(adminProfilePath, "utf8");
  const readinessSectionSource = fs.readFileSync(clientReadinessSectionPath, "utf8");

  assert.ok(
    adminSource.includes('clientCheckinsTrendsQuery(clientId || "", checkinsRange)'),
    "Admin should query trends by client id + selected range",
  );
  assert.ok(
    readinessSectionSource.includes("clientCheckinsTrendsQuery(clientId, checkinsRange)"),
    "Client readiness section should query trends by viewed client id + selected range",
  );
  assert.equal(
    readinessSectionSource.includes('clientCheckinsTrendsQuery(clientId, "all")'),
    false,
    "Client readiness must not use a divergent hardcoded trends range",
  );
});

test("client readiness uses shared checkins mappers and chart keys expected by admin trends payload", () => {
  const readinessSectionSource = fs.readFileSync(clientReadinessSectionPath, "utf8");

  assert.ok(readinessSectionSource.includes("mapSessionCheckinTrendData"));
  assert.ok(readinessSectionSource.includes("mapWeeklyCheckinTrendData"));
  assert.ok(readinessSectionSource.includes("ComposedChart data={sessionCheckinTrendData}"));
  assert.ok(readinessSectionSource.includes('dataKey="rpeOverall"'));
  assert.ok(readinessSectionSource.includes('dataKey="sleepLastNight"'));
  assert.ok(readinessSectionSource.includes('dataKey="feltOffEventLevel"'));
  assert.ok(readinessSectionSource.includes("ComposedChart data={weeklyCheckinTrendData}"));
  assert.ok(readinessSectionSource.includes('dataKey="recoveryThisTrainingWeek"'));
  assert.ok(readinessSectionSource.includes('dataKey="stressOutsideTrainingThisWeek"'));
  assert.ok(readinessSectionSource.includes('dataKey="injuryImpact"'));
  assert.ok(readinessSectionSource.includes('dataKey="injuryImpactEventLevel"'));
});

test("felt-off and injury-affected events are rendered visually in admin and client readiness charts", () => {
  const adminSource = fs.readFileSync(adminProfilePath, "utf8");
  const readinessSectionSource = fs.readFileSync(clientReadinessSectionPath, "utf8");

  assert.ok(
    adminSource.includes('dataKey="feltOffEventLevel"'),
    "Admin trend explorer should render felt-off event markers",
  );
  assert.ok(
    adminSource.includes('name="Felt off events"') && adminSource.includes('stroke="transparent"'),
    "Admin felt-off events should be rendered as visible marker-only series",
  );
  assert.ok(
    adminSource.includes('dataKey="injuryImpactEventLevel"'),
    "Admin trend explorer should render injury-affected week markers",
  );
  assert.ok(
    adminSource.includes('name="Pain/injury events"') && adminSource.includes("<Scatter"),
    "Admin injury-affected weeks should be rendered as visible marker scatter series",
  );
  assert.ok(
    readinessSectionSource.includes('dataKey="feltOffEventLevel"'),
    "Client readiness should render felt-off event markers",
  );
  assert.ok(
    readinessSectionSource.includes('name="Felt off events"') &&
      readinessSectionSource.includes('stroke="transparent"'),
    "Client readiness should render felt-off event markers visibly",
  );
  assert.ok(
    readinessSectionSource.includes("What felt off:"),
    "Client readiness tooltip should include felt-off note detail text when available",
  );
  assert.ok(
    readinessSectionSource.includes('dataKey="injuryImpactEventLevel"'),
    "Client readiness should render injury-affected week markers",
  );
  assert.ok(
    readinessSectionSource.includes('name="Pain/injury events"') &&
      readinessSectionSource.includes("<Scatter"),
    "Client readiness should render injury-affected week markers visibly",
  );
  assert.ok(
    adminSource.includes("What felt off:"),
    "Admin trend explorer tooltip should include felt-off note detail text when available",
  );
  assert.ok(
    adminSource.includes('dataKey="injuryImpact"') &&
      readinessSectionSource.includes('dataKey="injuryImpact"'),
    "Both admin and client readiness charts should plot numeric injury impact values",
  );
});

test("checkins trend mappers normalize numeric fields for chart rendering", () => {
  const checkinsSource = fs.readFileSync(checkinsLibPath, "utf8");

  assert.ok(checkinsSource.includes("function toFiniteNumber(value: unknown): number | null"));
  assert.ok(
    checkinsSource.includes(
      "rpeOverall: toFiniteNumber((entry as any).rpeOverall ?? (entry as any).sessionRpe)",
    ),
  );
  assert.ok(
    checkinsSource.includes("sleepLastNight: toFiniteNumber((entry as any).sleepLastNight)"),
  );
  assert.ok(
    checkinsSource.includes(
      "recoveryThisTrainingWeek: toFiniteNumber(\n      (entry as any).recoveryThisTrainingWeek ?? (entry as any).sleepWeek,",
    ),
  );
  assert.ok(
    checkinsSource.includes(
      "stressOutsideTrainingThisWeek: toFiniteNumber(\n      (entry as any).stressOutsideTrainingThisWeek ?? (entry as any).energyWeek,",
    ),
  );
  assert.ok(checkinsSource.includes("feltOffEventLevel: entry.feltOff ? 9.6 : null"));
  assert.ok(
    checkinsSource.includes(
      "injuryImpactEventLevel:\n      (entry as any).injuryAffectedTraining === true ||",
    ),
  );
});

test("client readiness full page reuses shared readiness section and includes recent check-ins", () => {
  const homeSource = fs.readFileSync(clientHomePath, "utf8");
  const readinessPageSource = fs.readFileSync(clientReadinessPath, "utf8");
  const readinessSectionSource = fs.readFileSync(clientReadinessSectionPath, "utf8");

  assert.ok(
    homeSource.includes("<ClientReadinessSection />"),
    "Home should keep the readiness preview section",
  );
  assert.ok(
    readinessPageSource.includes("<ClientReadinessSection showFullDetails />"),
    "Readiness route should open the full readiness view",
  );
  assert.ok(
    readinessSectionSource.includes("clientCheckinsRecentQuery(clientId)"),
    "Full readiness should fetch recent check-ins from the same backend path",
  );
  assert.ok(
    readinessSectionSource.includes("Recent session check-ins"),
    "Full readiness should include recent session check-ins",
  );
  assert.ok(
    readinessSectionSource.includes("Recent weekly check-ins"),
    "Full readiness should include recent weekly check-ins",
  );
});

test("admin and client readiness top cards use contextual current/latest summaries", () => {
  const adminSource = fs.readFileSync(adminProfilePath, "utf8");
  const readinessSectionSource = fs.readFileSync(clientReadinessSectionPath, "utf8");

  assert.ok(
    adminSource.includes("buildReadinessSummaryCards"),
    "Admin readiness should use shared contextual summary card logic",
  );
  assert.ok(
    readinessSectionSource.includes("buildReadinessSummaryCards"),
    "Client readiness should use shared contextual summary card logic",
  );
  assert.ok(
    adminSource.includes("{card.primary}") && adminSource.includes("{card.secondary}"),
    "Admin readiness cards should render helper-provided current/latest context values",
  );
  assert.ok(
    readinessSectionSource.includes("{card.primary}") &&
      readinessSectionSource.includes("{card.secondary}"),
    "Client readiness cards should render helper-provided current/latest context values",
  );
});
