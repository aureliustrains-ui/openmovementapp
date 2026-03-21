import type { NextFunction, Request, Response } from "express";

type Entry = {
  count: number;
  windowStart: number;
};

type RateLimitOptions = {
  key: string;
  windowMs: number;
  max: number;
};

const counters = new Map<string, Entry>();

function getClientIp(req: Request): string {
  const forwardedFor = req.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return req.ip || "unknown";
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const counterKey = `${options.key}:${getClientIp(req)}`;
    const current = counters.get(counterKey);

    if (!current || now - current.windowStart >= options.windowMs) {
      counters.set(counterKey, { count: 1, windowStart: now });
      return next();
    }

    if (current.count >= options.max) {
      const retryAfterSeconds = Math.ceil((options.windowMs - (now - current.windowStart)) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSeconds, 1)));
      return res.status(429).json({ message: "Too many requests" });
    }

    current.count += 1;
    counters.set(counterKey, current);
    next();
  };
}

export function clearRateLimitState() {
  counters.clear();
}
