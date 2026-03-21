import type { Request, Response } from "express";

type HealthDeps = {
  startedAt: number;
  checkReadiness: () => Promise<void>;
};

function buildPayload(status: "ok" | "degraded", startedAt: number) {
  return {
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  };
}

export function createHealthHandlers(deps: HealthDeps) {
  return {
    liveness(_req: Request, res: Response) {
      res.status(200).json(buildPayload("ok", deps.startedAt));
    },
    async readiness(_req: Request, res: Response) {
      try {
        await deps.checkReadiness();
        res.status(200).json(buildPayload("ok", deps.startedAt));
      } catch {
        res.status(503).json(buildPayload("degraded", deps.startedAt));
      }
    },
  };
}
