type TrendEntry = Record<string, unknown>;

export type ReadinessSummaryCardKey = "recovery" | "stress" | "effort";

export type ReadinessSummaryCard = {
  key: ReadinessSummaryCardKey;
  title: string;
  primary: string;
  secondary: string;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatMetricScore(value: number | null, scale: 5 | 10): string {
  if (typeof value !== "number" || Number.isNaN(value)) return `—/${scale}`;
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${rounded}/${scale}`;
}

function getLatestAndHistory(
  entries: TrendEntry[],
  key: string,
  historyWindow = 6,
): {
  latest: number | null;
  history: number[];
} {
  const values = entries
    .map((entry) => toFiniteNumber(entry[key]))
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return { latest: null, history: [] };
  }

  const latest = values[values.length - 1] ?? null;
  const history = values.slice(0, -1).slice(-historyWindow);
  return { latest, history };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function comparisonCopy(
  latest: number | null,
  history: number[],
  scale: 5 | 10,
  windowLabel: "weeks" | "sessions",
): string {
  if (latest === null) return "No data yet";
  const baseline = average(history);
  if (baseline === null) return "No recent trend yet";

  const tolerance = scale === 5 ? 0.3 : 0.5;
  const delta = latest - baseline;
  if (delta > tolerance) return "Above your recent average";
  if (delta < -tolerance) return "Below your recent average";
  return `In line with recent ${windowLabel}`;
}

export function buildReadinessSummaryCards(input: {
  sessionTrendData: TrendEntry[];
  weeklyTrendData: TrendEntry[];
}): ReadinessSummaryCard[] {
  const recovery = getLatestAndHistory(input.weeklyTrendData, "recoveryThisTrainingWeek");
  const stress = getLatestAndHistory(input.weeklyTrendData, "stressOutsideTrainingThisWeek");
  const effort = getLatestAndHistory(input.sessionTrendData, "rpeOverall");

  return [
    {
      key: "recovery",
      title: "Recovery",
      primary: `This week: ${formatMetricScore(recovery.latest, 5)}`,
      secondary: comparisonCopy(recovery.latest, recovery.history, 5, "weeks"),
    },
    {
      key: "stress",
      title: "Stress",
      primary: `This week: ${formatMetricScore(stress.latest, 5)}`,
      secondary: comparisonCopy(stress.latest, stress.history, 5, "weeks"),
    },
    {
      key: "effort",
      title: "Effort",
      primary: `Last session: ${formatMetricScore(effort.latest, 10)}`,
      secondary: comparisonCopy(effort.latest, effort.history, 10, "sessions"),
    },
  ];
}
