/**
 * The structured "standard" of an exercise, shown to clients on the exercise card:
 * where it starts, where it ends, what counts as a rep, and how to progress.
 * All optional free text; copied from templates into plans together with the prescription.
 */
export const EXERCISE_STANDARD_KEYS = [
  "startPosition",
  "endPosition",
  "qualityPoints",
  "progressionStart",
  "progressionBuild",
  "progressionNext",
] as const;

export type ExerciseStandardKey = (typeof EXERCISE_STANDARD_KEYS)[number];
export type ExerciseStandardFields = Record<ExerciseStandardKey, string>;

export const EMPTY_EXERCISE_STANDARD: ExerciseStandardFields = {
  startPosition: "",
  endPosition: "",
  qualityPoints: "",
  progressionStart: "",
  progressionBuild: "",
  progressionNext: "",
};

export const EMPTY_EXERCISE_STANDARD_NULL: Record<ExerciseStandardKey, null> = {
  startPosition: null,
  endPosition: null,
  qualityPoints: null,
  progressionStart: null,
  progressionBuild: null,
  progressionNext: null,
};

/** Read the standard fields from anything (template, plan exercise, null), as strings. */
export function pickExerciseStandard(source: any): ExerciseStandardFields {
  const out = { ...EMPTY_EXERCISE_STANDARD };
  for (const key of EXERCISE_STANDARD_KEYS) {
    const value = source?.[key];
    out[key] = typeof value === "string" ? value : "";
  }
  return out;
}

/** The same fields as trimmed text or null, ready to send to the API. */
export function exerciseStandardToPayload(source: any): Record<ExerciseStandardKey, string | null> {
  const picked = pickExerciseStandard(source);
  const out = { ...EMPTY_EXERCISE_STANDARD_NULL } as Record<ExerciseStandardKey, string | null>;
  for (const key of EXERCISE_STANDARD_KEYS) out[key] = picked[key].trim() || null;
  return out;
}

export function hasExerciseStandard(source: any): boolean {
  return EXERCISE_STANDARD_KEYS.some((key) => {
    const value = source?.[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}
