import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";
import { getConfig } from "./config";

const config = getConfig();

export const dbPool = new Pool({
  connectionString: config.DATABASE_URL,
});

export const db = drizzle(dbPool, { schema });
