const { randomUUID, randomBytes, scryptSync } = require("node:crypto");
const { Client } = require("pg");

function getRequiredEnv(name) {
  const value = process.env[name] ? process.env[name].trim() : "";
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

async function run() {
  const databaseUrl = getRequiredEnv("DATABASE_URL");
  const email = getRequiredEnv("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const password = getRequiredEnv("BOOTSTRAP_ADMIN_PASSWORD");
  const name = (process.env.BOOTSTRAP_ADMIN_NAME || "Admin").trim();

  if (password.length < 8) {
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

    const passwordHash = hashPassword(password);
    const existing = await client.query("select id from users where lower(email) = lower($1) limit 1", [
      email,
    ]);

    if (existing.rows.length > 0) {
      await client.query(
        "update users set name = $1, role = 'Admin', status = 'Active', password_hash = $2 where id = $3",
        [name, passwordHash, existing.rows[0].id],
      );
      console.log(`Updated existing user to active admin: ${email}`);
      return;
    }

    await client.query(
      "insert into users (id, name, email, password_hash, role, status, avatar) values ($1, $2, $3, $4, 'Admin', 'Active', null)",
      [`admin_${randomUUID()}`, name, email, passwordHash],
    );
    console.log(`Created admin user: ${email}`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Bootstrap admin failed: ${message}`);
  process.exit(1);
});
