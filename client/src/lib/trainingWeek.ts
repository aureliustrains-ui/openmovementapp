export type TrainingScheduleEntry = {
  week?: number;
  day?: string;
  slot?: string;
  sessionId?: string;
};

export type TrainingWeekStatus = {
  week: number;
  scheduledCount: number;
  completedCount: number;
  isCompleted: boolean;
};

export type TrainingWeekLifecycleState =
  | "current"
  | "ready_for_checkin"
  | "completed"
  | "future";

export type TrainingWeekLifecycle = TrainingWeekStatus & {
  hasWeeklyCheckin: boolean;
  state: TrainingWeekLifecycleState;
};

type WeeklyCheckinIdentity = {
  phaseId?: string | null;
  phaseWeekNumber?: number | null;
};

function buildInstanceKey(week: number, entry: TrainingScheduleEntry): string | null {
  if (typeof entry.sessionId !== "string" || !entry.sessionId) return null;
  const day = typeof entry.day === "string" && entry.day.length > 0 ? entry.day : "Monday";
  const slot = typeof entry.slot === "string" && entry.slot.length > 0 ? entry.slot : "AM";
  return `w${week}_${day}_${slot}_${entry.sessionId}`;
}

export function getTrainingWeekStatuses(
  durationWeeks: number,
  schedule: TrainingScheduleEntry[],
  completedInstances: string[],
): TrainingWeekStatus[] {
  const safeDuration = Math.max(1, Math.floor(durationWeeks || 1));
  const completedSet = new Set(completedInstances.filter((value) => typeof value === "string"));

  return Array.from({ length: safeDuration }, (_, index) => {
    const week = index + 1;
    const weekEntries = schedule.filter(
      (entry) => entry.week === week && typeof entry.sessionId === "string",
    );
    const completedCount = weekEntries.filter((entry) => {
      const key = buildInstanceKey(week, entry);
      return key ? completedSet.has(key) : false;
    }).length;
    const scheduledCount = weekEntries.length;
    return {
      week,
      scheduledCount,
      completedCount,
      isCompleted: scheduledCount > 0 && completedCount >= scheduledCount,
    };
  });
}

export function getRecommendedTrainingWeek(statuses: TrainingWeekStatus[]): number {
  const nextIncomplete = statuses.find((status) => status.scheduledCount > 0 && !status.isCompleted);
  if (nextIncomplete) return nextIncomplete.week;

  const lastScheduled = [...statuses]
    .reverse()
    .find((status) => status.scheduledCount > 0);
  if (lastScheduled) {
    return Math.min(statuses.length, lastScheduled.week + 1);
  }
  return 1;
}

export function getTrainingWeekLifecycle(
  durationWeeks: number,
  schedule: TrainingScheduleEntry[],
  completedInstances: string[],
  phaseId: string,
  weeklyCheckins: WeeklyCheckinIdentity[],
): { weeks: TrainingWeekLifecycle[]; currentWeek: number } {
  const base = getTrainingWeekStatuses(durationWeeks, schedule, completedInstances);
  const checkinWeeks = new Set<number>(
    weeklyCheckins
      .filter(
        (entry) =>
          entry.phaseId === phaseId &&
          Number.isFinite(entry.phaseWeekNumber) &&
          typeof entry.phaseWeekNumber === "number",
      )
      .map((entry) => Number(entry.phaseWeekNumber)),
  );

  const completedWeeks = base.map((status) => ({
    ...status,
    hasWeeklyCheckin: checkinWeeks.has(status.week),
    isCompleted: status.scheduledCount > 0 && status.isCompleted && checkinWeeks.has(status.week),
  }));

  const firstActionable =
    completedWeeks.find((status) => status.scheduledCount > 0 && !status.isCompleted)?.week ??
    completedWeeks.find((status) => !status.isCompleted)?.week ??
    1;

  const weeks = completedWeeks.map((status) => {
    let state: TrainingWeekLifecycleState = "future";
    if (status.isCompleted) {
      state = "completed";
    } else if (status.week === firstActionable) {
      state = status.scheduledCount > 0 && status.completedCount >= status.scheduledCount
        ? "ready_for_checkin"
        : "current";
    }
    return {
      ...status,
      state,
    };
  });

  return {
    weeks,
    currentWeek: firstActionable,
  };
}

export function getCurrentLifecycleWeek(weeks: TrainingWeekLifecycle[]): number {
  return weeks.find((week) => week.state === "current" || week.state === "ready_for_checkin")?.week || 1;
}
