import test from "node:test";
import assert from "node:assert/strict";
import type { User, WorkoutLog } from "@shared/schema";
import { AppError } from "../../http/error-handler";
import {
  assertCoachCanManageSpecifics,
  mapWorkoutHistoryForCoach,
  saveClientSpecifics,
} from "./specifics.service";
import { PRIMARY_ADMIN_EMAIL } from "../authz/admin-access";

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user_1",
    name: "Demo User",
    email: "demo@example.com",
    passwordHash: "salt:hash",
    role: "Client",
    status: "Active",
    avatar: null,
    bio: null,
    height: null,
    weight: null,
    goals: null,
    infos: null,
    specifics: null,
    specificsUpdatedAt: null,
    specificsUpdatedBy: null,
    ...overrides,
  };
}

function buildLog(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: "log_1",
    clientId: "client_1",
    phaseId: "phase_1",
    instanceId: "inst_1",
    exerciseId: "ex_1",
    exerciseName: "Push-up",
    date: "2026-03-06",
    sets: [],
    clientNotes: "Felt strong on last set",
    ...overrides,
  };
}

test("assertCoachCanManageSpecifics allows admins", () => {
  assert.doesNotThrow(() =>
    assertCoachCanManageSpecifics(buildUser({ role: "Admin", email: PRIMARY_ADMIN_EMAIL })),
  );
});

test("assertCoachCanManageSpecifics blocks clients with typed forbidden error", () => {
  assert.throws(
    () => assertCoachCanManageSpecifics(buildUser({ role: "Client" })),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 403);
      assert.equal(error.code, "FORBIDDEN");
      return true;
    },
  );
});

test("mapWorkoutHistoryForCoach keeps client note content", () => {
  const mapped = mapWorkoutHistoryForCoach([buildLog()]);
  assert.equal(mapped[0].clientNotes, "Felt strong on last set");
  assert.equal(mapped[0].exerciseName, "Push-up");
});

test("saveClientSpecifics persists specifics text", async () => {
  const result = await saveClientSpecifics(
    "client_1",
    "Avoid overhead pressing this week",
    "Coach Aurelius",
    {
      users: {
        getUser: async (id) => buildUser({ id }),
        updateUser: async (id, data) =>
          buildUser({
            id,
            specifics: data.specifics || null,
            specificsUpdatedAt: data.specificsUpdatedAt || null,
            specificsUpdatedBy: data.specificsUpdatedBy || null,
          }),
      },
    },
  );

  assert.equal(result.specifics, "Avoid overhead pressing this week");
  assert.equal(result.specificsUpdatedBy, "Coach Aurelius");
  assert.ok(result.specificsUpdatedAt);
});
