import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "../server/auth";
import { db } from "../server/db";
import { users } from "../shared/schema";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function run() {
  const email = getRequiredEnv("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const password = getRequiredEnv("BOOTSTRAP_ADMIN_PASSWORD");
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Admin";

  if (password.length < 8) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters");
  }

  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(users).where(eq(users.email, email));

  if (existing) {
    await db
      .update(users)
      .set({
        name,
        role: "Admin",
        status: "Active",
        passwordHash,
      })
      .where(eq(users.id, existing.id));

    console.log(`Updated existing user to active admin: ${email}`);
    return;
  }

  await db.insert(users).values({
    id: `admin_${randomUUID()}`,
    name,
    email,
    passwordHash,
    role: "Admin",
    status: "Active",
    avatar: null,
  });

  console.log(`Created admin user: ${email}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Bootstrap admin failed: ${message}`);
  process.exit(1);
});
