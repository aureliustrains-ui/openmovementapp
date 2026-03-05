import test from "node:test";
import assert from "node:assert/strict";
import { createMessageSchema, createWorkoutLogSchema, markChatReadSchema } from "./request-schemas";

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

