import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { phasesQuery, sessionsByPhaseQuery, exerciseTemplatesQuery, sectionTemplatesQuery, sessionTemplatesQuery, phaseTemplatesQuery, useUpdatePhase, useCreatePhase, useCreateSession, useUpdateSession, useDeleteSession, useDeletePhase, useCreateExerciseTemplate, useCreateSectionTemplate, useCreateSessionTemplate, useCreatePhaseTemplate } from "@/lib/api";
import { cloneExerciseFromTemplate, clonePhaseTemplate, cloneSectionFromTemplate, cloneSessionFromTemplate, toBlueprintExercise } from "@/lib/blueprintClone";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ArrowLeft, Save, Loader2, AlertCircle, Send, CalendarDays, CheckCircle2, X, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AddFromTemplatesModal } from "@/components/admin/AddFromTemplatesModal";
import { SessionEditorCard } from "@/components/admin/builder/SessionEditorCard";

function generateId() {
  return crypto.randomUUID();
}

function stableStringify(obj: any): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
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

function makeExercise(name = "New Exercise"): Exercise {
  return { id: generateId(), name, sets: "3", reps: "10", load: "Auto", tempo: "3010", notes: "", goal: "", additionalInstructions: "", demoUrl: "", enableStructuredLogging: false, requiresMovementCheck: false };
}

function makeSection(name = "New Section"): Section {
  return { id: generateId(), name, exercises: [] };
}

