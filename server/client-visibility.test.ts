import test from "node:test";
import assert from "node:assert/strict";
import { stripCoachOnlyFieldsForClient } from "./client-visibility";

test("coach notes are removed from exercises sent to clients", () => {
  const session = {
    id: "s1",
    name: "Volume",
    sections: [
      {
        id: "a",
        name: "Activation",
        exercises: [
          { id: "e1", name: "Arching Hang", reps: "3-5", notes: "film again", additionalInstructions: "Elbows locked" },
          { id: "e2", name: "YTWL", reps: "5" },
        ],
      },
    ],
  };
  const result = stripCoachOnlyFieldsForClient(session);
  const [first, second] = (result.sections as any[])[0].exercises;
  assert.equal("notes" in first, false);
  assert.equal(first.additionalInstructions, "Elbows locked");
  assert.equal(first.reps, "3-5");
  assert.deepEqual(second, { id: "e2", name: "YTWL", reps: "5" });
  // original is not mutated (admin responses keep notes)
  assert.equal((session.sections[0].exercises[0] as any).notes, "film again");
});

test("sessions without sections pass through unchanged", () => {
  const session = { id: "s2", name: "Empty" };
  assert.deepEqual(stripCoachOnlyFieldsForClient(session), session);
});
