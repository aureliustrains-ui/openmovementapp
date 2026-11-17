import test from "node:test";
import assert from "node:assert/strict";
import { formatReps, formatSets } from "../client/src/lib/prescription";

test("units are added only to plain numbers and ranges", () => {
  assert.equal(formatReps("8-12"), "8-12 reps");
  assert.equal(formatReps("6–10"), "6–10 reps");
  assert.equal(formatReps("1"), "1 rep");
  assert.equal(formatSets("3"), "3 sets");
  assert.equal(formatSets("1"), "1 set");
  assert.equal(formatSets(2), "2 sets");
});

test("values that already carry a unit are shown as written", () => {
  assert.equal(formatReps("1min"), "1min");
  assert.equal(formatReps("10-15s per side"), "10-15s per side");
  assert.equal(formatReps("8 breaths"), "8 breaths");
  assert.equal(formatReps("5 per letter"), "5 per letter");
  assert.equal(formatSets("1-3"), "1-3 sets");
});

test("blank values stay blank", () => {
  assert.equal(formatReps(""), null);
  assert.equal(formatReps("   "), null);
  assert.equal(formatSets(undefined), null);
  assert.equal(formatSets(null), null);
});
