type LogMeta = Record<string, unknown> | undefined;

function now() {
  return new Date().toISOString();
}

type LogLevel = "info" | "error";

function formatLog(level: LogLevel, source: string, message: string, meta?: LogMeta) {
  return JSON.stringify({
    timestamp: now(),
    level,
    source,
    message,
    ...(meta ?? {}),
  });
}

export function logInfo(source: string, message: string, meta?: LogMeta) {
  console.log(formatLog("info", source, message, meta));
}

export function logError(source: string, message: string, meta?: LogMeta) {
  console.error(formatLog("error", source, message, meta));
}
