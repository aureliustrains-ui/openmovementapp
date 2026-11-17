import type { Pool } from "pg";

/**
 * Small, additive schema upgrades that run on server start, so a deploy does not need a
 * manual `db:push` first. Every statement must be idempotent (IF NOT EXISTS) and must only
 * ADD things: never drop, rename or rewrite data here. Anything else still goes through
 * `npm run db:push`.
 */
export const ADDITIVE_SCHEMA_UPGRADES: ReadonlyArray<{ name: string; sql: string }> = [
  {
    name: "exercise_templates.facets",
    sql: `ALTER TABLE exercise_templates ADD COLUMN IF NOT EXISTS facets jsonb NOT NULL DEFAULT '{}'::jsonb`,
  },
  {
    name: "exercise_templates.keywords",
    sql: `ALTER TABLE exercise_templates ADD COLUMN IF NOT EXISTS keywords jsonb NOT NULL DEFAULT '[]'::jsonb`,
  },
  {
    name: "exercise_templates.needs_video",
    sql: `ALTER TABLE exercise_templates ADD COLUMN IF NOT EXISTS needs_video boolean NOT NULL DEFAULT false`,
  },
];

export async function applyAdditiveSchemaUpgrades(
  pool: Pick<Pool, "query">,
  log: (message: string, meta?: Record<string, unknown>) => void = () => {},
): Promise<{ applied: string[]; failed: string[] }> {
  const applied: string[] = [];
  const failed: string[] = [];
  for (const upgrade of ADDITIVE_SCHEMA_UPGRADES) {
    try {
      await pool.query(upgrade.sql);
      applied.push(upgrade.name);
    } catch (error) {
      failed.push(upgrade.name);
      log("schema upgrade failed", {
        upgrade: upgrade.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { applied, failed };
}
