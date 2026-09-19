import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  phasesQuery,
  phaseQuery,
  sessionsByPhaseQuery,
  exerciseTemplatesQuery,
  sectionTemplatesQuery,
  sessionTemplatesQuery,
  phaseTemplatesQuery,
  useUpdatePhase,
  useCreatePhase,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  useDeletePhase,
  useCreateExerciseTemplate,
  useCreateSectionTemplate,
  useCreateSessionTemplate,
  useCreatePhaseTemplate,
} from "@/lib/api";
import {
  cloneExercise,
  cloneExerciseFromTemplate,
  clonePhaseTemplate,
  cloneSection,
  cloneSectionFromTemplate,
  cloneSessionFromTemplate,
  toBlueprintExercise,
} from "@/lib/blueprintClone";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Send,
  CalendarDays,
  CheckCircle2,
  X,
  Copy,
  Library,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAutosave } from "@/hooks/useAutosave";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AddFromTemplatesModal } from "@/components/admin/AddFromTemplatesModal";
import { TemplatePickerPanel } from "@/components/admin/TemplatePickerPanel";
import { SessionEditorCard } from "@/components/admin/builder/SessionEditorCard";
import { SaveToTemplateDialog } from "@/components/admin/SaveToTemplateDialog";
import type { AutosaveStatus } from "@/hooks/useAutosave";

function generateId() {
  return crypto.randomUUID();
}

function stableStringify(obj: any): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

function getUsefulErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  const apiMatch = message.match(/failed \(\d+\):\s*(.+)$/i);
  if (apiMatch?.[1]) return apiMatch[1].trim();
  const tailMatch = message.match(/:\s([^:]+)$/);
  if (tailMatch?.[1]) return tailMatch[1].trim();
  return message || fallback;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOTS = ["AM", "PM"];
const getScheduleDayLabel = (day: string) => {
  const index = WEEKDAYS.indexOf(day);
  return index >= 0 ? `Day ${index + 1}` : day;
};

type Exercise = {
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

type Section = {
  id: string;
  name: string;
  exercises: Exercise[];
};

type LocalSession = {
  id: string;
  dbId?: string;
  name: string;
  description: string;
  durationMinutes: number | null;
  sessionVideoUrl: string;
  sections: Section[];
  isNew?: boolean;
};

type ScheduleEntry = {
  day: string;
  week: number;
  slot: string;
  sessionId: string;
};

type TemplateSaveTarget =
  | { type: "phase" }
  | { type: "session"; sessionIdx: number }
  | { type: "section"; sessionIdx: number; sectionIdx: number }
  | { type: "exercise"; sessionIdx: number; sectionIdx: number; exerciseIdx: number };

function makeExercise(name = "New Exercise"): Exercise {
  return {
    id: generateId(),
    name,
    sets: "3",
    reps: "10",
    load: "",
    tempo: "3010",
    notes: "",
    goal: "",
    additionalInstructions: "",
    demoUrl: "",
    enableStructuredLogging: false,
    requiresMovementCheck: false,
  };
}

function makeSection(name = "New Section"): Section {
  return { id: generateId(), name, exercises: [] };
}

function makeSession(name = "New Session"): LocalSession {
  return {
    id: generateId(),
    name,
    description: "",
    durationMinutes: null,
    sessionVideoUrl: "",
    sections: [makeSection("A. Main")],
    isNew: true,
  };
}

function cloneLocalSession(session: LocalSession): LocalSession {
  return {
    ...session,
    id: generateId(),
    dbId: undefined,
    name: `${session.name || "Session"} (Copy)`,
    sections: session.sections.map((section) => cloneSection(section)),
    isNew: true,
  };
}

function collectMovementCheckExercises(sessions: LocalSession[]): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = [];
  for (const s of sessions) {
    for (const sec of s.sections) {
      for (const ex of sec.exercises) {
        if (ex.requiresMovementCheck && ex.name) {
          result.push({ id: ex.id, name: ex.name });
        }
      }
    }
  }
  return result;
}

type MovementCheckEntry = {
  exerciseId: string;
  name: string;
  status: string;
  videoUrl?: string;
  videoSource?: "link" | "upload" | null;
  videoObjectKey?: string | null;
  videoMimeType?: string | null;
  videoOriginalFilename?: string | null;
  feedback?: string;
  clientNote?: string;
  approvedNote?: string;
  resubmitFeedback?: string;
  submittedAt?: string;
  decidedAt?: string;
  decision?: string;
};

function parseMovementChecks(source: unknown): MovementCheckEntry[] {
  let parsed = source;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((entry): entry is MovementCheckEntry => Boolean(entry && typeof entry === "object"))
    .map((entry) => ({ ...entry }));
}

function buildMovementChecksForPublish(
  exercises: Array<{ id: string; name: string }>,
  existingChecksSource: unknown,
): MovementCheckEntry[] {
  const existingByExerciseId = new Map(
    parseMovementChecks(existingChecksSource)
      .map((entry) => {
        const exerciseId = typeof entry.exerciseId === "string" ? entry.exerciseId : "";
        return exerciseId ? [exerciseId, entry] : null;
      })
      .filter((entry): entry is [string, MovementCheckEntry] => Boolean(entry)),
  );

  return exercises.map((exercise) => {
    const existing = existingByExerciseId.get(exercise.id);
    if (!existing) {
      return {
        exerciseId: exercise.id,
        name: exercise.name,
        status: "Not Submitted",
        videoUrl: "",
        feedback: "",
        clientNote: "",
        submittedAt: "",
      };
    }

    return {
      ...existing,
      exerciseId: exercise.id,
      name: exercise.name,
      status: typeof existing.status === "string" ? existing.status : "Not Submitted",
      videoUrl: typeof existing.videoUrl === "string" ? existing.videoUrl : "",
      feedback: typeof existing.feedback === "string" ? existing.feedback : "",
      clientNote: typeof existing.clientNote === "string" ? existing.clientNote : "",
    };
  });
}

