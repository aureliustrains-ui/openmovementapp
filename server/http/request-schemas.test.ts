import test from "node:test";
import assert from "node:assert/strict";
import {
  createMessageSchema,
  createWorkoutLogSchema,
  markChatReadSchema,
  createSessionCheckinSchema,
  createWeeklyCheckinSchema,
} from "./request-schemas";

test("createMessageSchema rejects unknown fields used for identity spoofing", () => {
  const parsed = createMessageSchema.safeParse({
    clientId: "client_1",
    text: "hello",
    sender: "Attacker",
    isClient: false,
  });

  assert.equal(parsed.success, false);
});

test("createWorkoutLogSchema validates required fields", () => {
  const parsed = createWorkoutLogSchema.safeParse({
    clientId: "client_1",
    phaseId: "phase_1",
    instanceId: "instance_1",
    exerciseId: "exercise_1",
    date: "2026-03-05",
    sets: [{ setNumber: 1, reps: 10 }],
  });

  assert.equal(parsed.success, true);
});

test("markChatReadSchema requires clientId", () => {
  const parsed = markChatReadSchema.safeParse({});
  assert.equal(parsed.success, false);
});

test("createSessionCheckinSchema requires rpe within 0-10", () => {
  const valid = createSessionCheckinSchema.safeParse({
    sessionId: "session_1",
    rpeOverall: 7,
    feltOff: true,
    feltOffNote: "Left knee felt unstable",
  });
  assert.equal(valid.success, true);

  const invalid = createSessionCheckinSchema.safeParse({
    sessionId: "session_1",
    rpeOverall: 11,
  });
  assert.equal(invalid.success, false);
});

test("createWeeklyCheckinSchema enforces injury impact bounds", () => {
  const valid = createWeeklyCheckinSchema.safeParse({
    sleepWeek: 4,
    energyWeek: 3,
    injuryAffectedTraining: true,
    injuryImpact: 2,
    coachNoteFromClient: "Tight lower back after deadlifts",
  });
  assert.equal(valid.success, true);

  const invalid = createWeeklyCheckinSchema.safeParse({
    sleepWeek: 4,
    energyWeek: 3,
    injuryAffectedTraining: true,
    injuryImpact: 5,
  });
  assert.equal(invalid.success, false);
});
