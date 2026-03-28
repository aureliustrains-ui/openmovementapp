const { randomUUID, randomBytes, scryptSync } = require("node:crypto");
const { Client } = require("pg");
const loadLocalEnv = require("./load-local-env.cjs");

loadLocalEnv();

const PRIMARY_ADMIN_EMAIL =
  process.env.PRIMARY_ADMIN_EMAIL?.trim()?.toLowerCase() || "aureliustrains@gmail.com";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

async function run() {
  const email = PRIMARY_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() || "";

  if (!password) {
    console.log(
      "Skipping admin bootstrap create: BOOTSTRAP_ADMIN_PASSWORD is not set.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : "";
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const name = (process.env.BOOTSTRAP_ADMIN_NAME || "Admin").trim();

  if (password && password.length < 8) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const tableCheck = await client.query("select to_regclass('public.users') as users_table");
    const hasUsersTable = Boolean(tableCheck.rows[0] && tableCheck.rows[0].users_table);
    if (!hasUsersTable) {
      throw new Error("users table not found. Run migrations first (npm run db:push).");
    }

    const existing = await client.query("select id from users where lower(email) = lower($1) limit 1", [
      email,
    ]);

    if (existing.rows.length > 0) {
      if (password) {
        const passwordHash = hashPassword(password);
        await client.query(
          "update users set name = $1, role = 'Admin', status = 'Active', password_hash = $2 where id = $3",
          [name, passwordHash, existing.rows[0].id],
        );
      } else {
        await client.query("update users set role = 'Admin', status = 'Active' where id = $1", [
          existing.rows[0].id,
        ]);
      }
      console.log(`Updated existing user to active admin: ${email}`);
    } else if (password) {
      await client.query(
        "insert into users (id, name, email, password_hash, role, status, avatar) values ($1, $2, $3, $4, 'Admin', 'Active', null)",
        [`admin_${randomUUID()}`, name, email, hashPassword(password)],
      );
      console.log(`Created admin user: ${email}`);
    } else {
      console.log(`Primary admin user ${email} not found and no bootstrap password set.`);
    }

    await client.query(
      "update users set role = 'Client', status = case when status = 'Removed' then 'Removed' else 'Active' end where role = 'Admin' and lower(email) <> lower($1)",
      [email],
    );
    console.log(`Enforced single-admin policy for ${email}`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Bootstrap admin failed: ${message}`);
  process.exit(1);
});
