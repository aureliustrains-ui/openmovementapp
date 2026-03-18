import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const adminProfilePath = path.resolve(serverDir, "../client/src/pages/admin/ClientProfile.tsx");
const clientHomePath = path.resolve(serverDir, "../client/src/pages/client/Home.tsx");
const checkinsLibPath = path.resolve(serverDir, "../client/src/lib/checkins.ts");

test("admin and client readiness charts use the same trends endpoint contract", () => {
  const adminSource = fs.readFileSync(adminProfilePath, "utf8");
  const clientSource = fs.readFileSync(clientHomePath, "utf8");

  assert.ok(
    adminSource.includes('clientCheckinsTrendsQuery(clientId || "", checkinsRange)'),
    "Admin should query trends by client id + selected range",
  );
  assert.ok(
    clientSource.includes('clientCheckinsTrendsQuery(viewedUser?.id || "", checkinsRange)'),
    "Client home should query trends by viewed client id + selected range",
  );
  assert.equal(
    clientSource.includes('clientCheckinsTrendsQuery(viewedUser?.id || "", "all")'),
    false,
    "Client home must not use a divergent hardcoded trends range",
  );
});

test("client readiness uses shared checkins mappers and chart keys expected by admin trends payload", () => {
  const clientSource = fs.readFileSync(clientHomePath, "utf8");

  assert.ok(clientSource.includes("mapSessionCheckinTrendData"));
  assert.ok(clientSource.includes("mapWeeklyCheckinTrendData"));
  assert.ok(clientSource.includes("LineChart data={sessionCheckinTrendData}"));
  assert.ok(clientSource.includes('dataKey="rpeOverall"'));
  assert.ok(clientSource.includes('dataKey="sleepLastNightScaled"'));
  assert.ok(clientSource.includes("LineChart data={weeklyCheckinTrendData}"));
  assert.ok(clientSource.includes('dataKey="recoveryThisTrainingWeek"'));
  assert.ok(clientSource.includes('dataKey="stressOutsideTrainingThisWeek"'));
  assert.ok(clientSource.includes('dataKey="injuryImpact"'));
});

test("client readiness empty state is only shown when transformed trends arrays are empty", () => {
  const clientSource = fs.readFileSync(clientHomePath, "utf8");

  assert.ok(
    clientSource.includes("const hasAnyTrendData = hasAnySessionTrendData || hasAnyWeeklyTrendData;"),
  );
  assert.ok(
    clientSource.includes(") : !hasAnyTrendData ? ("),
    "Readiness should not render the empty state when trends arrays are non-empty",
  );
});

test("checkins trend mappers normalize numeric fields for chart rendering", () => {
  const checkinsSource = fs.readFileSync(checkinsLibPath, "utf8");

  assert.ok(checkinsSource.includes("function toFiniteNumber(value: unknown): number | null"));
  assert.ok(
    checkinsSource.includes("rpeOverall: toFiniteNumber((entry as any).rpeOverall ?? (entry as any).sessionRpe)"),
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
});
