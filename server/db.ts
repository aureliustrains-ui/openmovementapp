import { drizzle } from "drizzle-orm/neon-serverless";
import { WebSocket as NodeWebSocket } from "ws";
import * as schema from "@shared/schema";
import { getConfig } from "./config";

const config = getConfig();

export const db = drizzle({
  connection: config.DATABASE_URL,
  schema,
  ws: NodeWebSocket,
});
