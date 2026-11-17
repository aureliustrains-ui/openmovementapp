import { getTrainingWeekStatuses, type TrainingScheduleEntry } from "@/lib/trainingWeek";

export type WeeklyRecapLike = {
  phaseId?: string | null;
  phaseWeekNumber?: number | null;
  submittedAt?: string | null;
  sleepWeek?: number | null; // "Recovery this training week" (1-5)
  energyWeek?: number | null; // "Stress outside training this week" (1-5)
  injuryAffectedTraining?: boolean | null;
};

export type SessionRecapLike = {
  sessionId?: string | null;
  submittedAt?: string | null;
  rpeOverall?: number | null;
};

export type WeekHistoryItem = {
  week: number;
  scheduledCount: number;
  completedCount: number;
  isCurrent: boolean;
  recap: { recovery: number | null; stress: number | null; painAffected: boolean } | null;
  averageEffort: number | null;
  sessionRecapCount: number;
};

/**
 * One entry per training week of a phase that has started (sessions done or a recap),
 * newest first. Session recaps are assigned to the week they were done in: a week ends
 * when its weekly recap is submitted.
 */
export function buildWeekHistory(input: {
  phaseId: string;
  durationWeeks: number;
  schedule: TrainingScheduleEntry[];
  completedInstances: string[];
  phaseSessionIds: string[];
  weeklyRecaps: WeeklyRecapLike[];
  sessionRecaps: SessionRecapLike[];
  currentWeek: number;
}): WeekHistoryItem[] {
  const statuses = getTrainingWeekStatuses(
    input.durationWeeks,
    input.schedule,
    input.completedInstances,
  );
  const recapsByWeek = new Map<number, WeeklyRecapLike>();
  for (const recap of input.weeklyRecaps) {
    if (recap.phaseId !== input.phaseId) continue;
    if (typeof recap.phaseWeekNumber !== "number") continue;
    recapsByWeek.set(recap.phaseWeekNumber, recap);
  }
  const phaseSessionIds = new Set(input.phaseSessionIds);
  const phaseSessionRecaps = input.sessionRecaps
    .filter((entry) => entry.sessionId && phaseSessionIds.has(entry.sessionId))
    .filter((entry) => typeof entry.submittedAt === "string")
    .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));

  const items: WeekHistoryItem[] = [];
  let windowStart = "";
  for (const status of statuses) {
    const recap = recapsByWeek.get(status.week) ?? null;
    const isCurrent = status.week === input.currentWeek && !recap;
    const started = status.completedCount > 0 || Boolean(recap) || isCurrent;
    const windowEnd = recap?.submittedAt ?? null;
    const inWindow = phaseSessionRecaps.filter((entry) => {
      const at = String(entry.submittedAt);
      if (at <= windowStart) return false;
      return windowEnd ? at <= windowEnd : isCurrent;
    });
    if (windowEnd) windowStart = windowEnd;
    if (!started) continue;
    const efforts = inWindow
      .map((entry) => entry.rpeOverall)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    items.push({
      week: status.week,
      scheduledCount: status.scheduledCount,
      completedCount: status.completedCount,
      isCurrent,
      recap: recap
        ? {
            recovery: typeof recap.sleepWeek === "number" ? recap.sleepWeek : null,
            stress: typeof recap.energyWeek === "number" ? recap.energyWeek : null,
            painAffected: Boolean(recap.injuryAffectedTraining),
          }
        : null,
      averageEffort:
        efforts.length > 0
          ? Math.round((efforts.reduce((sum, value) => sum + value, 0) / efforts.length) * 10) / 10
          : null,
      sessionRecapCount: inWindow.length,
    });
  }
  return items.reverse();
}
