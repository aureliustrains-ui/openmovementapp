import test from "node:test";
import assert from "node:assert/strict";
import { ADDITIVE_SCHEMA_UPGRADES, applyAdditiveSchemaUpgrades } from "./schema-upgrades";

test("startup schema upgrades are additive and idempotent only", () => {
  for (const upgrade of ADDITIVE_SCHEMA_UPGRADES) {
    assert.match(upgrade.sql, /^ALTER TABLE \w+ ADD COLUMN IF NOT EXISTS /);
    assert.doesNotMatch(upgrade.sql, /\b(DROP|RENAME|DELETE|UPDATE|TRUNCATE)\b/i);
  }
});

test("one failing upgrade does not stop the others", async () => {
  const seen: string[] = [];
  const pool = {
    query: async (sql: string) => {
      seen.push(sql);
      if (sql.includes("keywords")) throw new Error("boom");
      return {} as any;
    },
  };
  const result = await applyAdditiveSchemaUpgrades(pool as any);
  assert.equal(seen.length, ADDITIVE_SCHEMA_UPGRADES.length);
  assert.deepEqual(result.failed, ["exercise_templates.keywords"]);
  assert.equal(result.applied.length, ADDITIVE_SCHEMA_UPGRADES.length - 1);
});
