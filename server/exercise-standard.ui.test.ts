import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("client exercise card shows the structured standard and hides Goal when progression exists", () => {
  const card = read("client/src/components/client/ExerciseStandardDetails.tsx");
  assert.match(card, /data-testid="exercise-standard"/);
  for (const label of ["Start", "Top / end", "A rep counts", "Start here", "Build", "Then"]) {
    assert.ok(card.includes(`"${label}"`), `label ${label}`);
  }
  assert.match(card, /exercise\.goal && !hasProgression/);
});

test("the shared exercise editor has the standard fields", () => {
  const editor = read("client/src/components/admin/exercise/ExerciseFieldsEditor.tsx");
  for (const key of ["startPosition", "endPosition", "qualityPoints", "progressionStart", "progressionBuild", "progressionNext"]) {
    assert.ok(editor.includes(key), key);
  }
});

test("standard fields are copied from templates into plans and accepted by the API", () => {
  assert.match(read("client/src/lib/blueprintClone.ts"), /pickExerciseStandard\(templateExercise\)/);
  const schemas = read("server/http/request-schemas.ts");
  assert.equal((schemas.match(/progressionNext: nullableText/g) ?? []).length, 2);
  assert.match(read("server/schema-upgrades.ts"), /exercise_templates\.quality_points/);
});

test("standard fields are not stripped for clients", () => {
  assert.doesNotMatch(read("server/client-visibility.ts"), /startPosition|qualityPoints|progression/);
});
