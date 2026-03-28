import { defineConfig } from "drizzle-kit";
import loadLocalEnv from "./script/load-local-env.cjs";

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Migration files live here when generated. Current release flow uses `npm run db:push`
  // unless versioned migrations are explicitly generated and committed.
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