export default function AdminPhaseBuilder() {
  const [, params] = useRoute("/app/admin/clients/:clientId/builder/:phaseId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNew = params?.phaseId === "new";

  const { data: allPhases = [], isFetching: fetchingPhases } = useQuery(phasesQuery);
  const {
    data: phaseSessions = [],
    isLoading: loadingSessions,
    isFetching: fetchingSessions,
  } = useQuery(sessionsByPhaseQuery(params?.phaseId || ""));
  const { data: templates = [] } = useQuery(exerciseTemplatesQuery);
  const { data: sectionTemplates = [] } = useQuery(sectionTemplatesQuery);
  const { data: sessionTemplates = [] } = useQuery(sessionTemplatesQuery);
  const { data: phaseTemplates = [] } = useQuery(phaseTemplatesQuery);
  const updatePhase = useUpdatePhase();
  const createPhase = useCreatePhase();
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();
  const deletePhase = useDeletePhase();
  const createExerciseTemplate = useCreateExerciseTemplate();
  const createSectionTemplate = useCreateSectionTemplate();
  const createSessionTemplate = useCreateSessionTemplate();
  const createPhaseTemplate = useCreatePhaseTemplate();

  const existingPhase = allPhases.find((p: any) => p.id === params?.phaseId);

  const [phaseName, setPhaseName] = useState("New Phase");
  const [goal, setGoal] = useState("");
  const [homeIntroVideoUrl, setHomeIntroVideoUrl] = useState("");
  const [homeGuideVideoUrl, setHomeGuideVideoUrl] = useState("");
  const [durationWeeks, setDurationWeeks] = useState("4");
  const [localSessions, setLocalSessions] = useState<LocalSession[]>([]);
  const [localSchedule, setLocalSchedule] = useState<ScheduleEntry[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [initializedForPhase, setInitializedForPhase] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [movementCheckEnabled, setMovementCheckEnabled] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leavingBuilder, setLeavingBuilder] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [templateSaveTarget, setTemplateSaveTarget] = useState<TemplateSaveTarget | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sharedEditDecisions, setSharedEditDecisions] = useState<Record<string, "week" | "all">>(
    {},
  );
  const [assignSessionTarget, setAssignSessionTarget] = useState<{
    day: string;
    slot: string;
  } | null>(null);
  const justSavedRef = useRef(false);

  const isDirty = useMemo(() => {
    if ((fetchingSessions || fetchingPhases) && lastSavedAt) return false;

    if (!existingPhase && isNew) {
      return (
        phaseName !== "New Phase" ||
        goal !== "" ||
        homeIntroVideoUrl !== "" ||
        homeGuideVideoUrl !== "" ||
        durationWeeks !== "4" ||
        localSessions.length > 1 ||
        localSessions[0]?.sections.length > 1 ||
        localSessions[0]?.sections[0]?.exercises.length > 0 ||
        localSchedule.length > 0
      );
    }
    if (!existingPhase) return false;

    const nameChanged = phaseName !== existingPhase.name;
    const goalChanged = goal !== (existingPhase.goal || "");
    const introVideoChanged = homeIntroVideoUrl !== (existingPhase.homeIntroVideoUrl || "");
    const guideVideoChanged = homeGuideVideoUrl !== (existingPhase.homeGuideVideoUrl || "");
    const durationChanged = durationWeeks !== String(existingPhase.durationWeeks);
    if (nameChanged || goalChanged || introVideoChanged || guideVideoChanged || durationChanged)
      return true;

    if (fetchingSessions || fetchingPhases) return false;

    if (localSessions.length !== phaseSessions.length) return true;
    for (let i = 0; i < localSessions.length; i++) {
      const ls = localSessions[i];
      const ps = phaseSessions.find((s: any) => s.id === ls.dbId);
      if (!ps) return true;
      if (ls.name !== ps.name) return true;
      if (ls.description !== (ps.description || "")) return true;
      if ((ls.durationMinutes ?? null) !== (ps.durationMinutes ?? null)) return true;
      if (ls.sessionVideoUrl !== (ps.sessionVideoUrl || "")) return true;
      if (stableStringify(ls.sections) !== stableStringify(ps.sections)) return true;
    }

    const sortSched = (s: any[]) =>
      [...s].sort(
        (a, b) =>
          a.week - b.week ||
          a.day.localeCompare(b.day) ||
          (a.slot || "AM").localeCompare(b.slot || "AM") ||
          a.sessionId.localeCompare(b.sessionId),
      );
    const dbSched = ((existingPhase.schedule as any[]) || []).map((e: any) => ({
      day: e.day,
      week: e.week,
      slot: e.slot || "AM",
      sessionId: e.sessionId,
    }));
    if (stableStringify(sortSched(localSchedule)) !== stableStringify(sortSched(dbSched)))
      return true;

    return false;
  }, [
    phaseName,
    goal,
    homeIntroVideoUrl,
    homeGuideVideoUrl,
    durationWeeks,
    localSessions,
    localSchedule,
    existingPhase,
    phaseSessions,
    isNew,
    fetchingSessions,
    fetchingPhases,
    lastSavedAt,
  ]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const confirmLeaveWithUnsavedChanges = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm("You have unsaved builder changes. Leave without saving?");
  }, [isDirty]);

  const [addSessionModalOpen, setAddSessionModalOpen] = useState(false);
  const [insertTemplateOpen, setInsertTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedTemplateSessionId, setSelectedTemplateSessionId] = useState<string>("");
  const [selectedTemplateSectionId, setSelectedTemplateSectionId] = useState<string>("");
  const [selectedTargetSessionId, setSelectedTargetSessionId] = useState<string>("");

  useEffect(() => {
    setSelectedTemplateSessionId("");
    setSelectedTemplateSectionId("");
  }, [selectedTemplateId]);

  useEffect(() => {
    setSelectedTemplateSectionId("");
  }, [selectedTemplateSessionId]);

  const currentPhaseId = params?.phaseId || "new";

  const builderAutosaveSnapshot = useMemo(
    () =>
      stableStringify({
        phaseName,
        goal,
        homeIntroVideoUrl,
        homeGuideVideoUrl,
        durationWeeks,
        movementCheckEnabled,
        localSessions,
        localSchedule,
      }),
    [
      durationWeeks,
      goal,
      homeGuideVideoUrl,
      homeIntroVideoUrl,
      localSchedule,
      localSessions,
      movementCheckEnabled,
      phaseName,
    ],
  );

  useEffect(() => {
    if (initializedForPhase === currentPhaseId) return;

    if (justSavedRef.current) {
      setInitializedForPhase(currentPhaseId);
      justSavedRef.current = false;
      return;
    }

    if (isNew) {
      setPhaseName("New Phase");
      setGoal("");
      setHomeIntroVideoUrl("");
      setHomeGuideVideoUrl("");
      setDurationWeeks("4");
      setMovementCheckEnabled(false);
      setLocalSessions([makeSession("Session 1")]);
      setLocalSchedule([]);
      setSelectedWeek(1);
      setLastSavedAt(null);
      setInitializedForPhase(currentPhaseId);
      return;
    }

    if (!existingPhase) return;
    if (loadingSessions || fetchingSessions || fetchingPhases) return;

    const scheduleHasSessions = ((existingPhase.schedule as any[]) || []).length > 0;
    const dbHasSessions = scheduleHasSessions || existingPhase.status !== "Draft";
    if (phaseSessions.length === 0 && dbHasSessions) return;

    setPhaseName(existingPhase.name);
    setGoal(existingPhase.goal || "");
    setHomeIntroVideoUrl(existingPhase.homeIntroVideoUrl || "");
    setHomeGuideVideoUrl(existingPhase.homeGuideVideoUrl || "");
    setDurationWeeks(String(existingPhase.durationWeeks));

    const hasMovementChecks = (existingPhase.movementChecks as any[])?.length > 0;
    const hasExerciseLevelFlags = phaseSessions.some((s: any) =>
      ((s.sections as any[]) || []).some((sec: any) =>
        (sec.exercises || []).some((ex: any) => ex.requiresMovementCheck),
      ),
    );
    setMovementCheckEnabled(
      hasMovementChecks ||
        hasExerciseLevelFlags ||
        existingPhase.status === "Waiting for Movement Check",
    );

    if (phaseSessions.length > 0) {
      setLocalSessions(
        phaseSessions.map((s: any) => ({
          id: s.id,
          dbId: s.id,
          name: s.name,
          description: s.description || "",
          durationMinutes:
            typeof s.durationMinutes === "number" &&
            Number.isFinite(s.durationMinutes) &&
            s.durationMinutes > 0
              ? Math.floor(s.durationMinutes)
              : null,
          sessionVideoUrl: s.sessionVideoUrl || "",
          sections: ((s.sections as any[]) || []).map((sec: any) => ({
            ...sec,
            exercises: (sec.exercises || []).map((ex: any) => ({
              id: ex.id,
              name: ex.name || "",
              sets: ex.sets || "3",
              reps: ex.reps || "10",
              load: ex.load === "Auto" ? "" : ex.load || "",
              tempo: ex.tempo || "3010",
              notes: ex.notes || "",
              goal: ex.goal || "",
              additionalInstructions: ex.additionalInstructions || "",
              demoUrl: ex.demoUrl || "",
              enableStructuredLogging: ex.enableStructuredLogging || false,
              requiresMovementCheck: ex.requiresMovementCheck || false,
            })),
          })),
        })),
      );
    } else {
      setLocalSessions([makeSession("Session 1")]);
    }

    const existingSchedule = (existingPhase.schedule as any[]) || [];
    setLocalSchedule(
      existingSchedule.map((e: any) => ({
        day: e.day,
        week: e.week,
        slot: e.slot || "AM",
        sessionId: e.sessionId,
      })),
    );
    setSelectedWeek(1);

    setLastSavedAt(null);
    setInitializedForPhase(currentPhaseId);
  }, [
    existingPhase,
    phaseSessions,
    isNew,
    currentPhaseId,
    initializedForPhase,
    loadingSessions,
    fetchingSessions,
    fetchingPhases,
  ]);

  useEffect(() => {
    const maxWeek = parseInt(durationWeeks) || 4;
    setLocalSchedule((prev) => {
      const filtered = prev.filter((e) => e.week <= maxWeek);
      return filtered.length !== prev.length ? filtered : prev;
    });
    if (selectedWeek > maxWeek) setSelectedWeek(maxWeek);
  }, [durationWeeks]);

  const updateLocalSession = useCallback(
    (sessionIdx: number, updater: (s: LocalSession) => LocalSession) => {
      const sourceSession = localSessions[sessionIdx];
      if (!sourceSession) return;

      const sourceSessionId = sourceSession.dbId || sourceSession.id;
      const usedThisWeek = localSchedule.some(
        (entry) => entry.week === selectedWeek && entry.sessionId === sourceSessionId,
      );
      const usedInOtherWeeks = localSchedule.some(
        (entry) => entry.week !== selectedWeek && entry.sessionId === sourceSessionId,
      );

      const decisionKey = `${selectedWeek}:${sourceSessionId}`;
      const existingDecision = sharedEditDecisions[decisionKey];

      if (!usedThisWeek || !usedInOtherWeeks || existingDecision === "all") {
        setLocalSessions((prev) => prev.map((s, i) => (i === sessionIdx ? updater(s) : s)));
        return;
      }

      const shouldFork =
        existingDecision === "week" ||
        window.confirm(
          `This session is also used in other weeks.\n\nOK = make Week ${selectedWeek} separate before editing.\nCancel = edit all weeks that use this session.`,
        );

      setSharedEditDecisions((prev) => ({
        ...prev,
        [decisionKey]: shouldFork ? "week" : "all",
      }));

      if (!shouldFork) {
        setLocalSessions((prev) => prev.map((s, i) => (i === sessionIdx ? updater(s) : s)));
        return;
      }

      const weekSpecificCopy = cloneLocalSession({
        ...sourceSession,
        name: `${sourceSession.name || "Session"} W${selectedWeek}`,
      });
      const updatedCopy = updater(weekSpecificCopy);

      setLocalSessions((prev) => {
        const current = prev[sessionIdx];
        if (!current || (current.dbId || current.id) !== sourceSessionId) return prev;
        const next = [...prev];
        next[sessionIdx] = updatedCopy;
        next.splice(sessionIdx + 1, 0, sourceSession);
        return next;
      });
      setLocalSchedule((prev) =>
        prev.map((entry) =>
          entry.week === selectedWeek && entry.sessionId === sourceSessionId
            ? { ...entry, sessionId: updatedCopy.id }
            : entry,
        ),
      );
      toast({
        title: `Week ${selectedWeek} is separate now`,
        description: `${sourceSession.name || "Session"} was copied before applying your edit.`,
      });
    },
    [localSchedule, localSessions, selectedWeek, sharedEditDecisions, toast],
  );

  const addSession = () => {
    setLocalSessions((prev) => [...prev, makeSession(`Session ${prev.length + 1}`)]);
  };

  const addSessionFromTemplate = (template: any) => {
    const cloned = cloneSessionFromTemplate(template);
    setLocalSessions((prev) => [
      ...prev,
      {
        ...cloned,
        durationMinutes:
          typeof (cloned as { durationMinutes?: number | null }).durationMinutes === "number" &&
          Number.isFinite((cloned as { durationMinutes?: number | null }).durationMinutes) &&
          ((cloned as { durationMinutes?: number | null }).durationMinutes || 0) > 0
            ? Math.floor((cloned as { durationMinutes?: number | null }).durationMinutes || 0)
            : null,
        sessionVideoUrl: (cloned as { sessionVideoUrl?: string }).sessionVideoUrl || "",
        dbId: undefined,
        isNew: true,
      },
    ]);
  };

  const templateSaveDialogMeta = useMemo(() => {
    if (!templateSaveTarget) return null;
    if (templateSaveTarget.type === "phase") {
      return {
        type: "phase" as const,
        title: "Save phase as template",
        itemName: phaseName,
      };
    }
    const session = localSessions[templateSaveTarget.sessionIdx];
    if (templateSaveTarget.type === "session") {
      return {
        type: "session" as const,
        title: "Save session as template",
        itemName: session?.name || "Untitled session",
      };
    }
    const section = session?.sections[templateSaveTarget.sectionIdx];
    if (templateSaveTarget.type === "section") {
      return {
        type: "section" as const,
        title: "Save section as template",
        itemName: section?.name || "Untitled section",
      };
    }
    const exercise = section?.exercises[templateSaveTarget.exerciseIdx];
    return {
      type: "exercise" as const,
      title: "Save exercise as template",
      itemName: exercise?.name || "Untitled exercise",
    };
  }, [localSessions, phaseName, templateSaveTarget]);

  const saveCurrentItemToTemplate = async (folderId: string | null) => {
    if (!templateSaveTarget) return;
    setSavingTemplate(true);
    try {
      if (templateSaveTarget.type === "phase") {
        const cloned = clonePhaseTemplate({
          sessions: localSessions.map((session) => ({
            id: session.id,
            name: session.name || "Untitled session",
            description: session.description || "",
            durationMinutes: session.durationMinutes,
            sections: session.sections,
          })),
          schedule: localSchedule,
        });
        await createPhaseTemplate.mutateAsync({
          folderId,
          name: phaseName.trim() || "Untitled phase",
          goal: goal.trim() || null,
          durationWeeks: parseInt(durationWeeks, 10) || 4,
          movementCheckEnabled,
          sessions: cloned.sessions,
          schedule: cloned.schedule,
        });
      } else if (templateSaveTarget.type === "session") {
        const session = localSessions[templateSaveTarget.sessionIdx];
        if (!session) throw new Error("Session not found");
        const cloned = cloneSessionFromTemplate({
          name: session.name || "Untitled session",
          description: session.description || "",
          durationMinutes: session.durationMinutes,
          sections: session.sections,
        });
        await createSessionTemplate.mutateAsync({
          folderId,
          name: session.name.trim() || "Untitled session",
          description: session.description.trim() || null,
          durationMinutes: session.durationMinutes,
          sections: cloned.sections,
        });
      } else if (templateSaveTarget.type === "section") {
        const section =
          localSessions[templateSaveTarget.sessionIdx]?.sections[templateSaveTarget.sectionIdx];
        if (!section) throw new Error("Section not found");
        const cloned = cloneSection(section);
        await createSectionTemplate.mutateAsync({
          folderId,
          name: section.name.trim() || "Untitled section",
          description: null,
          exercises: cloned.exercises,
        });
      } else {
        const exercise =
          localSessions[templateSaveTarget.sessionIdx]?.sections[templateSaveTarget.sectionIdx]
            ?.exercises[templateSaveTarget.exerciseIdx];
        if (!exercise) throw new Error("Exercise not found");
        await createExerciseTemplate.mutateAsync({
          folderId,
          name: exercise.name.trim() || "Untitled exercise",
          targetMuscle: null,
          demoUrl: exercise.demoUrl.trim() || null,
          sets: exercise.sets.trim() || null,
          reps: exercise.reps.trim() || null,
          load: exercise.load.trim() || null,
          tempo: exercise.tempo.trim() || null,
          notes: exercise.notes.trim() || null,
          goal: exercise.goal.trim() || null,
          additionalInstructions: exercise.additionalInstructions.trim() || null,
          requiresMovementCheck: exercise.requiresMovementCheck,
          enableStructuredLogging: exercise.enableStructuredLogging,
        });
      }
      toast({ title: "Saved to templates" });
      setTemplateSaveTarget(null);
    } catch {
      toast({ title: "Could not save template", variant: "destructive" });
    } finally {
      setSavingTemplate(false);
    }
  };

  const removeSession = (idx: number) => {
    const removedSession = localSessions[idx];
    const removedId = removedSession.dbId || removedSession.id;
    setLocalSessions((prev) => prev.filter((_, i) => i !== idx));
    setLocalSchedule((prev) => prev.filter((e) => e.sessionId !== removedId));
  };

  const moveSessionToIndex = (sourceIdx: number, targetIdx: number) => {
    setLocalSessions((prev) => {
      const clampedTargetIdx = Math.max(0, Math.min(targetIdx, prev.length - 1));
      if (sourceIdx === clampedTargetIdx) return prev;
      const next = [...prev];
      const [moving] = next.splice(sourceIdx, 1);
      if (!moving) return prev;
      next.splice(clampedTargetIdx, 0, moving);
      return next;
    });
  };

  const addScheduleEntry = (day: string, slot: string, sessionId: string) => {
    setLocalSchedule((prev) => {
      if (
        prev.find(
          (e) =>
            e.day === day &&
            e.week === selectedWeek &&
            e.slot === slot &&
            e.sessionId === sessionId,
        )
      ) {
        return prev;
      }
      return [...prev, { day, week: selectedWeek, slot, sessionId }];
    });
  };

  const removeScheduleEntry = (day: string, slot: string, sessionId: string) => {
    setLocalSchedule((prev) =>
      prev.filter((e) => !(e.day === day && e.slot === slot && e.sessionId === sessionId)),
    );
  };

  const copyWeekToAll = () => {
    const weeks = parseInt(durationWeeks) || 4;
    const sourceEntries = localSchedule.filter((e) => e.week === selectedWeek);
    const otherWeeks: ScheduleEntry[] = [];

    for (let w = 1; w <= weeks; w++) {
      if (w === selectedWeek) continue;
      sourceEntries.forEach((e) => {
        otherWeeks.push({ ...e, week: w });
      });
    }
    setLocalSchedule([...localSchedule.filter((e) => e.week === selectedWeek), ...otherWeeks]);
    toast({
      title: "Schedule Copied",
      description: `Week ${selectedWeek} was copied to all weeks. Sessions stay linked until you make a week separate.`,
    });
  };

  const makeScheduleEntryWeekSpecific = (entry: ScheduleEntry) => {
    const sourceSession = localSessions.find(
      (session) => (session.dbId || session.id) === entry.sessionId,
    );
    if (!sourceSession) return;
    const copy = cloneLocalSession({
      ...sourceSession,
      name: `${sourceSession.name} W${entry.week}`,
    });
    setLocalSessions((prev) => [...prev, copy]);
    setLocalSchedule((prev) =>
      prev.map((candidate) =>
        candidate.week === entry.week &&
        candidate.day === entry.day &&
        candidate.slot === entry.slot &&
        candidate.sessionId === entry.sessionId
          ? { ...candidate, sessionId: copy.id }
          : candidate,
      ),
    );
    toast({
      title: "Week-specific copy created",
      description: `${sourceSession.name} can now be edited for Week ${entry.week} without changing other weeks.`,
    });
  };

  const savePhase = async (): Promise<{
    phaseId: string;
    savedSessions: any[];
    persistedSchedule: ScheduleEntry[];
  } | null> => {
    const clientId = params?.clientId;
    let phaseId: string;
    const existingSessionIds = new Set<string>();

    if (isNew && clientId) {
      const phase = await createPhase.mutateAsync({
        clientId,
        name: phaseName,
        goal,
        homeIntroVideoUrl: homeIntroVideoUrl.trim() || null,
        homeGuideVideoUrl: homeGuideVideoUrl.trim() || null,
        durationWeeks: parseInt(durationWeeks),
        startDate: new Date().toISOString().split("T")[0],
        status: "Draft",
        movementChecks: [],
        schedule: [],
      });
      phaseId = phase.id;
    } else if (params?.phaseId) {
      phaseId = params.phaseId;
      phaseSessions.forEach((ps: any) => {
        if (ps?.id) existingSessionIds.add(String(ps.id));
      });

      await updatePhase.mutateAsync({
        id: phaseId,
        name: phaseName,
        goal,
        homeIntroVideoUrl: homeIntroVideoUrl.trim() || null,
        homeGuideVideoUrl: homeGuideVideoUrl.trim() || null,
        durationWeeks: parseInt(durationWeeks),
      });
    } else {
      return null;
    }

    const savedSessions: any[] = [];
    for (const ls of localSessions) {
      if (ls.dbId && !isNew) {
        const updated = await updateSession.mutateAsync({
          id: ls.dbId,
          name: ls.name,
          description: ls.description.trim() || null,
          durationMinutes: ls.durationMinutes,
          sessionVideoUrl: ls.sessionVideoUrl.trim() || null,
          sections: ls.sections,
        });
        savedSessions.push(updated);
      } else {
        const created = await createSession.mutateAsync({
          phaseId,
          name: ls.name,
          description: ls.description.trim() || null,
          durationMinutes: ls.durationMinutes,
          sessionVideoUrl: ls.sessionVideoUrl.trim() || null,
          sections: ls.sections,
          completedInstances: [],
        });
        savedSessions.push(created);
      }
    }

    const idMap: Record<string, string> = {};
    localSessions.forEach((ls, idx) => {
      const savedId = savedSessions[idx]?.id;
      if (savedId) {
        idMap[ls.id] = savedId;
        if (ls.dbId) idMap[ls.dbId] = savedId;
      }
    });

    const validSessionIds = new Set(savedSessions.map((s: any) => s.id));
    const persistedSchedule = localSchedule
      .map((e) => ({ ...e, sessionId: idMap[e.sessionId] || e.sessionId }))
      .filter((e) => validSessionIds.has(e.sessionId));

    await updatePhase.mutateAsync({
      id: phaseId,
      schedule: persistedSchedule,
    });

    if (!isNew) {
      const savedSessionIds = new Set(
        savedSessions.map((session: any) => String(session?.id || "")).filter(Boolean),
      );
      const sessionsToDelete = Array.from(existingSessionIds).filter(
        (sessionId) => !savedSessionIds.has(sessionId),
      );
      for (const sessionId of sessionsToDelete) {
        await deleteSession.mutateAsync(sessionId);
      }
    }

    const [reloadedPhaseRaw, reloadedSessionsRaw] = await Promise.all([
      queryClient.fetchQuery(phaseQuery(phaseId)),
      queryClient.fetchQuery(sessionsByPhaseQuery(phaseId)),
    ]);
    const reloadedPhase = reloadedPhaseRaw as any;
    const reloadedSessions = (reloadedSessionsRaw as any[]) || [];
    const reloadedSessionIds = new Set(reloadedSessions.map((session: any) => String(session.id)));

    const missingScheduledSessions = persistedSchedule.filter(
      (entry) => !reloadedSessionIds.has(String(entry.sessionId)),
    );
    if (missingScheduledSessions.length > 0) {
      throw new Error(
        "Phase save verification failed: scheduled sessions are missing after reload.",
      );
    }

    const normalizeSchedule = (entries: any[]): ScheduleEntry[] =>
      entries.map((entry) => ({
        day: String(entry.day),
        week: Number(entry.week),
        slot: String(entry.slot || "AM"),
        sessionId: String(entry.sessionId),
      }));
    const sortSchedule = (entries: ScheduleEntry[]) =>
      [...entries].sort(
        (a, b) =>
          a.week - b.week ||
          a.day.localeCompare(b.day) ||
          a.slot.localeCompare(b.slot) ||
          a.sessionId.localeCompare(b.sessionId),
      );

    const reloadedSchedule = normalizeSchedule(
      Array.isArray(reloadedPhase?.schedule) ? reloadedPhase.schedule : [],
    );
    if (
      stableStringify(sortSchedule(reloadedSchedule)) !==
      stableStringify(sortSchedule(persistedSchedule))
    ) {
      throw new Error("Phase save verification failed: weekly schedule did not persist.");
    }

    if (localSessions.length > 0 && reloadedSessions.length === 0) {
      throw new Error("Phase save verification failed: no sessions persisted after reload.");
    }

    queryClient.setQueryData(phaseQuery(phaseId).queryKey, reloadedPhase);
    queryClient.setQueryData(sessionsByPhaseQuery(phaseId).queryKey, reloadedSessions);
    queryClient.setQueryData(phasesQuery.queryKey, (current: any) => {
      if (!Array.isArray(current)) return current;
      const exists = current.some((phase: any) => phase.id === phaseId);
      if (!exists) return [...current, reloadedPhase];
      return current.map((phase: any) => (phase.id === phaseId ? reloadedPhase : phase));
    });
    if (clientId) {
      queryClient.setQueryData(["phases", clientId], (current: any) => {
        if (!Array.isArray(current)) return current;
        const exists = current.some((phase: any) => phase.id === phaseId);
        if (!exists) return [...current, reloadedPhase];
        return current.map((phase: any) => (phase.id === phaseId ? reloadedPhase : phase));
      });
    }

    return { phaseId, savedSessions, persistedSchedule };
  };

  const saveDraft = useCallback(
    async (options?: { silent?: boolean }) => {
      if (saving || !phaseName.trim()) return;
      setSaving(true);

      try {
        const result = await savePhase();
        if (!result) {
          if (!options?.silent) {
            toast({
              title: "Save Failed",
              description: "Could not determine phase target.",
              variant: "destructive",
            });
          }
          return;
        }

        const { phaseId, savedSessions, persistedSchedule } = result;

        setLocalSessions((prev) =>
          prev.map((ls, idx) => ({
            ...ls,
            id: savedSessions[idx]?.id || ls.id,
            dbId: savedSessions[idx]?.id || ls.dbId,
            isNew: false,
          })),
        );
        setLocalSchedule(persistedSchedule);
        setLastSavedAt(new Date());
        justSavedRef.current = true;

        if (isNew) {
          if (!options?.silent) {
            toast({
              title: "Phase Created",
              description: `Phase and ${savedSessions.length} session(s) saved as Draft.`,
            });
          }
          setLocation(`/app/admin/clients/${params?.clientId}/builder/${phaseId}`);
        } else {
          setInitializedForPhase(currentPhaseId);
          if (!options?.silent) {
            toast({
              title: "Phase Saved",
              description: `Phase and ${savedSessions.length} session(s) updated.`,
            });
          }
        }
      } catch (err) {
        if (!options?.silent) {
          toast({
            title: "Save Failed",
            description: getUsefulErrorMessage(err, "Something went wrong. Please try again."),
            variant: "destructive",
          });
        }
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [currentPhaseId, isNew, params?.clientId, phaseName, savePhase, saving, setLocation, toast],
  );

  const autosave = useAutosave({
    snapshot: builderAutosaveSnapshot,
    enabled: !isNew && Boolean(params?.phaseId && params.phaseId !== "new" && phaseName.trim()),
    delayMs: 30_000,
    onSave: () => saveDraft({ silent: true }),
  });

  const handleSave = async () => {
    await saveDraft();
    autosave.markSaved();
  };

  const autosaveLabel =
    autosave.status === "saving"
      ? "Autosaving draft..."
      : autosave.status === "dirty"
        ? "Draft changes pending"
        : autosave.status === "saved"
          ? "Draft autosaved"
          : autosave.status === "error"
            ? "Draft autosave failed"
            : "";

  const autosaveBadgeClass: Record<AutosaveStatus, string> = {
    idle: "border-slate-200 bg-slate-50 text-slate-500",
    dirty: "border-amber-200 bg-amber-50 text-amber-700",
    saving: "border-blue-200 bg-blue-50 text-blue-700",
    saved: "border-green-200 bg-green-50 text-green-700",
    error: "border-red-200 bg-red-50 text-red-700",
  };

  const handlePublish = async () => {
    setPublishing(true);

    try {
      const result = await savePhase();
      if (!result) {
        toast({
          title: "Publish Failed",
          description: "Could not save the phase.",
          variant: "destructive",
        });
        setPublishing(false);
        return;
      }

      let phaseId = result.phaseId;

      setLocalSessions((prev) =>
        prev.map((ls, idx) => ({
          ...ls,
          id: result.savedSessions[idx]?.id || ls.id,
          dbId: result.savedSessions[idx]?.id || ls.dbId,
          isNew: false,
        })),
      );
      setLocalSchedule(result.persistedSchedule);
      setLastSavedAt(new Date());
      justSavedRef.current = true;

      if (isNew) {
        setLocation(`/app/admin/clients/${params?.clientId}/builder/${phaseId}`);
      }

      if (!phaseId || phaseId === "new") {
        toast({
          title: "Publish Failed",
          description: "Phase must be saved before publishing.",
          variant: "destructive",
        });
        setPublishing(false);
        return;
      }

      const checkedExercises = collectMovementCheckExercises(localSessions);

      if (checkedExercises.length > 0) {
        const movementChecks = buildMovementChecksForPublish(
          checkedExercises,
          existingPhase?.movementChecks,
        );
        const needsMovementChecks = movementChecks.some((check) => check.status !== "Approved");

        await updatePhase.mutateAsync({
          id: phaseId,
          status: needsMovementChecks ? "Waiting for Movement Check" : "Active",
          movementChecks,
        });

        toast({
          title: "Phase Published",
          description: needsMovementChecks
            ? `Phase is now waiting for movement check approval. ${movementChecks.length} exercise(s) require video review.`
            : "Phase is now active and visible to the client.",
        });
      } else {
        await updatePhase.mutateAsync({
          id: phaseId,
          status: "Active",
        });

        toast({
          title: "Phase Published",
          description: "Phase is now active and visible to the client.",
        });
      }

      setLastSavedAt(new Date());
      justSavedRef.current = true;
      setPublishDialogOpen(false);
    } catch (err) {
      toast({
        title: "Publish Failed",
        description: getUsefulErrorMessage(err, "Something went wrong. Please try again."),
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleDeletePhase = async () => {
    const phaseId = params?.phaseId;
    if (!phaseId || phaseId === "new") return;

    setDeleting(true);
    try {
      await deletePhase.mutateAsync(phaseId);
      toast({
        title: "Phase Deleted",
        description: "Phase and all associated data have been permanently removed.",
      });
      setDeleteDialogOpen(false);
      setLocation(`/app/admin/clients/${params?.clientId}`);
    } catch (err) {
      toast({
        title: "Delete Failed",
        description: "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const phaseStatus = existingPhase?.status || "Draft";
  const isPublished = phaseStatus === "Active" || phaseStatus === "Waiting for Movement Check";

  const formatSavedTime = (d: Date) => {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleBackToClient = async () => {
    if (saving || publishing || leavingBuilder) {
      toast({ title: "Save in progress", description: "Please wait a moment before leaving." });
      return;
    }

    if (isDirty) {
      if (!phaseName.trim()) {
        if (!confirmLeaveWithUnsavedChanges()) return;
      } else {
        setLeavingBuilder(true);
        try {
          await saveDraft({ silent: true });
          autosave.markSaved();
          setLocation(`/app/admin/clients/${params?.clientId}`);
          return;
        } catch {
          const leaveAnyway = window.confirm(
            "The draft could not be saved. Leave without saving these changes?",
          );
          if (!leaveAnyway) {
            setLeavingBuilder(false);
            return;
          }
        }
      }
    }

    setLocation(`/app/admin/clients/${params?.clientId}`);
  };

  const weekSchedule = localSchedule.filter((e) => e.week === selectedWeek);
  const numWeeks = parseInt(durationWeeks) || 4;

  const totalExercises = localSessions.reduce(
    (sum, s) => sum + s.sections.reduce((sSum, sec) => sSum + sec.exercises.length, 0),
    0,
  );

  const selectedTemplate = phaseTemplates.find(
    (template: any) => template.id === selectedTemplateId,
  );
  const selectedTemplateSessions = (selectedTemplate?.sessions as any[]) || [];
  const selectedTemplateSession = selectedTemplateSessions.find(
    (session: any) => session.id === selectedTemplateSessionId,
  );
  const selectedTemplateSections = (selectedTemplateSession?.sections as any[]) || [];

  const applyWholeTemplate = () => {
    if (!selectedTemplate) return;
    const hasContent =
      localSchedule.length > 0 ||
      homeIntroVideoUrl.trim() !== "" ||
      homeGuideVideoUrl.trim() !== "" ||
      localSessions.some(
        (session) =>
          session.name.trim() !== "" ||
          session.description.trim() !== "" ||
          (session.durationMinutes ?? null) !== null ||
          session.sessionVideoUrl.trim() !== "" ||
          session.sections.some((section) => section.exercises.length > 0),
      );
    if (hasContent && !window.confirm("Apply template and replace current phase builder content?"))
      return;

    const cloned = clonePhaseTemplate({
      sessions: (selectedTemplate.sessions || []) as any[],
      schedule: (selectedTemplate.schedule || []) as any[],
    });
    const nextSessions: LocalSession[] = cloned.sessions.map((session) => ({
      ...session,
      durationMinutes:
        typeof (session as { durationMinutes?: number | null }).durationMinutes === "number" &&
        Number.isFinite((session as { durationMinutes?: number | null }).durationMinutes) &&
        ((session as { durationMinutes?: number | null }).durationMinutes || 0) > 0
          ? Math.floor((session as { durationMinutes?: number | null }).durationMinutes || 0)
          : null,
      sessionVideoUrl: (session as { sessionVideoUrl?: string }).sessionVideoUrl || "",
      dbId: undefined,
      isNew: true,
    }));
    setLocalSessions(nextSessions.length > 0 ? nextSessions : [makeSession("Session 1")]);
    setLocalSchedule(cloned.schedule);
    if (selectedTemplate.goal) setGoal(selectedTemplate.goal);
    setHomeIntroVideoUrl("");
    setHomeGuideVideoUrl("");
    if (selectedTemplate.durationWeeks) setDurationWeeks(String(selectedTemplate.durationWeeks));
    setMovementCheckEnabled(Boolean(selectedTemplate.movementCheckEnabled));
    setInsertTemplateOpen(false);
    toast({
      title: "Template applied",
      description: "Phase blueprint was replaced with template content.",
    });
  };

  const insertSessionFromTemplate = () => {
    const sourceSession = selectedTemplateSessions.find(
      (session: any) => session.id === selectedTemplateSessionId,
    );
    if (!sourceSession) return;
    const cloned = cloneSessionFromTemplate(sourceSession as any);
    const nextSession: LocalSession = {
      ...cloned,
      durationMinutes:
        typeof (cloned as { durationMinutes?: number | null }).durationMinutes === "number" &&
        Number.isFinite((cloned as { durationMinutes?: number | null }).durationMinutes) &&
        ((cloned as { durationMinutes?: number | null }).durationMinutes || 0) > 0
          ? Math.floor((cloned as { durationMinutes?: number | null }).durationMinutes || 0)
          : null,
      sessionVideoUrl: (cloned as { sessionVideoUrl?: string }).sessionVideoUrl || "",
      dbId: undefined,
      isNew: true,
    };
    setLocalSessions((prev) => [...prev, nextSession]);
    setInsertTemplateOpen(false);
    toast({
      title: "Session inserted",
      description: "Template session was inserted into this phase.",
    });
  };

  const insertSectionFromTemplate = () => {
    const sourceSection = selectedTemplateSections.find(
      (section: any) => section.id === selectedTemplateSectionId,
    );
    if (!sourceSection || !selectedTargetSessionId) return;
    const clonedSection = cloneSectionFromTemplate(sourceSection as any);
    setLocalSessions((prev) =>
      prev.map((session) => {
        const sessionId = session.dbId || session.id;
        if (sessionId !== selectedTargetSessionId) return session;
        return { ...session, sections: [...session.sections, clonedSection] };
      }),
    );
    setInsertTemplateOpen(false);
    toast({
      title: "Section inserted",
      description: "Template section was inserted into the selected session.",
    });
  };

  return (
    <div className="space-y-4 w-full pb-24 animate-in fade-in">
      <div className="sticky top-0 z-20 -mx-6 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-6 py-2.5 backdrop-blur-xl md:-mx-8 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full border border-slate-200 bg-white"
            data-testid="button-back-client"
            onClick={handleBackToClient}
            disabled={saving || publishing || leavingBuilder}
          >
            {leavingBuilder ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowLeft className="h-4 w-4" />
            )}
          </Button>
          <div className="truncate font-semibold text-slate-900">Phase Builder</div>
          {isDirty ? (
            <Badge
              variant="outline"
              className="flex items-center gap-1 border-amber-200 bg-amber-50 text-amber-700"
            >
              <AlertCircle className="h-3 w-3" />
              Unsaved
            </Badge>
          ) : lastSavedAt ? (
            <Badge
              variant="outline"
              className="flex items-center gap-1 border-green-200 bg-green-50 text-green-700"
              data-testid="badge-saved"
            >
              <CheckCircle2 className="h-3 w-3" />
              {formatSavedTime(lastSavedAt)}
            </Badge>
          ) : null}
          {autosaveLabel ? (
            <Badge
              variant="outline"
              className={`hidden items-center gap-1 sm:flex ${autosaveBadgeClass[autosave.status]}`}
              data-testid="badge-builder-autosave"
            >
              {autosave.status === "saving" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : autosave.status === "error" ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              {autosaveLabel}
            </Badge>
          ) : null}
          {isPublished && (
            <Badge
              className={
                phaseStatus === "Active"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : "bg-amber-100 text-amber-700 border-amber-200"
              }
            >
              {phaseStatus}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full px-3"
            onClick={() => setInsertTemplateOpen(true)}
            data-testid="button-insert-template"
          >
            <Copy className="mr-1.5 h-4 w-4" /> Templates
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full text-slate-600 hover:text-indigo-600"
            onClick={() => setTemplateSaveTarget({ type: "phase" })}
            disabled={savingTemplate || !phaseName.trim()}
            title="Save phase as template"
            data-testid="button-save-phase-template"
          >
            <Library className="h-4 w-4" />
          </Button>
          {!isNew && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={saving || publishing || deleting}
              data-testid="button-delete-phase"
              title="Delete phase"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full px-4"
            onClick={handleSave}
            disabled={saving || publishing || !phaseName.trim()}
            data-testid="button-save-phase"
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {saving ? "Saving" : "Save"}
          </Button>
          <Button
            size="sm"
            className="h-9 rounded-full bg-indigo-600 px-4 text-white hover:bg-indigo-700"
            onClick={() => setPublishDialogOpen(true)}
            disabled={saving || publishing || !phaseName.trim() || totalExercises === 0}
            data-testid="button-publish-phase"
          >
            <Send className="mr-1.5 h-4 w-4" />
            {isPublished ? "Republish" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Phase
              </Label>
              <Input
                value={phaseName}
                onChange={(e) => setPhaseName(e.target.value)}
                className="h-9 border-slate-300 bg-white font-bold text-slate-950"
                placeholder="Phase Name"
                data-testid="input-phase-name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Goal
              </Label>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="min-h-[72px] border-slate-200 bg-slate-50 text-sm"
                data-testid="input-phase-goal"
              />
            </div>
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Weeks
                </Label>
                <Select value={durationWeeks} onValueChange={setDurationWeeks}>
                  <SelectTrigger
                    className="h-9 border-slate-200 bg-slate-50"
                    data-testid="select-duration"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[4, 6, 8, 12].map((w) => (
                      <SelectItem key={w} value={w.toString()}>
                        {w} Weeks
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Movement check
                </Label>
                <div className="flex h-9 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3">
                  <Switch
                    checked={movementCheckEnabled}
                    onCheckedChange={(checked) => {
                      setMovementCheckEnabled(checked);
                      if (!checked) {
                        setLocalSessions((prev) =>
                          prev.map((s) => ({
                            ...s,
                            sections: s.sections.map((sec) => ({
                              ...sec,
                              exercises: sec.exercises.map((ex) => ({
                                ...ex,
                                requiresMovementCheck: false,
                              })),
                            })),
                          })),
                        );
                      }
                    }}
                    data-testid="switch-movement-check-gate"
                  />
                  <span className="truncate text-sm text-slate-700">
                    {movementCheckEnabled ? "Enabled" : "Off"}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Home video
                </Label>
                <Input
                  value={homeIntroVideoUrl}
                  onChange={(e) => setHomeIntroVideoUrl(e.target.value)}
                  placeholder="Client home video URL"
                  className="h-9 bg-slate-50"
                  data-testid="input-phase-home-video"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Guide video
                </Label>
                <Input
                  value={homeGuideVideoUrl}
                  onChange={(e) => setHomeGuideVideoUrl(e.target.value)}
                  placeholder="General information video URL"
                  className="h-9 bg-slate-50"
                  data-testid="input-phase-guide-video"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {localSessions.length > 0 && (
          <Card
            className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm"
            data-testid="card-schedule-grid"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <h3 className="font-display text-sm font-bold text-slate-900">Schedule</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 rounded-lg bg-slate-100 p-1">
                  {Array.from({ length: numWeeks }, (_, i) => i + 1).map((w) => (
                    <button
                      key={w}
                      onClick={() => setSelectedWeek(w)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${selectedWeek === w ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-900"}`}
                      data-testid={`button-week-${w}`}
                    >
                      W{w}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-8 px-2 text-slate-500 hover:text-slate-900"
                  onClick={copyWeekToAll}
                  title={`Copy Week ${selectedWeek} to all weeks`}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[360px]">
                <div className="grid grid-cols-[74px_1fr_1fr] border-b border-slate-200 bg-slate-50">
                  <div className="border-r border-slate-200 p-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Day
                  </div>
                  <div className="border-r border-slate-200 p-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    AM
                  </div>
                  <div className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    PM
                  </div>
                </div>
                {WEEKDAYS.map((day, dayIdx) => (
                  <div
                    key={day}
                    className={`grid grid-cols-[74px_1fr_1fr] border-b border-slate-100 last:border-b-0 ${dayIdx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                  >
                    <div className="flex items-center border-r border-slate-100 p-2 text-sm font-medium text-slate-700">
                      {getScheduleDayLabel(day)}
                    </div>
                    {SLOTS.map((slot) => {
                      const entries = weekSchedule.filter((e) => e.day === day && e.slot === slot);
                      return (
                        <div
                          key={slot}
                          className="flex min-h-[34px] flex-wrap items-center gap-1 border-r border-slate-100 p-1.5 last:border-r-0"
                        >
                          {entries.map((entry, i) => {
                            const session = localSessions.find(
                              (s) => (s.dbId || s.id) === entry.sessionId,
                            );
                            const sharedAcrossWeeks = localSchedule.some(
                              (candidate) =>
                                candidate.week !== selectedWeek &&
                                candidate.sessionId === entry.sessionId,
                            );
                            return (
                              <Badge
                                key={i}
                                variant="outline"
                                className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1 pr-1 text-xs font-medium"
                                data-testid={`sched-chip-${day}-${slot}-${i}`}
                              >
                                {session?.name || "?"}
                                {sharedAcrossWeeks ? (
                                  <button
                                    onClick={() => makeScheduleEntryWeekSpecific(entry)}
                                    className="ml-0.5 rounded-full hover:bg-indigo-200 p-0.5 transition-colors"
                                    title="Edit this week separately"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                ) : null}
                                <button
                                  onClick={() => removeScheduleEntry(day, slot, entry.sessionId)}
                                  className="ml-0.5 rounded-full hover:bg-indigo-200 p-0.5 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })}
                          <button
                            onClick={() => setAssignSessionTarget({ day, slot })}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                            data-testid={`button-assign-${day}-${slot}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {localSessions.map((session, sessionIdx) => (
        <SessionEditorCard
          key={session.id}
          session={session as any}
          sessionIdx={sessionIdx}
          totalSessions={localSessions.length}
          movementCheckEnabled={movementCheckEnabled}
          sectionTemplates={sectionTemplates as any[]}
          exerciseTemplates={templates as any[]}
          onSessionChange={(updater) => updateLocalSession(sessionIdx, updater as any)}
          onRemoveSession={() => removeSession(sessionIdx)}
          onMoveSessionToIndex={(targetSessionIdx) =>
            moveSessionToIndex(sessionIdx, targetSessionIdx)
          }
          onSaveSessionToTemplate={() => setTemplateSaveTarget({ type: "session", sessionIdx })}
          onSaveSectionToTemplate={(sectionIdx) =>
            setTemplateSaveTarget({ type: "section", sessionIdx, sectionIdx })
          }
          onSaveExerciseToTemplate={(sectionIdx, exerciseIdx) =>
            setTemplateSaveTarget({ type: "exercise", sessionIdx, sectionIdx, exerciseIdx })
          }
          onDuplicateSession={() => {
            setLocalSessions((prev) => {
              const source = prev[sessionIdx];
              if (!source) return prev;
              const next = [...prev];
              next.splice(sessionIdx + 1, 0, cloneLocalSession(source));
              return next;
            });
          }}
          onCreateSection={() => {
            const letters = "ABCDEFGHIJKLMNOP";
            const letter = letters[session.sections.length] || String(session.sections.length + 1);
            return makeSection(`${letter}.`);
          }}
          onCloneSectionTemplate={(templateSection) => cloneSectionFromTemplate(templateSection)}
          onCloneExerciseTemplate={(templateExercise) =>
            cloneExerciseFromTemplate(toBlueprintExercise(templateExercise))
          }
          onCloneExercise={(exercise) => cloneExercise(exercise)}
          onCloneSection={(sourceSection) => cloneSection(sourceSection)}
          showSessionVideoField
        />
      ))}

      <div className="flex justify-center mt-8">
        <Button
          className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-8 py-6 text-base shadow-lg"
          onClick={() => setAddSessionModalOpen(true)}
          data-testid="button-add-session"
        >
          <Plus className="mr-2 h-5 w-5" /> Add Session
        </Button>
      </div>

      <Dialog
        open={assignSessionTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAssignSessionTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Session</DialogTitle>
            <DialogDescription>
              {assignSessionTarget?.day ? getScheduleDayLabel(assignSessionTarget.day) : ""} &mdash;{" "}
              {assignSessionTarget?.slot}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {localSessions.map((session, idx) => (
              <button
                key={session.id}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors flex items-center gap-3 group"
                onClick={() => {
                  if (assignSessionTarget) {
                    addScheduleEntry(
                      assignSessionTarget.day,
                      assignSessionTarget.slot,
                      session.dbId || session.id,
                    );
                    setAssignSessionTarget(null);
                  }
                }}
                data-testid={`assign-session-${idx}`}
              >
                <Badge className="bg-indigo-600 text-white border-none text-xs shrink-0">
                  S{idx + 1}
                </Badge>
                <span className="font-medium text-slate-900 group-hover:text-indigo-700 transition-colors">
                  {session.name}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={insertTemplateOpen} onOpenChange={setInsertTemplateOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Insert From Templates</DialogTitle>
            <DialogDescription>
              Apply a full phase template, or insert a session/section into the current phase
              builder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phase Template</Label>
              <TemplatePickerPanel
                templates={phaseTemplates as any[]}
                folderType="phase"
                allLabel="All Phases"
                searchPlaceholder="Search phase templates..."
                selectedTemplateId={selectedTemplateId || null}
                getTemplateId={(item: any) => item.id}
                getTemplateName={(item: any) => item.name}
                getTemplateMeta={(item: any) => `${(item.sessions || []).length} session(s)`}
                getTemplateFolderId={(item: any) => item.folderId ?? null}
                onSelectTemplate={(item: any) => setSelectedTemplateId(item.id)}
              />
            </div>

            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">Apply whole phase template</p>
                  <p className="text-xs text-slate-500">Replaces current sessions and schedule.</p>
                </div>
                <Button onClick={applyWholeTemplate} disabled={!selectedTemplateId}>
                  Apply
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border rounded-lg p-3 space-y-2">
                <p className="font-medium text-slate-900">Insert session</p>
                <Select
                  value={selectedTemplateSessionId}
                  onValueChange={setSelectedTemplateSessionId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose template session" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedTemplateSessions.map((session: any) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  onClick={insertSessionFromTemplate}
                  disabled={!selectedTemplateSessionId}
                >
                  Insert Session
                </Button>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <p className="font-medium text-slate-900">Insert section</p>
                <Select
                  value={selectedTemplateSessionId}
                  onValueChange={setSelectedTemplateSessionId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Template session" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedTemplateSessions.map((session: any) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedTemplateSectionId}
                  onValueChange={setSelectedTemplateSectionId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Template section" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedTemplateSections.map((section: any) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedTargetSessionId} onValueChange={setSelectedTargetSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Target current session" />
                  </SelectTrigger>
                  <SelectContent>
                    {localSessions.map((session, idx) => (
                      <SelectItem key={session.id} value={session.dbId || session.id}>
                        S{idx + 1}: {session.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  onClick={insertSectionFromTemplate}
                  disabled={!selectedTemplateSectionId || !selectedTargetSessionId}
                >
                  Insert Section
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {templateSaveDialogMeta ? (
        <SaveToTemplateDialog
          open={templateSaveTarget !== null}
          onOpenChange={(open) => {
            if (!open) setTemplateSaveTarget(null);
          }}
          type={templateSaveDialogMeta.type}
          title={templateSaveDialogMeta.title}
          itemName={templateSaveDialogMeta.itemName}
          saving={savingTemplate}
          onSave={(folderId) => void saveCurrentItemToTemplate(folderId)}
        />
      ) : null}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Phase</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{phaseName}"? This will also remove all sessions and
              logs tied to it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeletePhase}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              data-testid="button-confirm-delete"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isPublished ? "Re-publish Phase" : "Publish Phase"}</DialogTitle>
            <DialogDescription>
              {collectMovementCheckExercises(localSessions).length > 0
                ? "This phase will be published with movement check gating. The client will need to submit and have their form videos approved before they can start training."
                : "This phase will go live immediately. The client will be able to see and start logging sessions right away."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-sm font-medium text-slate-700">Phase Name</span>
              <span className="text-sm font-semibold text-slate-900">{phaseName}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-sm font-medium text-slate-700">Sessions</span>
              <span className="text-sm font-semibold text-slate-900">{localSessions.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-sm font-medium text-slate-700">Duration</span>
              <span className="text-sm font-semibold text-slate-900">{durationWeeks} weeks</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-sm font-medium text-slate-700">Scheduled Slots</span>
              <span className="text-sm font-semibold text-slate-900">
                {localSchedule.filter((e) => e.week === 1).length} / week
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-sm font-medium text-slate-700">Movement Checks</span>
              {(() => {
                const count = collectMovementCheckExercises(localSessions).length;
                return (
                  <Badge
                    className={
                      count > 0
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-green-100 text-green-700 border-green-200"
                    }
                  >
                    {count > 0 ? `${count} exercise(s) flagged` : "None — goes Active"}
                  </Badge>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPublishDialogOpen(false)}
              disabled={publishing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={publishing}
              data-testid="button-confirm-publish"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {publishing ? "Publishing..." : "Confirm & Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddFromTemplatesModal
        open={addSessionModalOpen}
        onOpenChange={setAddSessionModalOpen}
        title="Add Session"
        description="Create a new session or insert one from Session Templates."
        createLabel="Create new session"
        allLabel="All Sessions"
        searchPlaceholder="Search session templates..."
        folderType="session"
        templates={sessionTemplates as any[]}
        getTemplateId={(item: any) => item.id}
        getTemplateName={(item: any) => item.name}
        getTemplateMeta={(item: any) => `${(item.sections || []).length} section(s)`}
        getTemplateFolderId={(item: any) => item.folderId ?? null}
        onCreateNew={addSession}
        onInsertTemplate={(item: any) => addSessionFromTemplate(item)}
      />
    </div>
  );
}
