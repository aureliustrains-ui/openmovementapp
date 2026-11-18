import test from "node:test";
import assert from "node:assert/strict";
import {
  ADDITIVE_SCHEMA_UPGRADES,
  ADDITIVE_TABLE_UPGRADES,
  CONTACTS_SYNC_SQL,
  applyAdditiveSchemaUpgrades,
} from "./schema-upgrades";

test("startup schema upgrades are additive and idempotent only", () => {
  for (const upgrade of ADDITIVE_SCHEMA_UPGRADES) {
    assert.match(upgrade.sql, /^ALTER TABLE \w+ ADD COLUMN IF NOT EXISTS /);
    assert.doesNotMatch(upgrade.sql, /\b(DROP|RENAME|DELETE|UPDATE|TRUNCATE)\b/i);
  }
});

test("new tables are created only if missing and the contacts sync never deletes", () => {
  for (const upgrade of ADDITIVE_TABLE_UPGRADES) {
    assert.match(upgrade.sql, /^CREATE TABLE IF NOT EXISTS /);
    assert.doesNotMatch(upgrade.sql, /\b(DROP|RENAME|DELETE|TRUNCATE)\b/i);
  }
  assert.match(CONTACTS_SYNC_SQL, /^INSERT INTO contacts/);
  assert.doesNotMatch(CONTACTS_SYNC_SQL, /\b(DROP|DELETE|TRUNCATE)\b/i);
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
  assert.equal(seen.length, ADDITIVE_SCHEMA_UPGRADES.length + ADDITIVE_TABLE_UPGRADES.length + 1);
  assert.deepEqual(result.failed, ["exercise_templates.keywords"]);
  assert.equal(
    result.applied.length,
    ADDITIVE_SCHEMA_UPGRADES.length + ADDITIVE_TABLE_UPGRADES.length - 1,
  );
});
