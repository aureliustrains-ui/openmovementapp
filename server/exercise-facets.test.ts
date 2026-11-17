import test from "node:test";
import assert from "node:assert/strict";
import {
  createExerciseTemplateSchema,
  updateExerciseTemplateSchema,
} from "./http/request-schemas";
import { matchesFacetFilter, readExerciseFacets } from "@shared/exerciseFacets";
import { toBlueprintExercise } from "../client/src/lib/blueprintClone";

test("exercise template accepts known facets, keywords and needsVideo", () => {
  const parsed = createExerciseTemplateSchema.safeParse({
    name: "Ring Row",
    facets: { pattern: ["pull-horizontal"], material: ["rings"], loadType: ["reps"], level: 2 },
    keywords: ["no rings? use a table"],
    needsVideo: true,
  });
  assert.equal(parsed.success, true);
});

test("unknown facet values, too many keywords and bad levels are rejected", () => {
  assert.equal(
    updateExerciseTemplateSchema.safeParse({ facets: { pattern: ["jumping"] } }).success,
    false,
  );
  assert.equal(
    updateExerciseTemplateSchema.safeParse({ keywords: ["a", "b", "c", "d"] }).success,
    false,
  );
  assert.equal(updateExerciseTemplateSchema.safeParse({ facets: { level: 9 } }).success, false);
  assert.equal(updateExerciseTemplateSchema.safeParse({ facets: { function: ["x"] } }).success, false);
});

test("stored facets are normalised, unknown values dropped", () => {
  assert.deepEqual(readExerciseFacets(null), {
    pattern: [],
    material: [],
    loadType: [],
    position: [],
    level: null,
  });
  assert.deepEqual(readExerciseFacets({ pattern: ["squat", "nope"], level: 3 }).pattern, ["squat"]);
});

test("facet filter: OR within a facet, AND across facets", () => {
  const ringRow = { facets: { pattern: ["pull-horizontal"], material: ["rings"] }, needsVideo: false };
  assert.equal(matchesFacetFilter(ringRow, { pattern: ["pull-horizontal", "pull-vertical"] }), true);
  assert.equal(matchesFacetFilter(ringRow, { pattern: ["pull-horizontal"], material: ["none"] }), false);
  assert.equal(matchesFacetFilter(ringRow, { needsVideo: true }), false);
  assert.equal(matchesFacetFilter(ringRow, {}), true);
});

test("library tags are never copied into a client plan exercise", () => {
  const cloned = toBlueprintExercise({
    name: "Ring Row",
    reps: "8-12",
    facets: { pattern: ["pull-horizontal"] },
    keywords: ["rows"],
    needsVideo: true,
    targetMuscle: "Lats",
  } as any) as Record<string, unknown>;
  assert.equal("facets" in cloned, false);
  assert.equal("keywords" in cloned, false);
  assert.equal("needsVideo" in cloned, false);
  assert.equal("targetMuscle" in cloned, false);
  assert.equal(cloned.reps, "8-12");
});
