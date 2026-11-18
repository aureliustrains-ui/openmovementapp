// Creates (or resets) a throw-away admin account for local testing.
// Usage: npx tsx scripts/create-test-admin.ts
// Refuses to run against the Railway production host unless ALLOW_PRODUCTION=yes is set.
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getConfig } from "../server/config";
import { db, dbPool } from "../server/db";
import { hashPassword } from "../server/auth";
import { users } from "../shared/schema";

const EMAIL = "test-admin@openmovement.test";

async function main() {
  const url = new URL(getConfig().DATABASE_URL);
  console.log(`Database host: ${url.host}${url.pathname}`);
  if (url.host.includes("rlwy.net") && process.env.ALLOW_PRODUCTION !== "yes") {
    console.error("This looks like the Railway PRODUCTION database. Aborting (set ALLOW_PRODUCTION=yes to override).");
    process.exit(1);
  }
  const password = randomBytes(9).toString("base64url");
  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(users).where(eq(users.email, EMAIL));
  if (existing) {
    await db.update(users).set({ passwordHash, role: "Admin", status: "Active" }).where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values({ name: "Test Admin", email: EMAIL, passwordHash, role: "Admin", status: "Active" });
  }
  console.log(`\nTest admin ready.\n  Email:    ${EMAIL}\n  Password: ${password}\n`);
  await dbPool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
