import type { NextFunction, Request, Response } from "express";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getRequestHost(req: Request): string | undefined {
  const forwardedHost = req.get("x-forwarded-host");
  if (forwardedHost) {
    return forwardedHost.split(",")[0]?.trim().toLowerCase();
  }
  return req.get("host")?.toLowerCase();
}

function getOriginHost(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

export function enforceSameOriginForApi(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api")) {
    return next();
  }

  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  const origin = req.get("origin");
  if (!origin) {
    return next();
  }

  const requestHost = getRequestHost(req);
  const originHost = getOriginHost(origin);
  if (!requestHost || !originHost || requestHost !== originHost) {
    return res.status(403).json({ message: "Forbidden origin" });
  }

  next();
}

