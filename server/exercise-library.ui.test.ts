import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.resolve(serverDir, relative), "utf8");

test("one exercise editor is used in the library, the template page and builder rows", () => {
  const library = read("../client/src/components/admin/exercise/ExerciseLibrary.tsx");
  const templatePage = read("../client/src/pages/admin/ExerciseTemplateEditor.tsx");
  const builderRow = read("../client/src/components/admin/builder/SectionEditorCard.tsx");
  for (const source of [library, templatePage, builderRow]) {
    assert.ok(source.includes("<ExerciseFieldsEditor"));
  }
});

test("exercise library keeps every action from the old library", () => {
  const library = read("../client/src/components/admin/exercise/ExerciseLibrary.tsx");
  for (const action of [
    "onCreateExercise",
    "onDuplicateExercise",
    "onDeleteExercise",
    "onCreateFolder",
    "onRenameFolder",
    "onDeleteFolder",
    "onMoveExercise",
    "onReorderExercises",
    "ExerciseFacetFilterBar",
    "ExerciseClientPreview",
    "ExerciseLibraryTags",
  ]) {
    assert.ok(library.includes(action), `missing ${action}`);
  }
});

test("the client preview never shows coach notes", () => {
  const preview = read("../client/src/components/admin/exercise/ExerciseClientPreview.tsx");
  assert.equal(/notes\s*:/.test(preview), false);
  assert.equal(preview.includes("exercise.notes"), false);
});
