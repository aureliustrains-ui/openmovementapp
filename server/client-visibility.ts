// Coach-only exercise fields that must never reach a client.
const COACH_ONLY_EXERCISE_FIELDS = ["notes"] as const;

export function stripCoachOnlyFieldsForClient<T extends { sections?: unknown }>(session: T): T {
  const sections = Array.isArray(session.sections) ? session.sections : null;
  if (!sections) return session;
  return {
    ...session,
    sections: sections.map((section) => {
      if (!section || typeof section !== "object") return section;
      const exercises = (section as { exercises?: unknown }).exercises;
      if (!Array.isArray(exercises)) return section;
      return {
        ...(section as Record<string, unknown>),
        exercises: exercises.map((exercise) => {
          if (!exercise || typeof exercise !== "object") return exercise;
          const copy = { ...(exercise as Record<string, unknown>) };
          for (const field of COACH_ONLY_EXERCISE_FIELDS) delete copy[field];
          return copy;
        }),
      };
    }),
  };
}
