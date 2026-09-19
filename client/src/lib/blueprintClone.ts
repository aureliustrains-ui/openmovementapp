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
  demo_url?: unknown;
  demoVideoUrl?: unknown;
  demo_video_url?: unknown;
  videoUrl?: unknown;
  video_url?: unknown;
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

export function toBlueprintExercise(templateExercise: ExerciseLike): BlueprintExercise {
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
    demoUrl: getExerciseDemoUrl(templateExercise),
    enableStructuredLogging: Boolean(templateExercise.enableStructuredLogging),
    requiresMovementCheck: Boolean(templateExercise.requiresMovementCheck),
  };
}

export function cloneExerciseFromTemplate(templateExercise: ExerciseLike): BlueprintExercise {
  return { ...toBlueprintExercise(templateExercise), id: nextId() };
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
): BlueprintSection {
  return {
    id: nextId(),
    name: section.name || "New Section",
    exercises: (section.exercises || []).map((exercise) => cloneExerciseFromTemplate(exercise)),
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
    sections: (session.sections || []).map((section) => cloneSectionFromTemplate(section)),
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
