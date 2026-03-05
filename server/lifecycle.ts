import type { Server } from "http";
import { logError, logInfo } from "./http/logger";

type GracefulShutdownOptions = {
  server: Server;
  closeDb: () => Promise<void>;
  timeoutMs: number;
};

export function installGracefulShutdown(options: GracefulShutdownOptions) {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logInfo("lifecycle", `Received ${signal}, starting graceful shutdown`);

    const timeout = setTimeout(() => {
      logError("lifecycle", "Graceful shutdown timed out; forcing exit", { timeoutMs: options.timeoutMs });
      process.exit(1);
    }, options.timeoutMs);

    options.server.close(async (httpErr) => {
      clearTimeout(timeout);
      if (httpErr) {
        logError("lifecycle", "HTTP server close failed", { error: httpErr.message });
        process.exit(1);
        return;
      }

      try {
        await options.closeDb();
        logInfo("lifecycle", "Shutdown complete");
        process.exit(0);
      } catch (dbErr) {
        const message = dbErr instanceof Error ? dbErr.message : "unknown error";
        logError("lifecycle", "Database shutdown failed", { error: message });
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

