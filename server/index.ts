import express from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { getConfig } from "./config";
import { errorHandler } from "./http/error-handler";
import { logError, logInfo } from "./http/logger";
import { enforceSameOriginForApi } from "./http/csrf";
import { createRateLimitMiddleware } from "./http/rate-limit";
import { createHealthHandlers } from "./http/health";
import { installGracefulShutdown } from "./lifecycle";

const app = express();
const httpServer = createServer(app);
const config = getConfig();
const isProductionBuild = process.env.NODE_ENV === "production";

async function loadDevViteModule() {
  const viteModulePath = "./vite";
  return import(viteModulePath);
}

function formatStartupError(error: unknown) {
  if (error instanceof Error) {
    const details = error as Error & { code?: unknown };
    return {
      message: error.message,
      code: typeof details.code === "string" ? details.code : undefined,
    };
  }
  return { message: String(error) };
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

if (config.NODE_ENV === "development") {
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      if (req.method.toUpperCase() === "OPTIONS") {
        return res.status(204).end();
      }
    }
    next();
  });
}

app.use(enforceSameOriginForApi);

const PgSession = connectPgSimple(session);
const dbPool = new Pool({ connectionString: config.DATABASE_URL });
const startedAt = Date.now();
const healthHandlers = createHealthHandlers({
  startedAt,
  checkReadiness: async () => {
    await dbPool.query("select 1");
  },
});

app.get("/healthz", healthHandlers.liveness);
app.get("/readyz", healthHandlers.readiness);

app.use(
  session({
    store: new PgSession({
      pool: dbPool,
      createTableIfMissing: true,
    }),
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  }),
);

const authRateLimit = createRateLimitMiddleware({
  key: "auth",
  windowMs: 15 * 60 * 1000,
  max: 15,
});
app.use("/api/auth/login", authRateLimit);
app.use("/api/auth/register", authRateLimit);

export function log(message: string, source = "express") {
  logInfo(source, message);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logInfo("http", "request", {
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: duration,
      });
    }
  });

  next();
});

httpServer.on("error", (error) => {
  logError("startup", "HTTP server failed to listen", formatStartupError(error));
  process.exit(1);
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use("/api/{*path}", (_req, res) => {
    res.status(404).json({ message: "API route not found" });
  });

  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (isProductionBuild) {
    serveStatic(app);
  } else {
    const { setupVite } = await loadDevViteModule();
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = config.PORT;
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  installGracefulShutdown({
    server: httpServer,
    closeDb: async () => dbPool.end(),
    timeoutMs: config.SHUTDOWN_TIMEOUT_MS,
  });
})().catch((error) => {
  logError("startup", "Failed to start server", formatStartupError(error));
  process.exit(1);
});
