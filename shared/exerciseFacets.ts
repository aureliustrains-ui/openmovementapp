import { z } from "zod";

// Coach-only library tags for exercise templates. Never copied into client plans.
// Vocabulary decided 17 Nov 2026 (see TEMPLATE_SYSTEM_SPEC.md, stage 1).

export const EXERCISE_PATTERNS = [
  "push-horizontal",
  "push-vertical",
  "pull-horizontal",
  "pull-vertical",
  "squat",
  "hinge",
  "lunge-single-leg",
  "hip-extension",
  "core-anti-extension",
  "core-anti-rotation",
  "core-anti-lateral-flexion",
  "core-flexion",
  "shoulder-scap",
  "carry-locomotion",
  "support-hang",
  "mobility",
  "breathing",
] as const;

export const EXERCISE_MATERIALS = [
  "none",
  "wall",
  "bench",
  "bar",
  "rings",
  "band",
  "dumbbell",
  "kettlebell",
  "foam-roller",
  "block",
  "partner",
  "machine-cable",
] as const;

export const EXERCISE_LOAD_TYPES = ["hold", "reps"] as const;

export const EXERCISE_POSITIONS = [
  "supine",
  "prone",
  "quadruped",
  "side-lying",
  "half-kneeling",
  "standing",
  "hanging",
  "support",
] as const;

export const EXERCISE_LEVEL_MIN = 1;
export const EXERCISE_LEVEL_MAX = 5;
export const EXERCISE_KEYWORDS_MAX = 3;

export type ExercisePattern = (typeof EXERCISE_PATTERNS)[number];
export type ExerciseMaterial = (typeof EXERCISE_MATERIALS)[number];
export type ExerciseLoadType = (typeof EXERCISE_LOAD_TYPES)[number];
export type ExercisePosition = (typeof EXERCISE_POSITIONS)[number];

export const exerciseFacetsSchema = z
  .object({
    pattern: z.array(z.enum(EXERCISE_PATTERNS)).max(EXERCISE_PATTERNS.length).optional(),
    material: z.array(z.enum(EXERCISE_MATERIALS)).max(EXERCISE_MATERIALS.length).optional(),
    loadType: z.array(z.enum(EXERCISE_LOAD_TYPES)).max(EXERCISE_LOAD_TYPES.length).optional(),
    position: z.array(z.enum(EXERCISE_POSITIONS)).max(EXERCISE_POSITIONS.length).optional(),
    level: z.number().int().min(EXERCISE_LEVEL_MIN).max(EXERCISE_LEVEL_MAX).nullable().optional(),
  })
  .strict();

export type ExerciseFacets = z.infer<typeof exerciseFacetsSchema>;

export const exerciseKeywordsSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(EXERCISE_KEYWORDS_MAX);

export function facetLabel(value: string): string {
  const special: Record<string, string> = {
    "lunge-single-leg": "Lunge / single leg",
    "core-anti-extension": "Core: anti-extension",
    "core-anti-rotation": "Core: anti-rotation",
    "core-anti-lateral-flexion": "Core: anti-lateral flexion",
    "core-flexion": "Core: flexion",
    "shoulder-scap": "Shoulder / scap",
    "carry-locomotion": "Carry / locomotion",
    "support-hang": "Support / hang",
    "machine-cable": "Machine / cable",
    none: "No equipment",
  };
  if (special[value]) return special[value];
  const text = value.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Normalises whatever is stored (possibly old rows with `{}` or null) into a full shape. */
export function readExerciseFacets(raw: unknown): Required<Omit<ExerciseFacets, "level">> & {
  level: number | null;
} {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pick = <T extends string>(key: string, allowed: readonly T[]): T[] =>
    Array.isArray(source[key])
      ? (source[key] as unknown[]).filter((value): value is T =>
          (allowed as readonly string[]).includes(String(value)),
        )
      : [];
  const level =
    typeof source.level === "number" &&
    Number.isInteger(source.level) &&
    source.level >= EXERCISE_LEVEL_MIN &&
    source.level <= EXERCISE_LEVEL_MAX
      ? source.level
      : null;
  return {
    pattern: pick("pattern", EXERCISE_PATTERNS),
    material: pick("material", EXERCISE_MATERIALS),
    loadType: pick("loadType", EXERCISE_LOAD_TYPES),
    position: pick("position", EXERCISE_POSITIONS),
    level,
  };
}

export type ExerciseFacetFilter = {
  pattern?: string[];
  material?: string[];
  loadType?: string[];
  position?: string[];
  needsVideo?: boolean;
};

/** Within one facet any selected value matches (OR); across facets all must match (AND). */
export function matchesFacetFilter(
  template: { facets?: unknown; needsVideo?: boolean | null },
  filter: ExerciseFacetFilter,
): boolean {
  const facets = readExerciseFacets(template.facets);
  const check = (selected: string[] | undefined, values: string[]) =>
    !selected || selected.length === 0 || selected.some((value) => values.includes(value));
  if (!check(filter.pattern, facets.pattern)) return false;
  if (!check(filter.material, facets.material)) return false;
  if (!check(filter.loadType, facets.loadType)) return false;
  if (!check(filter.position, facets.position)) return false;
  if (filter.needsVideo && !template.needsVideo) return false;
  return true;
}
