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
  {
    name: "exercise_templates.where_to_start",
    sql: `ALTER TABLE exercise_templates ADD COLUMN IF NOT EXISTS where_to_start text`,
  },
  {
    name: "exercise_templates.reps_mode",
    sql: `ALTER TABLE exercise_templates ADD COLUMN IF NOT EXISTS reps_mode text`,
  },
  {
    name: "exercise_templates.quality_points",
    sql: `ALTER TABLE exercise_templates ADD COLUMN IF NOT EXISTS quality_points text`,
  },
  {
    name: "progress_reports.blocks_training",
    sql: `ALTER TABLE progress_reports ADD COLUMN IF NOT EXISTS blocks_training boolean NOT NULL DEFAULT false`,
  },
  {
    name: "progress_reports.stage",
    sql: `ALTER TABLE progress_reports ADD COLUMN IF NOT EXISTS stage text`,
  },
  {
    name: "progress_report_items.reported_load",
    sql: `ALTER TABLE progress_report_items ADD COLUMN IF NOT EXISTS reported_load text`,
  },
  {
    name: "progress_report_items.reported_reps",
    sql: `ALTER TABLE progress_report_items ADD COLUMN IF NOT EXISTS reported_reps text`,
  },
  {
    name: "progress_report_items.quality_rating",
    sql: `ALTER TABLE progress_report_items ADD COLUMN IF NOT EXISTS quality_rating integer`,
  },
];

/** New tables, created only if missing. */
export const ADDITIVE_TABLE_UPGRADES: ReadonlyArray<{ name: string; sql: string }> = [
  {
    name: "contacts",
    sql: `CREATE TABLE IF NOT EXISTS contacts (
      email text PRIMARY KEY,
      name text,
      role text,
      status text,
      first_seen_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
  },
];

/** Copies every account into `contacts`. Existing contacts are updated, never removed. */
export const CONTACTS_SYNC_SQL = `INSERT INTO contacts (email, name, role, status)
  SELECT lower(trim(email)), name, role, status FROM users
  WHERE email IS NOT NULL AND trim(email) <> ''
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status, updated_at = now()`;

export async function syncContactsFromUsers(pool: Pick<Pool, "query">): Promise<void> {
  await pool.query(CONTACTS_SYNC_SQL);
}

export async function applyAdditiveSchemaUpgrades(
  pool: Pick<Pool, "query">,
  log: (message: string, meta?: Record<string, unknown>) => void = () => {},
): Promise<{ applied: string[]; failed: string[] }> {
  const applied: string[] = [];
  const failed: string[] = [];
  for (const upgrade of [...ADDITIVE_SCHEMA_UPGRADES, ...ADDITIVE_TABLE_UPGRADES]) {
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
  if (applied.includes("contacts")) {
    try {
      await syncContactsFromUsers(pool);
    } catch (error) {
      failed.push("contacts.sync");
      log("contacts sync failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { applied, failed };
}
