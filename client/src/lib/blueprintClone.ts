export type BlueprintExercise = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  load: string;
  tempo: string;
  notes: string;
  goal: string;
  additionalInstructions: string;
  demoUrl: string;
  enableStructuredLogging: boolean;
  requiresMovementCheck: boolean;
};

export type BlueprintSection = {
  id: string;
  name: string;
  exercises: BlueprintExercise[];
};

export type BlueprintSession = {
  id: string;
  name: string;
  description: string;
  durationMinutes?: number | null;
  sections: BlueprintSection[];
};

export type BlueprintScheduleEntry = {
  day: string;
  week: number;
  slot: string;
  sessionId: string;
};

export type PhaseTemplateBlueprint = {
  sessions: BlueprintSession[];
  schedule: BlueprintScheduleEntry[];
};

type CloneResult = {
  sessions: BlueprintSession[];
  schedule: BlueprintScheduleEntry[];
  sessionIdMap: Record<string, string>;
};

type ExerciseLike = Partial<BlueprintExercise> & {
  name?: string;
  exerciseTemplateId?: unknown;
  templateId?: unknown;
  demo_url?: unknown;
  demoVideoUrl?: unknown;
  demo_video_url?: unknown;
  videoUrl?: unknown;
  video_url?: unknown;
};

type ExerciseLibraryItem = ExerciseLike & {
  id?: string;
};

function nextId() {
  return crypto.randomUUID();
}

function firstStringField(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return "";
}

function getExerciseDemoUrl(templateExercise: ExerciseLike): string {
  return firstStringField(
    templateExercise.demoUrl,
    templateExercise.demo_url,
    templateExercise.demoVideoUrl,
    templateExercise.demo_video_url,
    templateExercise.videoUrl,
    templateExercise.video_url,
  );
}

function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function findLibraryExercise(
  templateExercise: ExerciseLike,
  libraryExercises: ExerciseLibraryItem[],
): ExerciseLibraryItem | null {
  const possibleIds = [templateExercise.exerciseTemplateId, templateExercise.templateId];
  for (const possibleId of possibleIds) {
    if (typeof possibleId !== "string" || !possibleId.trim()) continue;
    const match = libraryExercises.find((candidate) => candidate.id === possibleId);
    if (match) return match;
  }

  const exerciseName = normalizeName(templateExercise.name);
  if (!exerciseName) return null;

  const exactNameMatches = libraryExercises.filter(
    (candidate) => normalizeName(candidate.name) === exerciseName,
  );
  return exactNameMatches.find((candidate) => getExerciseDemoUrl(candidate)) || exactNameMatches[0] || null;
}

export function toBlueprintExercise(
  templateExercise: ExerciseLike,
  libraryExercises: ExerciseLibraryItem[] = [],
): BlueprintExercise {
  const libraryMatch = findLibraryExercise(templateExercise, libraryExercises);
  const demoUrl = getExerciseDemoUrl(templateExercise) || getExerciseDemoUrl(libraryMatch || {});

  return {
    id: templateExercise.id || nextId(),
    name: templateExercise.name || "New Exercise",
    sets: templateExercise.sets || "3",
    reps: templateExercise.reps || "10",
    load: templateExercise.load === "Auto" ? "" : templateExercise.load || "",
    tempo: templateExercise.tempo || "3010",
    notes: templateExercise.notes || "",
    goal: templateExercise.goal || "",
    additionalInstructions: templateExercise.additionalInstructions || "",
    demoUrl,
    enableStructuredLogging: Boolean(templateExercise.enableStructuredLogging),
    requiresMovementCheck: Boolean(templateExercise.requiresMovementCheck),
  };
}

export function cloneExerciseFromTemplate(
  templateExercise: ExerciseLike,
  libraryExercises: ExerciseLibraryItem[] = [],
): BlueprintExercise {
  return { ...toBlueprintExercise(templateExercise, libraryExercises), id: nextId() };
}

export function cloneExercise(exercise: BlueprintExercise): BlueprintExercise {
  return { ...exercise, id: nextId() };
}

export function cloneSection(section: BlueprintSection): BlueprintSection {
  return {
    ...section,
    id: nextId(),
    exercises: (section.exercises || []).map(cloneExercise),
  };
}

export function cloneSectionFromTemplate(
  section: Partial<BlueprintSection> & {
    name?: string;
    exercises?: ExerciseLike[];
  },
  libraryExercises: ExerciseLibraryItem[] = [],
): BlueprintSection {
  return {
    id: nextId(),
    name: section.name || "New Section",
    exercises: (section.exercises || []).map((exercise) =>
      cloneExerciseFromTemplate(exercise, libraryExercises),
    ),
  };
}

export function cloneSession(session: BlueprintSession): BlueprintSession {
  return {
    ...session,
    id: nextId(),
    sections: (session.sections || []).map(cloneSection),
  };
}

export function cloneSessionFromTemplate(
  session: Partial<BlueprintSession> & {
    name?: string;
    description?: string;
    durationMinutes?: number | null;
    sections?: Array<Partial<BlueprintSection> & { exercises?: ExerciseLike[] }>;
  },
  libraryExercises: ExerciseLibraryItem[] = [],
): BlueprintSession {
  const parsedDuration =
    typeof session.durationMinutes === "number" &&
    Number.isFinite(session.durationMinutes) &&
    session.durationMinutes > 0
      ? Math.floor(session.durationMinutes)
      : null;
  return {
    id: nextId(),
    name: session.name || "New Session",
    description: session.description || "",
    durationMinutes: parsedDuration,
    sections: (session.sections || []).map((section) =>
      cloneSectionFromTemplate(section, libraryExercises),
    ),
  };
}

export function clonePhaseTemplate(input: PhaseTemplateBlueprint): CloneResult {
  const sessionIdMap: Record<string, string> = {};
  const sessions = (input.sessions || []).map((session) => {
    const cloned = cloneSession(session);
    sessionIdMap[session.id] = cloned.id;
    return cloned;
  });

  const schedule = (input.schedule || []).map((entry) => ({
    ...entry,
    sessionId: sessionIdMap[entry.sessionId] || entry.sessionId,
  }));

  return { sessions, schedule, sessionIdMap };
}
