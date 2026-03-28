import type { InsertWeeklyCheckin, Phase, Session, User, WeeklyCheckin } from "@shared/schema";
import { AppError } from "../../http/error-handler";

type CheckinsPhaseSessionPort = {
  getSession(id: string): Promise<Session | undefined>;
  getPhase(id: string): Promise<Phase | undefined>;
};

type WeeklyCheckinsPort = {
  getWeeklyCheckinByClientAndPhaseWeek(
    clientId: string,
    phaseId: string,
    phaseWeekNumber: number,
  ): Promise<WeeklyCheckin | undefined>;
};

export function getWeekStartDateUtc(now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date.toISOString().slice(0, 10);
}

export async function assertSessionOwnedByClient(
  sessionId: string,
  clientId: string,
  deps: CheckinsPhaseSessionPort,
): Promise<void> {
  const session = await deps.getSession(sessionId);
  if (!session) {
    throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
  }
  const phase = await deps.getPhase(session.phaseId);
  if (!phase || phase.clientId !== clientId) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
}

export function assertCanReadClientCheckins(authUser: User, clientId: string): void {
  if (authUser.role === "Admin" || authUser.role === "Coach") return;
  if (authUser.role === "Client" && authUser.id === clientId) return;
  throw new AppError("Forbidden", 403, "FORBIDDEN");
}

export async function ensureWeeklyCheckinNotSubmitted(
  clientId: string,
  phaseId: string,
  phaseWeekNumber: number,
  deps: WeeklyCheckinsPort,
): Promise<void> {
  const existing = await deps.getWeeklyCheckinByClientAndPhaseWeek(
    clientId,
    phaseId,
    phaseWeekNumber,
  );
  if (existing) {
    throw new AppError("Weekly check-in already submitted", 409, "WEEKLY_CHECKIN_EXISTS");
  }
}

export function normalizeWeeklyCheckinInput(
  input: {
    recoveryThisTrainingWeek: number;
    stressOutsideTrainingThisWeek: number;
    injuryAffectedTraining: boolean;
    injuryImpact?: number | null;
    optionalNote?: string | null;
  },
  clientId: string,
  phaseId: string,
  phaseWeekNumber: number,
  weekStartDate: string,
): InsertWeeklyCheckin {
  if (
    input.injuryAffectedTraining &&
    (input.injuryImpact === null || input.injuryImpact === undefined)
  ) {
    throw new AppError(
      "Injury impact is required when pain/injury affected training",
      400,
      "INJURY_IMPACT_REQUIRED",
    );
  }

  return {
    clientId,
    phaseId,
    phaseWeekNumber,
    weekStartDate,
    submittedAt: new Date().toISOString(),
    // Keep DB columns stable while using the new weekly metric names in UI/API.
    sleepWeek: input.recoveryThisTrainingWeek,
    energyWeek: input.stressOutsideTrainingThisWeek,
    injuryAffectedTraining: input.injuryAffectedTraining,
    injuryImpact: input.injuryAffectedTraining ? (input.injuryImpact ?? null) : null,
    coachNoteFromClient: input.optionalNote?.trim() || null,
  };
}
