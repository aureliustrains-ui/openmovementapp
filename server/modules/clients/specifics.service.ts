import type { InsertUser, User, WorkoutLog } from "@shared/schema";
import { AppError } from "../../http/error-handler";

type UsersPort = {
  getUser(id: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
};

export function assertCoachCanManageSpecifics(authUser: User): void {
  if (authUser.role !== "Admin") {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
}

export async function saveClientSpecifics(
  clientId: string,
  specifics: string | null,
  updatedBy: string,
  deps: { users: UsersPort },
): Promise<{
  specifics: string;
  specificsUpdatedAt: string | null;
  specificsUpdatedBy: string | null;
}> {
  const client = await deps.users.getUser(clientId);
  if (!client) {
    throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
  }
  const now = new Date().toISOString();
  const withMeta = await deps.users.updateUser(clientId, {
    specifics,
    specificsUpdatedAt: now,
    specificsUpdatedBy: updatedBy,
  });
  if (!withMeta) {
    throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
  }
  return {
    specifics: withMeta.specifics || "",
    specificsUpdatedAt: withMeta.specificsUpdatedAt || null,
    specificsUpdatedBy: withMeta.specificsUpdatedBy || null,
  };
}

export function mapWorkoutHistoryForCoach(logs: WorkoutLog[]): Array<{
  id: string;
  clientId: string;
  phaseId: string;
  instanceId: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  sets: unknown;
  clientNotes: string;
}> {
  return logs.map((log) => ({
    id: log.id,
    clientId: log.clientId,
    phaseId: log.phaseId,
    instanceId: log.instanceId,
    exerciseId: log.exerciseId,
    exerciseName: log.exerciseName || "Unknown exercise",
    date: log.date,
    sets: log.sets,
    clientNotes: log.clientNotes || "",
  }));
}