function makeSession(name = "New Session"): LocalSession {
  return {
    id: generateId(),
    name,
    description: "",
    sessionVideoUrl: "",
    sections: [makeSection("A. Main")],
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

export default function AdminPhaseBuilder() {
  const [, params] = useRoute("/app/admin/clients/:clientId/builder/:phaseId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isNew = params?.phaseId === 'new';

  const { data: allPhases = [], isFetching: fetchingPhases } = useQuery(phasesQuery);
  const { data: phaseSessions = [], isLoading: loadingSessions, isFetching: fetchingSessions } = useQuery(sessionsByPhaseQuery(params?.phaseId || ''));
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

  const existingPhase = allPhases.find((p: any) => p.id === params?.phaseId);

  const [phaseName, setPhaseName] = useState("New Phase");
  const [goal, setGoal] = useState("");
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [assignSessionTarget, setAssignSessionTarget] = useState<{ day: string; slot: string } | null>(null);
  const justSavedRef = useRef(false);

  const isDirty = useMemo(() => {
    if ((fetchingSessions || fetchingPhases) && lastSavedAt) return false;

    if (!existingPhase && isNew) {
      return phaseName !== "New Phase" || goal !== "" || durationWeeks !== "4" || localSessions.length > 1 || localSessions[0]?.sections.length > 1 || localSessions[0]?.sections[0]?.exercises.length > 0 || localSchedule.length > 0;
    }
    if (!existingPhase) return false;

    const nameChanged = phaseName !== existingPhase.name;
    const goalChanged = goal !== (existingPhase.goal || "");
    const durationChanged = durationWeeks !== String(existingPhase.durationWeeks);
    if (nameChanged || goalChanged || durationChanged) return true;

    if (fetchingSessions || fetchingPhases) return false;

    if (localSessions.length !== phaseSessions.length) return true;
    for (let i = 0; i < localSessions.length; i++) {
      const ls = localSessions[i];
      const ps = phaseSessions.find((s: any) => s.id === ls.dbId);
      if (!ps) return true;
      if (ls.name !== ps.name) return true;
      if (ls.description !== (ps.description || "")) return true;
      if (ls.sessionVideoUrl !== (ps.sessionVideoUrl || "")) return true;
      if (stableStringify(ls.sections) !== stableStringify(ps.sections)) return true;
    }

    const sortSched = (s: any[]) => [...s].sort((a, b) => a.week - b.week || a.day.localeCompare(b.day) || (a.slot || "AM").localeCompare(b.slot || "AM") || a.sessionId.localeCompare(b.sessionId));
    const dbSched = ((existingPhase.schedule as any[]) || []).map((e: any) => ({ day: e.day, week: e.week, slot: e.slot || "AM", sessionId: e.sessionId }));
    if (stableStringify(sortSched(localSchedule)) !== stableStringify(sortSched(dbSched))) return true;

    return false;
  }, [phaseName, goal, durationWeeks, localSessions, localSchedule, existingPhase, phaseSessions, isNew, fetchingSessions, fetchingPhases, lastSavedAt]);

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

  const currentPhaseId = params?.phaseId || 'new';

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
    const dbHasSessions = scheduleHasSessions || (existingPhase.status !== 'Draft');
    if (phaseSessions.length === 0 && dbHasSessions) return;

    setPhaseName(existingPhase.name);
    setGoal(existingPhase.goal || "");
    setDurationWeeks(String(existingPhase.durationWeeks));

    const hasMovementChecks = (existingPhase.movementChecks as any[])?.length > 0;
    const hasExerciseLevelFlags = phaseSessions.some((s: any) =>
      ((s.sections as any[]) || []).some((sec: any) =>
        (sec.exercises || []).some((ex: any) => ex.requiresMovementCheck)
      )
    );
    setMovementCheckEnabled(hasMovementChecks || hasExerciseLevelFlags || existingPhase.status === 'Waiting for Movement Check');

    if (phaseSessions.length > 0) {
      setLocalSessions(phaseSessions.map((s: any) => ({
        id: s.id,
        dbId: s.id,
        name: s.name,
        description: s.description || "",
        sessionVideoUrl: s.sessionVideoUrl || "",
        sections: ((s.sections as any[]) || []).map((sec: any) => ({
          ...sec,
          exercises: (sec.exercises || []).map((ex: any) => ({
            id: ex.id,
            name: ex.name || "",
            sets: ex.sets || "3",
            reps: ex.reps || "10",
            load: ex.load || "Auto",
            tempo: ex.tempo || "3010",
            notes: ex.notes || "",
            goal: ex.goal || "",
            additionalInstructions: ex.additionalInstructions || "",
            demoUrl: ex.demoUrl || "",
            enableStructuredLogging: ex.enableStructuredLogging || false,
            requiresMovementCheck: ex.requiresMovementCheck || false,
          })),
        })),
      })));
    } else {
      setLocalSessions([makeSession("Session 1")]);
    }

    const existingSchedule = (existingPhase.schedule as any[]) || [];
    setLocalSchedule(existingSchedule.map((e: any) => ({
      day: e.day,
      week: e.week,
      slot: e.slot || "AM",
      sessionId: e.sessionId,
    })));
    setSelectedWeek(1);

    setLastSavedAt(null);
    setInitializedForPhase(currentPhaseId);
  }, [existingPhase, phaseSessions, isNew, currentPhaseId, initializedForPhase, loadingSessions, fetchingSessions, fetchingPhases]);

  useEffect(() => {
    const maxWeek = parseInt(durationWeeks) || 4;
    setLocalSchedule(prev => {
      const filtered = prev.filter(e => e.week <= maxWeek);
      return filtered.length !== prev.length ? filtered : prev;
    });
    if (selectedWeek > maxWeek) setSelectedWeek(maxWeek);
  }, [durationWeeks]);

  const updateLocalSession = useCallback((sessionIdx: number, updater: (s: LocalSession) => LocalSession) => {
    setLocalSessions(prev => prev.map((s, i) => i === sessionIdx ? updater(s) : s));
  }, []);

  const addSession = () => {
    setLocalSessions(prev => [...prev, makeSession(`Session ${prev.length + 1}`)]);
  };

  const addSessionFromTemplate = (template: any) => {
    const cloned = cloneSessionFromTemplate(template);
    setLocalSessions((prev) => [
      ...prev,
      {
        ...cloned,
        sessionVideoUrl: (cloned as { sessionVideoUrl?: string }).sessionVideoUrl || "",
        dbId: undefined,
        isNew: true,
      },
    ]);
  };

  const removeSession = (idx: number) => {
    const removedSession = localSessions[idx];
    const removedId = removedSession.dbId || removedSession.id;
    setLocalSessions(prev => prev.filter((_, i) => i !== idx));
    setLocalSchedule(prev => prev.filter(e => e.sessionId !== removedId));
  };

  const addScheduleEntry = (day: string, slot: string, sessionId: string) => {
    const weeks = parseInt(durationWeeks) || 4;
    setLocalSchedule(prev => {
      const newEntries: ScheduleEntry[] = [];
      for (let w = 1; w <= weeks; w++) {
        if (!prev.find(e => e.day === day && e.week === w && e.slot === slot && e.sessionId === sessionId)) {
          newEntries.push({ day, week: w, slot, sessionId });
        }
      }
      return [...prev, ...newEntries];
    });
  };

  const removeScheduleEntry = (day: string, slot: string, sessionId: string) => {
    setLocalSchedule(prev => prev.filter(e => !(e.day === day && e.slot === slot && e.sessionId === sessionId)));
  };

  const copyWeekToAll = () => {
    const weeks = parseInt(durationWeeks) || 4;
    const week1 = localSchedule.filter(e => e.week === selectedWeek);
    const otherWeeks: ScheduleEntry[] = [];
    for (let w = 1; w <= weeks; w++) {
      if (w === selectedWeek) continue;
      week1.forEach(e => {
        otherWeeks.push({ ...e, week: w });
      });
    }
    setLocalSchedule([...localSchedule.filter(e => e.week === selectedWeek), ...otherWeeks]);
    toast({ title: "Schedule Copied", description: `Week ${selectedWeek}'s schedule applied to all ${weeks} weeks.` });
  };

  const savePhase = async (): Promise<{ phaseId: string; savedSessions: any[]; persistedSchedule: ScheduleEntry[] } | null> => {
    const clientId = params?.clientId;
    let phaseId: string;

    if (isNew && clientId) {
      const phase = await createPhase.mutateAsync({
        clientId,
        name: phaseName,
        goal,
        durationWeeks: parseInt(durationWeeks),
        startDate: new Date().toISOString().split('T')[0],
        status: 'Draft',
        movementChecks: [],
        schedule: [],
      });
      phaseId = phase.id;
    } else if (params?.phaseId) {
      phaseId = params.phaseId;

      const localDbIds = localSessions.map(ls => ls.dbId).filter(Boolean);
      const sessionsToDelete = phaseSessions.filter((ps: any) => !localDbIds.includes(ps.id));
      for (const s of sessionsToDelete) {
        await deleteSession.mutateAsync(s.id);
      }

      await updatePhase.mutateAsync({
        id: phaseId,
        name: phaseName,
        goal,
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
          sessionVideoUrl: ls.sessionVideoUrl.trim() || null,
          sections: ls.sections,
        });
        savedSessions.push(updated);
      } else {
        const created = await createSession.mutateAsync({
          phaseId,
          name: ls.name,
          description: ls.description.trim() || null,
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
      .map(e => ({ ...e, sessionId: idMap[e.sessionId] || e.sessionId }))
      .filter(e => validSessionIds.has(e.sessionId));

    await updatePhase.mutateAsync({
      id: phaseId,
      schedule: persistedSchedule,
    });

    return { phaseId, savedSessions, persistedSchedule };
  };

  const handleSave = async () => {
    if (saving || !phaseName.trim()) return;
    setSaving(true);

    try {
      const result = await savePhase();
      if (!result) {
        toast({ title: "Save Failed", description: "Could not determine phase target.", variant: "destructive" });
        return;
      }

      const { phaseId, savedSessions, persistedSchedule } = result;

      setLocalSessions(prev => prev.map((ls, idx) => ({
        ...ls,
        id: savedSessions[idx]?.id || ls.id,
        dbId: savedSessions[idx]?.id || ls.dbId,
        isNew: false,
      })));
      setLocalSchedule(persistedSchedule);
      setLastSavedAt(new Date());
      justSavedRef.current = true;

      if (isNew) {
        toast({ title: "Phase Created", description: `Phase and ${savedSessions.length} session(s) saved as Draft.` });
        setLocation(`/app/admin/clients/${params?.clientId}/builder/${phaseId}`);
      } else {
        setInitializedForPhase(currentPhaseId);
        toast({ title: "Phase Saved", description: `Phase and ${savedSessions.length} session(s) updated.` });
      }
    } catch (err) {
      toast({
        title: "Save Failed",
        description: getUsefulErrorMessage(err, "Something went wrong. Please try again."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);

    try {
      let phaseId = params?.phaseId;

      if (isNew || isDirty) {
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
        phaseId = result.phaseId;

        setLocalSessions(prev => prev.map((ls, idx) => ({
          ...ls,
          id: result.savedSessions[idx]?.id || ls.id,
          dbId: result.savedSessions[idx]?.id || ls.dbId,
          isNew: false,
        })));
        setLocalSchedule(result.persistedSchedule);
        setLastSavedAt(new Date());
        justSavedRef.current = true;

        if (isNew) {
          setLocation(`/app/admin/clients/${params?.clientId}/builder/${phaseId}`);
        }
      }

      if (!phaseId || phaseId === 'new') {
        toast({ title: "Publish Failed", description: "Phase must be saved before publishing.", variant: "destructive" });
        setPublishing(false);
        return;
      }

      const checkedExercises = collectMovementCheckExercises(localSessions);

      if (checkedExercises.length > 0) {
        const movementChecks = checkedExercises.map(ex => ({
          exerciseId: ex.id,
          name: ex.name,
          status: "Not Submitted",
          videoUrl: "",
          feedback: "",
          clientNote: "",
          submittedAt: "",
        }));

        await updatePhase.mutateAsync({
          id: phaseId,
          status: "Waiting for Movement Check",
          movementChecks,
        });

        toast({
          title: "Phase Published",
          description: `Phase is now waiting for movement check approval. ${movementChecks.length} exercise(s) require video review.`,
        });
      } else {
        await updatePhase.mutateAsync({
          id: phaseId,
          status: "Active",
          movementChecks: [],
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
    if (!phaseId || phaseId === 'new') return;

    setDeleting(true);
    try {
      await deletePhase.mutateAsync(phaseId);
      toast({ title: "Phase Deleted", description: "Phase and all associated data have been permanently removed." });
      setDeleteDialogOpen(false);
      setLocation(`/app/admin/clients/${params?.clientId}`);
    } catch (err) {
      toast({ title: "Delete Failed", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const phaseStatus = existingPhase?.status || 'Draft';
  const isPublished = phaseStatus === 'Active' || phaseStatus === 'Waiting for Movement Check';

  const formatSavedTime = (d: Date) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const weekSchedule = localSchedule.filter(e => e.week === selectedWeek);
  const numWeeks = parseInt(durationWeeks) || 4;

  const totalExercises = localSessions.reduce((sum, s) => sum + s.sections.reduce((sSum, sec) => sSum + sec.exercises.length, 0), 0);

  const selectedTemplate = phaseTemplates.find((template: any) => template.id === selectedTemplateId);
  const selectedTemplateSessions = ((selectedTemplate?.sessions as any[]) || []);
  const selectedTemplateSession = selectedTemplateSessions.find((session: any) => session.id === selectedTemplateSessionId);
  const selectedTemplateSections = ((selectedTemplateSession?.sections as any[]) || []);

  const applyWholeTemplate = () => {
    if (!selectedTemplate) return;
    const hasContent = localSchedule.length > 0 || localSessions.some((session) =>
      session.name.trim() !== "" ||
      session.description.trim() !== "" ||
      session.sessionVideoUrl.trim() !== "" ||
      session.sections.some((section) => section.exercises.length > 0),
    );
    if (hasContent && !window.confirm("Apply template and replace current phase builder content?")) return;

    const cloned = clonePhaseTemplate({
      sessions: (selectedTemplate.sessions || []) as any[],
      schedule: (selectedTemplate.schedule || []) as any[],
    });
    const nextSessions: LocalSession[] = cloned.sessions.map((session) => ({
      ...session,
      sessionVideoUrl: (session as { sessionVideoUrl?: string }).sessionVideoUrl || "",
      dbId: undefined,
      isNew: true,
    }));
    setLocalSessions(nextSessions.length > 0 ? nextSessions : [makeSession("Session 1")]);
    setLocalSchedule(cloned.schedule);
    if (selectedTemplate.goal) setGoal(selectedTemplate.goal);
    if (selectedTemplate.durationWeeks) setDurationWeeks(String(selectedTemplate.durationWeeks));
    setMovementCheckEnabled(Boolean(selectedTemplate.movementCheckEnabled));
    setInsertTemplateOpen(false);
    toast({ title: "Template applied", description: "Phase blueprint was replaced with template content." });
  };

  const insertSessionFromTemplate = () => {
    const sourceSession = selectedTemplateSessions.find((session: any) => session.id === selectedTemplateSessionId);
    if (!sourceSession) return;
    const cloned = cloneSessionFromTemplate(sourceSession as any);
    const nextSession: LocalSession = {
      ...cloned,
      sessionVideoUrl: (cloned as { sessionVideoUrl?: string }).sessionVideoUrl || "",
      dbId: undefined,
      isNew: true,
    };
    setLocalSessions((prev) => [...prev, nextSession]);
    setInsertTemplateOpen(false);
    toast({ title: "Session inserted", description: "Template session was inserted into this phase." });
  };

  const insertSectionFromTemplate = () => {
    const sourceSection = selectedTemplateSections.find((section: any) => section.id === selectedTemplateSectionId);
    if (!sourceSection || !selectedTargetSessionId) return;
    const clonedSection = cloneSectionFromTemplate(sourceSection as any);
    setLocalSessions((prev) => prev.map((session) => {
      const sessionId = session.dbId || session.id;
      if (sessionId !== selectedTargetSessionId) return session;
      return { ...session, sections: [...session.sections, clonedSection] };
    }));
    setInsertTemplateOpen(false);
    toast({ title: "Section inserted", description: "Template section was inserted into the selected session." });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 animate-in fade-in">
      <div className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-xl border-b border-slate-200 py-4 -mx-6 px-6 md:-mx-8 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/app/admin/clients/${params?.clientId}`}>
            <Button variant="ghost" size="icon" className="rounded-full bg-white border border-slate-200" data-testid="button-back-client"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="font-semibold text-slate-900">Phase Builder</div>
          {isDirty ? (
            <Badge variant="outline" className="ml-2 border-amber-200 bg-amber-50 text-amber-700 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Unsaved changes
            </Badge>
          ) : lastSavedAt ? (
            <Badge variant="outline" className="ml-2 border-green-200 bg-green-50 text-green-700 flex items-center gap-1" data-testid="badge-saved">
              <CheckCircle2 className="h-3 w-3" />
              Saved at {formatSavedTime(lastSavedAt)}
            </Badge>
          ) : null}
          {isPublished && (
            <Badge className={phaseStatus === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
              {phaseStatus}
            </Badge>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="rounded-full px-4"
            onClick={() => setInsertTemplateOpen(true)}
            data-testid="button-insert-template"
          >
            <Copy className="mr-2 h-4 w-4" /> Insert from Templates
          </Button>
          {!isNew && (
            <Button
              variant="outline"
              className="rounded-full px-4 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={saving || publishing || deleting}
              data-testid="button-delete-phase"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-full px-6"
            onClick={handleSave}
            disabled={saving || publishing || !phaseName.trim()}
            data-testid="button-save-phase"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6"
            onClick={() => setPublishDialogOpen(true)}
            disabled={saving || publishing || !phaseName.trim() || totalExercises === 0}
            data-testid="button-publish-phase"
          >
            <Send className="mr-2 h-4 w-4" />
            {isPublished ? "Re-publish" : "Publish Phase"}
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-900 text-white">
          <Input
            value={phaseName}
            onChange={(e) => setPhaseName(e.target.value)}
            className="text-2xl font-display font-bold bg-transparent border-none text-white focus-visible:ring-0 px-0 h-auto placeholder:text-slate-500"
            placeholder="Phase Name"
            data-testid="input-phase-name"
          />
        </div>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-slate-600">Goal</Label>
            <Input value={goal} onChange={e => setGoal(e.target.value)} className="bg-slate-50" data-testid="input-phase-goal" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-600">Duration (Weeks)</Label>
            <Select value={durationWeeks} onValueChange={setDurationWeeks}>
              <SelectTrigger className="bg-slate-50" data-testid="select-duration"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[4, 6, 8, 12].map(w => <SelectItem key={w} value={w.toString()}>{w} Weeks</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-600">Movement Check (optional)</Label>
            <div className="flex items-center gap-3 h-9 px-3 bg-slate-50 border border-slate-200 rounded-md">
              <Switch
                checked={movementCheckEnabled}
                onCheckedChange={(checked) => {
                  setMovementCheckEnabled(checked);
                  if (!checked) {
                    setLocalSessions(prev => prev.map(s => ({
                      ...s,
                      sections: s.sections.map(sec => ({
                        ...sec,
                        exercises: sec.exercises.map(ex => ({ ...ex, requiresMovementCheck: false })),
                      })),
                    })));
                  }
                }}
                data-testid="switch-movement-check-gate"
              />
              <span className="text-sm text-slate-700">{movementCheckEnabled ? "Per-exercise video checks" : "Disabled"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {localSessions.length > 0 && (
        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden" data-testid="card-schedule-grid">
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-indigo-400" />
              <h3 className="font-display font-bold text-lg">Weekly Schedule</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-800 rounded-lg p-1 gap-0.5">
                {Array.from({ length: numWeeks }, (_, i) => i + 1).map(w => (
                  <button
                    key={w}
                    onClick={() => setSelectedWeek(w)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${selectedWeek === w ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    data-testid={`button-week-${w}`}
                  >
                    W{w}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white ml-2"
                onClick={copyWeekToAll}
                title={`Copy Week ${selectedWeek} to all weeks`}
              >
                <Copy className="h-4 w-4 mr-1" /> Copy to all
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="grid grid-cols-[110px_1fr_1fr] border-b border-slate-200 bg-slate-50">
                <div className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200">Day</div>
                <div className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center border-r border-slate-200">AM</div>
                <div className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">PM</div>
              </div>
              {WEEKDAYS.map((day, dayIdx) => (
                <div key={day} className={`grid grid-cols-[110px_1fr_1fr] border-b border-slate-100 last:border-b-0 ${dayIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <div className="p-3 text-sm font-medium text-slate-700 border-r border-slate-100 flex items-center">
                    <span className="text-xs text-slate-400 mr-2 font-mono w-5">{dayIdx + 1}</span>
                    {day}
                  </div>
                  {SLOTS.map(slot => {
                    const entries = weekSchedule.filter(e => e.day === day && e.slot === slot);
                    return (
                      <div key={slot} className="p-2 border-r last:border-r-0 border-slate-100 min-h-[52px] flex flex-wrap items-center gap-1.5">
                        {entries.map((entry, i) => {
                          const session = localSessions.find(s => (s.dbId || s.id) === entry.sessionId);
                          return (
                            <Badge key={i} variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1 pr-1 text-xs font-medium" data-testid={`sched-chip-${day}-${slot}-${i}`}>
                              {session?.name || "?"}
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
                          className="h-7 w-7 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors shrink-0"
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
          onCreateSection={() => {
            const letters = "ABCDEFGHIJKLMNOP";
            const letter = letters[session.sections.length] || String(session.sections.length + 1);
            return makeSection(`${letter}.`);
          }}
          onCloneSectionTemplate={(templateSection) => cloneSectionFromTemplate(templateSection)}
          onCloneExerciseTemplate={(templateExercise) => cloneExerciseFromTemplate(toBlueprintExercise(templateExercise))}
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

      <Dialog open={assignSessionTarget !== null} onOpenChange={(open) => { if (!open) setAssignSessionTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Session</DialogTitle>
            <DialogDescription>
              {assignSessionTarget?.day} &mdash; {assignSessionTarget?.slot}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {localSessions.map((session, idx) => (
              <button
                key={session.id}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors flex items-center gap-3 group"
                onClick={() => {
                  if (assignSessionTarget) {
                    addScheduleEntry(assignSessionTarget.day, assignSessionTarget.slot, session.dbId || session.id);
                    setAssignSessionTarget(null);
                  }
                }}
                data-testid={`assign-session-${idx}`}
              >
                <Badge className="bg-indigo-600 text-white border-none text-xs shrink-0">S{idx + 1}</Badge>
                <span className="font-medium text-slate-900 group-hover:text-indigo-700 transition-colors">{session.name}</span>
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
              Apply a full phase template, or insert a session/section into the current phase builder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Phase Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a phase template" />
                </SelectTrigger>
                <SelectContent>
                  {phaseTemplates.map((template: any) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Select value={selectedTemplateSessionId} onValueChange={setSelectedTemplateSessionId}>
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
                <Button className="w-full" onClick={insertSessionFromTemplate} disabled={!selectedTemplateSessionId}>
                  Insert Session
                </Button>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <p className="font-medium text-slate-900">Insert section</p>
                <Select value={selectedTemplateSessionId} onValueChange={setSelectedTemplateSessionId}>
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
                <Select value={selectedTemplateSectionId} onValueChange={setSelectedTemplateSectionId}>
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
                <Button className="w-full" onClick={insertSectionFromTemplate} disabled={!selectedTemplateSectionId || !selectedTargetSessionId}>
                  Insert Section
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Phase</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{phaseName}"? This will also remove all sessions and logs tied to it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDeletePhase}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              data-testid="button-confirm-delete"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
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
              <span className="text-sm font-semibold text-slate-900">{localSchedule.filter(e => e.week === 1).length} / week</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-sm font-medium text-slate-700">Movement Checks</span>
              {(() => {
                const count = collectMovementCheckExercises(localSessions).length;
                return (
                  <Badge className={count > 0 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-green-100 text-green-700 border-green-200"}>
                    {count > 0 ? `${count} exercise(s) flagged` : "None — goes Active"}
                  </Badge>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)} disabled={publishing}>
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={publishing}
              data-testid="button-confirm-publish"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
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
        searchPlaceholder="Search session templates..."
        templates={sessionTemplates as any[]}
        getTemplateId={(item: any) => item.id}
        getTemplateName={(item: any) => item.name}
        getTemplateMeta={(item: any) => `${(item.sections || []).length} section(s)`}
        onCreateNew={addSession}
        onInsertTemplate={(item: any) => addSessionFromTemplate(item)}
      />

    </div>
  );
}
