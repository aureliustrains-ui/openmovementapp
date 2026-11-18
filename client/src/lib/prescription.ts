// Formatting of sets / reps for compact exercise rows.
// A unit is only added to plain numbers or ranges ("3", "8-12", "6–10"),
// never to values that already say what they are ("1min", "30s per side", "8 breaths").

const PLAIN_NUMBER_OR_RANGE = /^\s*\d+(\s*[-–]\s*\d+)?\s*$/;

function withUnit(value: unknown, singular: string, plural: string): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text) return null;
  if (!PLAIN_NUMBER_OR_RANGE.test(text)) return text;
  return `${text} ${text === "1" ? singular : plural}`;
}

export function formatSets(value: unknown): string | null {
  return withUnit(value, "set", "sets");
}

export function formatReps(value: unknown, mode?: string | null): string | null {
  if (mode === "hold") return formatHold(value);
  return withUnit(value, "rep", "reps");
}

/** A hold time: "30" becomes "30 s hold"; anything already descriptive ("45s per side") stays as typed. */
export function formatHold(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text) return null;
  return PLAIN_NUMBER_OR_RANGE.test(text) ? `${text} s hold` : text;
}
