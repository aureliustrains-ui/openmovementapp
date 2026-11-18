import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("client exercise card shows the structured standard and always the Goal", () => {
  const card = read("client/src/components/client/ExerciseStandardDetails.tsx");
  assert.match(card, /data-testid="exercise-standard"/);
  for (const label of ["Goal", "A rep counts", "Additional Instructions"]) {
    assert.ok(card.includes(`"${label}"`), `label ${label}`);
  }
  assert.doesNotMatch(card, /hasProgression/);
  assert.match(card, /repsMode === "hold" \? "Hold" : "Reps"/);
});

test("the shared exercise editor has the standard fields", () => {
  const editor = read("client/src/components/admin/exercise/ExerciseFieldsEditor.tsx");
  for (const key of ["repsMode", "qualityPoints"]) {
    assert.ok(editor.includes(key), key);
  }
});

test("standard fields are copied from templates into plans and accepted by the API", () => {
  assert.match(read("client/src/lib/blueprintClone.ts"), /pickExerciseStandard\(templateExercise\)/);
  const schemas = read("server/http/request-schemas.ts");
  assert.equal((schemas.match(/qualityPoints: nullableText/g) ?? []).length, 2);
  assert.match(read("server/schema-upgrades.ts"), /exercise_templates\.quality_points/);
  assert.match(read("server/schema-upgrades.ts"), /exercise_templates\.reps_mode/);
});

test("standard fields are not stripped for clients", () => {
  assert.doesNotMatch(read("server/client-visibility.ts"), /startPosition|qualityPoints/);
});
