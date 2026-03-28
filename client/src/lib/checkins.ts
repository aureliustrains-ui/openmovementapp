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
    trendWeekKey: string;
    trendWeekLabel: string;
    dateLabel: string;
    rpeOverall: number | null;
    sleepLastNight: number | null;
    feltOffMarker: number | null;
    feltOffEventLevel: number | null;
    feltOffSleepMarker: number | null;
  }
> {
  return entries.map((entry, index) => {
    const dateLabel = entry.date ? new Date(entry.date).toLocaleDateString() : "—";
    const trendWeekKey =
      (typeof (entry as any).id === "string" && (entry as any).id.trim().length > 0
        ? (entry as any).id.trim()
        : null) ||
      (typeof entry.date === "string" && entry.date.trim().length > 0 ? entry.date.trim() : null) ||
      `session-${index + 1}`;

    return {
      ...entry,
      trendWeekKey,
      trendWeekLabel: dateLabel,
      rpeOverall: toFiniteNumber((entry as any).rpeOverall ?? (entry as any).sessionRpe),
      sleepLastNight: toFiniteNumber((entry as any).sleepLastNight),
      dateLabel,
      feltOffMarker: entry.feltOff
        ? toFiniteNumber((entry as any).rpeOverall ?? (entry as any).sessionRpe) ?? 0
        : null,
      // Keep felt-off markers visible and separate from regular metric dots.
      feltOffEventLevel: entry.feltOff ? 9.6 : null,
      feltOffSleepMarker: entry.feltOff ? toFiniteNumber((entry as any).sleepLastNight) : null,
    };
  });
}

export function mapWeeklyCheckinTrendData<T extends WeeklyTrendEntryLike>(entries: T[]): Array<
  T & {
    trendWeekKey: string;
    trendWeekLabel: string;
    dateLabel: string;
    recoveryThisTrainingWeek: number | null;
    stressOutsideTrainingThisWeek: number | null;
    injuryImpact: number | null;
  }
> {
  return entries.map((entry) => {
    const weekStartDate = entry.weekStartDate || "—";
    const phaseWeekNumber = toFiniteNumber((entry as any).phaseWeekNumber);
    const phaseId =
      typeof (entry as any).phaseId === "string" && (entry as any).phaseId.trim().length > 0
        ? (entry as any).phaseId.trim()
        : "phase";
    const rowId =
      (typeof (entry as any).id === "string" && (entry as any).id) ||
      (typeof (entry as any).submittedAt === "string" && (entry as any).submittedAt) ||
      weekStartDate;
    // Use training-week identity for chart x-axis so rows don't collapse when multiple
    // training weeks are submitted in the same calendar week.
    const trendWeekKey =
      phaseWeekNumber !== null ? `${phaseId}:week-${phaseWeekNumber}` : `week-start:${weekStartDate}:${rowId}`;
    const trendWeekLabel = phaseWeekNumber !== null ? `W${phaseWeekNumber}` : weekStartDate;

    return {
      ...entry,
      trendWeekKey,
      trendWeekLabel,
      dateLabel: weekStartDate,
      recoveryThisTrainingWeek: toFiniteNumber(
        (entry as any).recoveryThisTrainingWeek ?? (entry as any).sleepWeek,
      ),
      stressOutsideTrainingThisWeek: toFiniteNumber(
        (entry as any).stressOutsideTrainingThisWeek ?? (entry as any).energyWeek,
      ),
      injuryImpact: toFiniteNumber((entry as any).injuryImpact),
    };
  });
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
