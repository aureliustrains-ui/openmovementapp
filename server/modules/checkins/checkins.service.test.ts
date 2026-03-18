import test from "node:test";
import assert from "node:assert/strict";
import type { Phase, Session, User, WeeklyCheckin } from "@shared/schema";
import { AppError } from "../../http/error-handler";
import {
  assertCanReadClientCheckins,
  assertSessionOwnedByClient,
  ensureWeeklyCheckinNotSubmitted,
  getWeekStartDateUtc,
  normalizeWeeklyCheckinInput,
} from "./checkins.service";

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

function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session_1",
    phaseId: "phase_1",
    name: "Session 1",
    description: null,
    completedInstances: [],
    sections: [],
    ...overrides,
  };
}

function buildPhase(overrides: Partial<Phase> = {}): Phase {
  return {
    id: "phase_1",
    clientId: "client_1",
    name: "Phase 1",
    goal: null,
    startDate: null,
    durationWeeks: 4,
    status: "Active",
    movementChecks: [],
    schedule: [],
    completedScheduleInstances: [],
    ...overrides,
  };
}

function buildWeeklyCheckin(overrides: Partial<WeeklyCheckin> = {}): WeeklyCheckin {
  return {
    id: "wc_1",
    clientId: "client_1",
    phaseId: "phase_1",
    phaseWeekNumber: 1,
    weekStartDate: "2026-03-02",
    submittedAt: "2026-03-04T10:00:00.000Z",
    sleepWeek: 4,
    energyWeek: 3,
    injuryAffectedTraining: false,
    injuryImpact: null,
    coachNoteFromClient: null,
    ...overrides,
  };
}

test("client can submit own session check-in when session belongs to client", async () => {
  await assert.doesNotReject(() =>
    assertSessionOwnedByClient("session_1", "client_1", {
      getSession: async () => buildSession(),
      getPhase: async () => buildPhase({ clientId: "client_1" }),
    }),
  );
});

test("client cannot submit check-in for another client's session", async () => {
  await assert.rejects(
    () =>
      assertSessionOwnedByClient("session_1", "client_2", {
        getSession: async () => buildSession(),
        getPhase: async () => buildPhase({ clientId: "client_1" }),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "FORBIDDEN");
      return true;
    },
  );
});

test("weekly check-in enforces one submission per week", async () => {
  await assert.rejects(
    () =>
      ensureWeeklyCheckinNotSubmitted("client_1", "phase_1", 1, {
        getWeeklyCheckinByClientAndPhaseWeek: async () => buildWeeklyCheckin(),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "WEEKLY_CHECKIN_EXISTS");
      return true;
    },
  );
});

test("admin and coach can read any client check-ins", () => {
  assert.doesNotThrow(() =>
    assertCanReadClientCheckins(buildUser({ role: "Admin" }), "client_1"),
  );
  assert.doesNotThrow(() =>
    assertCanReadClientCheckins(buildUser({ role: "Coach" }), "client_1"),
  );
});

test("client can read own check-ins", () => {
  assert.doesNotThrow(() =>
    assertCanReadClientCheckins(buildUser({ id: "client_1", role: "Client" }), "client_1"),
  );
});

test("client cannot read another client's check-ins", () => {
  assert.throws(
    () => assertCanReadClientCheckins(buildUser({ id: "client_1", role: "Client" }), "client_2"),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "FORBIDDEN");
      return true;
    },
  );
});

test("normalizeWeeklyCheckinInput enforces impact reset when no injury impact", () => {
  const normalized = normalizeWeeklyCheckinInput(
    {
      recoveryThisTrainingWeek: 4,
      stressOutsideTrainingThisWeek: 3,
      injuryAffectedTraining: false,
      injuryImpact: 3,
      optionalNote: " All good ",
    },
    "client_1",
    "phase_1",
    2,
    "2026-03-02",
  );
  assert.equal(normalized.injuryImpact, null);
  assert.equal(normalized.coachNoteFromClient, "All good");
  assert.equal(normalized.sleepWeek, 4);
  assert.equal(normalized.energyWeek, 3);
  assert.equal(normalized.phaseId, "phase_1");
  assert.equal(normalized.phaseWeekNumber, 2);
});

test("getWeekStartDateUtc returns monday start for UTC date", () => {
  const weekStart = getWeekStartDateUtc(new Date("2026-03-05T18:00:00.000Z"));
  assert.equal(weekStart, "2026-03-02");
});
