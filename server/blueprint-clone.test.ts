import test from "node:test";
import assert from "node:assert/strict";
import {
  cloneExerciseFromTemplate,
  cloneSectionFromTemplate,
  toBlueprintExercise,
} from "../client/src/lib/blueprintClone";

test("exercise template cloning preserves current and legacy demo video fields", () => {
  const direct = cloneExerciseFromTemplate({
    id: "template_ex_1",
    name: "Archer Chin-up",
    sets: "4",
    reps: "3",
    demoUrl: "https://video.example/direct",
  });

  assert.equal(direct.demoUrl, "https://video.example/direct");
  assert.notEqual(direct.id, "template_ex_1");

  const legacy = toBlueprintExercise({
    id: "template_ex_2",
    name: "Pike Push-up",
    sets: "3",
    reps: "8",
    demo_url: "https://video.example/legacy",
  });

  assert.equal(legacy.demoUrl, "https://video.example/legacy");
});

test("section template cloning keeps nested exercise demo videos", () => {
  const section = cloneSectionFromTemplate({
    id: "section_template_1",
    name: "A. Warm-up",
    exercises: [
      {
        id: "nested_ex_1",
        name: "Scap Push-up",
        sets: "2",
        reps: "10",
        videoUrl: "https://video.example/nested",
      },
    ],
  });

  assert.equal(section.exercises[0]?.demoUrl, "https://video.example/nested");
  assert.notEqual(section.exercises[0]?.id, "nested_ex_1");
});
