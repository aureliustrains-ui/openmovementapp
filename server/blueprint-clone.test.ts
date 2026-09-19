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

test("section template cloning hydrates missing nested demo videos from exercise library", () => {
  const section = cloneSectionFromTemplate(
    {
      id: "section_template_2",
      name: "B. Strength",
      exercises: [
        {
          id: "nested_ex_without_video",
          name: "Bent Arm Pull",
          sets: "5",
          reps: "2",
        },
      ],
    },
    [
      {
        id: "library_ex_1",
        name: "Bent Arm Pull",
        sets: "3",
        reps: "8",
        demoUrl: "https://video.example/library",
      },
    ],
  );

  assert.equal(section.exercises[0]?.demoUrl, "https://video.example/library");
  assert.equal(section.exercises[0]?.sets, "5");
  assert.equal(section.exercises[0]?.reps, "2");
});
