/**
 * The structured "standard" of an exercise, shown to clients on the exercise card:
 * what counts as a rep, plus `repsMode` ("hold" = the reps value is a hold time).
 * All optional free text; copied from templates into plans together with the prescription.
 */
export const EXERCISE_STANDARD_KEYS = [
  "repsMode",
  "qualityPoints",
  "whereToStart",
] as const;

export type ExerciseStandardKey = (typeof EXERCISE_STANDARD_KEYS)[number];
export type ExerciseStandardFields = Record<ExerciseStandardKey, string>;

export const EMPTY_EXERCISE_STANDARD: ExerciseStandardFields = {
  repsMode: "",
  qualityPoints: "",
  whereToStart: "",
};

export const EMPTY_EXERCISE_STANDARD_NULL: Record<ExerciseStandardKey, null> = {
  repsMode: null,
  qualityPoints: null,
  whereToStart: null,
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
