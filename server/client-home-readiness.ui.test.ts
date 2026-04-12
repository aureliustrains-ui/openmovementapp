import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const adminProfilePath = path.resolve(serverDir, "../client/src/pages/admin/ClientProfile.tsx");
const clientHomePath = path.resolve(serverDir, "../client/src/pages/client/Home.tsx");
const clientAppPath = path.resolve(serverDir, "../client/src/App.tsx");
const clientCheckinsPath = path.resolve(serverDir, "../client/src/pages/client/CheckIns.tsx");
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
  assert.ok(readinessSectionSource.includes('dataKey="trendWeekKey"'));
  assert.ok(readinessSectionSource.includes('dataKey="recoveryThisTrainingWeek"'));
  assert.ok(readinessSectionSource.includes('dataKey="stressOutsideTrainingThisWeek"'));
  assert.ok(readinessSectionSource.includes('dataKey="injuryImpact"'));
});

test("admin and client weekly readiness charts use shared training-week x-axis identity key", () => {
  const adminSource = fs.readFileSync(adminProfilePath, "utf8");
  const readinessSectionSource = fs.readFileSync(clientReadinessSectionPath, "utf8");

  assert.ok(
    adminSource.includes('dataKey="trendWeekKey"'),
    "Admin weekly chart should use training-week identity key for x-axis",
  );
  assert.ok(
    readinessSectionSource.includes('dataKey="trendWeekKey"'),
    "Client weekly chart should use training-week identity key for x-axis",
  );
});

test("felt-off markers stay in mixed chart while injury impact renders in dedicated weekly injury charts", () => {
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
    adminSource.includes("What felt off:"),
    "Admin trend explorer tooltip should include felt-off note detail text when available",
  );
  assert.ok(
    adminSource.includes('dataKey="injuryImpact"') &&
      readinessSectionSource.includes('dataKey="injuryImpact"'),
    "Both admin and client readiness charts should plot numeric injury impact values",
  );
  assert.ok(
    adminSource.includes("Weekly injury impact") &&
      readinessSectionSource.includes("Weekly injury impact"),
    "Both admin and client readiness surfaces should include a dedicated weekly injury impact chart section",
  );
  assert.ok(
    readinessSectionSource.includes("showFullDetails && hasInjuryImpactDataInView"),
    "Client readiness should render the dedicated injury chart only in full readiness mode when injury data exists",
  );
  assert.equal(
    adminSource.includes('dataKey="injuryImpactEventLevel"'),
    false,
    "Admin should not use injury event-level scatter overlays in the mixed weekly chart",
  );
  assert.equal(
    readinessSectionSource.includes('dataKey="injuryImpactEventLevel"'),
    false,
    "Client readiness should not use injury event-level scatter overlays in the mixed weekly chart",
  );
  assert.equal(
    readinessSectionSource.includes('onClick={() => toggleWeeklyMetric("injuryImpact")}'),
    false,
    "Client mixed weekly metric controls should no longer include injury impact",
  );
  assert.equal(
    adminSource.includes(
      "setWeeklyMetrics((prev) => ({ ...prev, injuryImpact: !prev.injuryImpact }))",
    ),
    false,
    "Admin mixed weekly metric controls should no longer include injury impact",
  );
  assert.equal(
    readinessSectionSource.includes("No weekly injury impact entries yet."),
    false,
    "Client readiness should hide the dedicated injury chart entirely when there is no injury data",
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
  assert.ok(checkinsSource.includes("recoveryThisTrainingWeek: toFiniteNumber("));
  assert.ok(
    checkinsSource.includes("(entry as any).recoveryThisTrainingWeek ?? (entry as any).sleepWeek"),
  );
  assert.ok(checkinsSource.includes("stressOutsideTrainingThisWeek: toFiniteNumber("));
  assert.ok(
    checkinsSource.includes(
      "(entry as any).stressOutsideTrainingThisWeek ?? (entry as any).energyWeek",
    ),
  );
  assert.ok(checkinsSource.includes("feltOffEventLevel: entry.feltOff ? 9.6 : null"));
  assert.equal(
    checkinsSource.includes("injuryImpactEventLevel"),
    false,
    "Weekly mapper should keep injury impact as a normal weekly metric without synthetic event levels",
  );
  assert.ok(checkinsSource.includes("trendWeekKey"));
  assert.ok(checkinsSource.includes("trendWeekLabel"));
});

test("client check-ins route reuses shared readiness section while home stays action-focused", () => {
  const homeSource = fs.readFileSync(clientHomePath, "utf8");
  const appSource = fs.readFileSync(clientAppPath, "utf8");
  const checkinsSource = fs.readFileSync(clientCheckinsPath, "utf8");
  const readinessPageSource = fs.readFileSync(clientReadinessPath, "utf8");
  const readinessSectionSource = fs.readFileSync(clientReadinessSectionPath, "utf8");

  assert.equal(homeSource.includes("<ClientReadinessSection"), false);
  assert.equal(
    homeSource.includes("<ClientReadinessSection showFullDetails />"),
    false,
    "Home should stay focused on next actions instead of embedding readiness charts",
  );
  assert.ok(
    appSource.includes('return <Redirect to="/app/client/check-ins" />'),
    "Legacy readiness route should redirect to the new check-ins destination",
  );
  assert.ok(
    checkinsSource.includes("<ClientReadinessSection compactForCheckins />"),
    "Check-ins should host the compact trends-focused readiness section",
  );
  assert.ok(
    readinessPageSource.includes("<ClientReadinessSection showFullDetails />"),
    "Legacy readiness page should remain full-details if routed directly",
  );
  assert.ok(
    readinessSectionSource.includes("clientCheckinsRecentQuery(clientId)"),
    "Full readiness should fetch recent check-ins from the shared backend path",
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
