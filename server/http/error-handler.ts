import type { NextFunction, Request, Response } from "express";
import { logError } from "./logger";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    logError("http", err.message, { code: err.code, status: err.status });
    return res.status(err.status).json({ message: err.message, code: err.code });
  }

  const message = err instanceof Error ? err.message : "Internal Server Error";
  logError("http", "Unhandled error", { message });
  return res.status(500).json({ message: "Internal Server Error", code: "INTERNAL_ERROR" });
}
