type SessionTrendEntryLike = {
  date?: string;
  feltOff?: boolean;
  rpeOverall?: number | null;
  sleepLastNight?: number | null;
  [key: string]: unknown;
};

type WeeklyTrendEntryLike = {
  weekStartDate?: string;
  [key: string]: unknown;
};

export type CheckinsRange = "2w" | "4w" | "8w" | "12w" | "all";

const RANGE_DAYS: Record<Exclude<CheckinsRange, "all">, number> = {
  "2w": 14,
  "4w": 28,
  "8w": 56,
  "12w": 84,
};

function parseTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  return null;
}

function getRangeDays(range: CheckinsRange): number | null {
  if (range === "all") return null;
  return RANGE_DAYS[range];
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function mapSessionCheckinTrendData<T extends SessionTrendEntryLike>(entries: T[]): Array<
  T & {
    dateLabel: string;
    rpeOverall: number | null;
    sleepLastNight: number | null;
    sleepLastNightScaled: number | null;
    feltOffMarker: number | null;
    feltOffSleepMarker: number | null;
  }
> {
  const scaleSleepToTenPoint = (sleepValue: number | null): number | null => {
    if (typeof sleepValue !== "number") return null;
    // Normalize 1..5 sleep score onto 0..10 so session metrics share one axis.
    return Number((((sleepValue - 1) / 4) * 10).toFixed(2));
  };

  return entries.map((entry) => ({
    ...entry,
    rpeOverall: toFiniteNumber((entry as any).rpeOverall ?? (entry as any).sessionRpe),
    sleepLastNight: toFiniteNumber((entry as any).sleepLastNight),
    sleepLastNightScaled: scaleSleepToTenPoint(toFiniteNumber((entry as any).sleepLastNight)),
    dateLabel: entry.date ? new Date(entry.date).toLocaleDateString() : "—",
    feltOffMarker: entry.feltOff
      ? toFiniteNumber((entry as any).rpeOverall ?? (entry as any).sessionRpe) ?? 0
      : null,
    feltOffSleepMarker:
      entry.feltOff ? toFiniteNumber((entry as any).sleepLastNight) : null,
  }));
}

export function mapWeeklyCheckinTrendData<T extends WeeklyTrendEntryLike>(entries: T[]): Array<
  T & {
    dateLabel: string;
    recoveryThisTrainingWeek: number | null;
    stressOutsideTrainingThisWeek: number | null;
    injuryImpact: number | null;
  }
> {
  return entries.map((entry) => ({
    ...entry,
    dateLabel: entry.weekStartDate || "—",
    recoveryThisTrainingWeek: toFiniteNumber(
      (entry as any).recoveryThisTrainingWeek ?? (entry as any).sleepWeek,
    ),
    stressOutsideTrainingThisWeek: toFiniteNumber(
      (entry as any).stressOutsideTrainingThisWeek ?? (entry as any).energyWeek,
    ),
    injuryImpact: toFiniteNumber((entry as any).injuryImpact),
  }));
}

export function hasSessionCheckinTrendData(entries: unknown[]): boolean {
  return Array.isArray(entries) && entries.length > 0;
}

export function hasWeeklyCheckinTrendData(entries: unknown[]): boolean {
  return Array.isArray(entries) && entries.length > 0;
}

export function getCheckinsAnchorTimestamp(
  sessionEntries: Array<{ date?: string }>,
  weeklyEntries: Array<{ weekStartDate?: string }>,
): number | null {
  const timestamps: number[] = [];
  sessionEntries.forEach((entry) => {
    const timestamp = parseTimestamp(entry.date);
    if (timestamp !== null) timestamps.push(timestamp);
  });
  weeklyEntries.forEach((entry) => {
    const timestamp = parseTimestamp(entry.weekStartDate);
    if (timestamp !== null) timestamps.push(timestamp);
  });
  if (timestamps.length === 0) return null;
  return Math.max(...timestamps);
}

export function autoSelectCheckinsRange(
  sessionEntries: Array<{ date?: string }>,
  weeklyEntries: Array<{ weekStartDate?: string }>,
): CheckinsRange {
  const timestamps: number[] = [];
  sessionEntries.forEach((entry) => {
    const timestamp = parseTimestamp(entry.date);
    if (timestamp !== null) timestamps.push(timestamp);
  });
  weeklyEntries.forEach((entry) => {
    const timestamp = parseTimestamp(entry.weekStartDate);
    if (timestamp !== null) timestamps.push(timestamp);
  });

  if (timestamps.length === 0) return "2w";

  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const daySpan = Math.max(0, (maxTimestamp - minTimestamp) / (24 * 60 * 60 * 1000));
  const weekSpan = Math.floor(daySpan / 7) + 1;

  if (weekSpan <= 2) return "2w";
  if (weekSpan <= 4) return "4w";
  if (weekSpan <= 8) return "8w";
  if (weekSpan <= 12) return "12w";
  return "all";
}

export function filterSessionTrendByRange<T extends { date?: string }>(
  entries: T[],
  range: CheckinsRange,
  anchorTimestamp: number | null,
): T[] {
  const rangeDays = getRangeDays(range);
  if (rangeDays === null || anchorTimestamp === null) return entries;
  const cutoffTimestamp = anchorTimestamp - rangeDays * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => {
    const timestamp = parseTimestamp(entry.date);
    return timestamp !== null && timestamp >= cutoffTimestamp && timestamp <= anchorTimestamp;
  });
}

export function filterWeeklyTrendByRange<T extends { weekStartDate?: string }>(
  entries: T[],
  range: CheckinsRange,
  anchorTimestamp: number | null,
): T[] {
  const rangeDays = getRangeDays(range);
  if (rangeDays === null || anchorTimestamp === null) return entries;
  const cutoffTimestamp = anchorTimestamp - rangeDays * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => {
    const timestamp = parseTimestamp(entry.weekStartDate);
    return timestamp !== null && timestamp >= cutoffTimestamp && timestamp <= anchorTimestamp;
  });
}
