import type { TrainingScheduleEntry } from "@/lib/trainingWeek";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type SessionLike = {
  id: string;
  name: string;
};

export type WeekScheduleItem = {
  entry: TrainingScheduleEntry & { day: string; slot: string; week: number };
  session: SessionLike;
  dayIndex: number;
  slotOrder: number;
  isCompleted: boolean;
  instanceKey: string;
};

type WeekSchedulePreview = {
  sortedEntries: WeekScheduleItem[];
  nextScheduleItem: WeekScheduleItem | null;
};

function normalizeDay(day: unknown): string {
  if (typeof day !== "string" || day.length === 0) return "Monday";
  return day;
}

function normalizeSlot(slot: unknown): string {
  if (typeof slot !== "string" || slot.length === 0) return "AM";
  return slot;
}

function normalizeWeek(week: unknown): number {
  if (typeof week === "number" && Number.isFinite(week) && week > 0) return week;
  return 1;
}

export function buildScheduleInstanceKey(
  week: number,
  day: string,
  slot: string,
  sessionId: string,
): string {
  return `w${week}_${day}_${slot}_${sessionId}`;
}

export function isScheduleEntryCompleted(
  completedInstances: string[],
  week: number,
  day: string,
  slot: string,
  sessionId: string,
): boolean {
  const instanceKey = buildScheduleInstanceKey(week, day, slot, sessionId);
  return completedInstances.includes(instanceKey);
}

export function getWeekSchedulePreview(
  week: number,
  schedule: TrainingScheduleEntry[],
  phaseSessions: SessionLike[],
  completedInstances: string[],
): WeekSchedulePreview {
  const sessionsById = new Map(phaseSessions.map((session) => [session.id, session]));
  const sortedEntries = schedule
    .filter((entry) => normalizeWeek(entry.week) === week && typeof entry.sessionId === "string")
    .map((entry) => {
      const session = sessionsById.get(String(entry.sessionId));
      if (!session) return null;
      const day = normalizeDay(entry.day);
      const slot = normalizeSlot(entry.slot);
      const dayIndex = WEEKDAYS.indexOf(day);
      if (dayIndex < 0) return null;
      const slotOrder = slot === "AM" ? 0 : 1;
      const instanceKey = buildScheduleInstanceKey(week, day, slot, session.id);
      return {
        entry: {
          ...entry,
          week,
          day,
          slot,
        },
        session,
        dayIndex,
        slotOrder,
        instanceKey,
        isCompleted: completedInstances.includes(instanceKey),
      };
    })
    .filter((item): item is WeekScheduleItem => Boolean(item))
    .sort((a, b) => a.dayIndex - b.dayIndex || a.slotOrder - b.slotOrder);

  const nextScheduleItem =
    sortedEntries.find((item) => !item.isCompleted) ||
    sortedEntries[0] ||
    (phaseSessions[0]
      ? {
          entry: {
            week,
            day: WEEKDAYS[0],
            slot: "AM",
            sessionId: phaseSessions[0].id,
          },
          session: phaseSessions[0],
          dayIndex: 0,
          slotOrder: 0,
          instanceKey: buildScheduleInstanceKey(week, WEEKDAYS[0], "AM", phaseSessions[0].id),
          isCompleted: false,
        }
      : null);

  return {
    sortedEntries,
    nextScheduleItem,
  };
}
