import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { phasesQuery, sessionsByPhaseQuery, exerciseTemplatesQuery, useUpdatePhase, useCreatePhase, useCreateSession, useUpdateSession, useDeleteSession, useDeletePhase } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, GripVertical, Trash2, ArrowLeft, Save, Loader2, AlertCircle, Send, CalendarDays, CheckCircle2, X, Copy, Video, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

function generateId() {
  return crypto.randomUUID();
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
  return { id: generateId(), name, description: "", sections: [makeSection("A. Main")], isNew: true };
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

  const { data: allPhases = [] } = useQuery(phasesQuery);
  const { data: phaseSessions = [], isLoading: loadingSessions, isFetching: fetchingSessions } = useQuery(sessionsByPhaseQuery(params?.phaseId || ''));
  const { data: templates = [] } = useQuery(exerciseTemplatesQuery);
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
  const [collapsedSessions, setCollapsedSessions] = useState<Record<string, boolean>>({});

  const toggleSessionCollapse = (sessionId: string) => {
    setCollapsedSessions(prev => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  const isDirty = useMemo(() => {
    if (!existingPhase && isNew) {
      return phaseName !== "New Phase" || goal !== "" || durationWeeks !== "4" || localSessions.length > 1 || localSessions[0]?.sections.length > 1 || localSessions[0]?.sections[0]?.exercises.length > 0 || localSchedule.length > 0;
    }
    if (!existingPhase) return false;

    const nameChanged = phaseName !== existingPhase.name;
    const goalChanged = goal !== (existingPhase.goal || "");
    const durationChanged = durationWeeks !== String(existingPhase.durationWeeks);
    if (nameChanged || goalChanged || durationChanged) return true;

    if (localSessions.length !== phaseSessions.length) return true;
    for (let i = 0; i < localSessions.length; i++) {
      const ls = localSessions[i];
      const ps = phaseSessions.find((s: any) => s.id === ls.dbId);
      if (!ps) return true;
      if (ls.name !== ps.name) return true;
      if (ls.description !== (ps.description || "")) return true;
      if (JSON.stringify(ls.sections) !== JSON.stringify(ps.sections)) return true;
    }

    const sortSched = (s: any[]) => [...s].sort((a, b) => a.week - b.week || a.day.localeCompare(b.day) || (a.slot || "AM").localeCompare(b.slot || "AM") || a.sessionId.localeCompare(b.sessionId));
    const dbSched = ((existingPhase.schedule as any[]) || []).map((e: any) => ({ day: e.day, week: e.week, slot: e.slot || "AM", sessionId: e.sessionId }));
    if (JSON.stringify(sortSched(localSchedule)) !== JSON.stringify(sortSched(dbSched))) return true;

    return false;
  }, [phaseName, goal, durationWeeks, localSessions, localSchedule, existingPhase, phaseSessions, isNew]);

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

  const [addExerciseTarget, setAddExerciseTarget] = useState<{ sessionIdx: number; sectionIdx: number } | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");

  const currentPhaseId = params?.phaseId || 'new';

  useEffect(() => {
    if (initializedForPhase === currentPhaseId) return;

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
    if (loadingSessions || fetchingSessions) return;

    setPhaseName(existingPhase.name);
    setGoal(existingPhase.goal || "");
    setDurationWeeks(String(existingPhase.durationWeeks));

    const hasMovementChecks = (existingPhase.movementChecks as any[])?.length > 0;
    setMovementCheckEnabled(hasMovementChecks || existingPhase.status === 'Waiting for Movement Check');

    if (phaseSessions.length > 0) {
      setLocalSessions(phaseSessions.map((s: any) => ({
        id: s.id,
        dbId: s.id,
        name: s.name,
        description: s.description || "",
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
  }, [existingPhase, phaseSessions, isNew, currentPhaseId, initializedForPhase, loadingSessions, fetchingSessions]);

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

  const removeSession = (idx: number) => {
    const removedSession = localSessions[idx];
    const removedId = removedSession.dbId || removedSession.id;
    setLocalSessions(prev => prev.filter((_, i) => i !== idx));
    setLocalSchedule(prev => prev.filter(e => e.sessionId !== removedId));
  };

  const addSection = (sessionIdx: number) => {
    const letters = "ABCDEFGHIJKLMNOP";
    updateLocalSession(sessionIdx, s => {
      const letter = letters[s.sections.length] || String(s.sections.length + 1);
      return { ...s, sections: [...s.sections, makeSection(`${letter}.`)] };
    });
  };

  const removeSection = (sessionIdx: number, sectionIdx: number) => {
    updateLocalSession(sessionIdx, s => ({
      ...s,
      sections: s.sections.filter((_, i) => i !== sectionIdx),
    }));
  };

  const updateSectionName = (sessionIdx: number, sectionIdx: number, name: string) => {
    updateLocalSession(sessionIdx, s => ({
      ...s,
      sections: s.sections.map((sec, i) => i === sectionIdx ? { ...sec, name } : sec),
    }));
  };

  const addExercise = (sessionIdx: number, sectionIdx: number, name: string) => {
    updateLocalSession(sessionIdx, s => ({
      ...s,
      sections: s.sections.map((sec, i) =>
        i === sectionIdx ? { ...sec, exercises: [...sec.exercises, makeExercise(name)] } : sec
      ),
    }));
  };

  const removeExercise = (sessionIdx: number, sectionIdx: number, exerciseIdx: number) => {
    updateLocalSession(sessionIdx, s => ({
      ...s,
      sections: s.sections.map((sec, si) =>
        si === sectionIdx ? { ...sec, exercises: sec.exercises.filter((_, ei) => ei !== exerciseIdx) } : sec
      ),
    }));
  };

  const moveExercise = (sessionIdx: number, sectionIdx: number, exerciseIdx: number, direction: 'up' | 'down') => {
    updateLocalSession(sessionIdx, s => ({
      ...s,
      sections: s.sections.map((sec, si) => {
        if (si !== sectionIdx) return sec;
        const exercises = [...sec.exercises];
        const targetIdx = direction === 'up' ? exerciseIdx - 1 : exerciseIdx + 1;
        if (targetIdx < 0 || targetIdx >= exercises.length) return sec;
        [exercises[exerciseIdx], exercises[targetIdx]] = [exercises[targetIdx], exercises[exerciseIdx]];
        return { ...sec, exercises };
      }),
    }));
  };

  const updateExerciseField = (sessionIdx: number, sectionIdx: number, exerciseIdx: number, field: keyof Exercise, value: any) => {
    updateLocalSession(sessionIdx, s => ({
      ...s,
      sections: s.sections.map((sec, si) =>
        si === sectionIdx ? {
          ...sec,
          exercises: sec.exercises.map((ex, ei) =>
            ei === exerciseIdx ? { ...ex, [field]: value } : ex
          ),
        } : sec
      ),
    }));
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
          description: ls.description,
          sections: ls.sections,
        });
        savedSessions.push(updated);
      } else {
        const created = await createSession.mutateAsync({
          phaseId,
          name: ls.name,
          description: ls.description,
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

      if (isNew) {
        setInitializedForPhase(phaseId);
        toast({ title: "Phase Created", description: `Phase and ${savedSessions.length} session(s) saved as Draft.` });
        setLocation(`/app/admin/clients/${params?.clientId}/builder/${phaseId}`);
      } else {
        toast({ title: "Phase Saved", description: `Phase and ${savedSessions.length} session(s) updated.` });
      }
    } catch (err) {
      toast({ title: "Save Failed", description: "Something went wrong. Please try again.", variant: "destructive" });
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
          toast({ title: "Publish Failed", description: "Could not save the phase.", variant: "destructive" });
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

        if (isNew) {
          setInitializedForPhase(phaseId);
          setLocation(`/app/admin/clients/${params?.clientId}/builder/${phaseId}`);
        }
      }

      if (!phaseId || phaseId === 'new') {
        toast({ title: "Publish Failed", description: "Phase must be saved before publishing.", variant: "destructive" });
        setPublishing(false);
        return;
      }

      if (movementCheckEnabled) {
        const checkedExercises = collectMovementCheckExercises(localSessions);
        if (checkedExercises.length === 0) {
          toast({ title: "No Exercises Selected", description: "Movement check is enabled but no exercises are marked. Please select exercises or disable the gate.", variant: "destructive" });
          setPublishing(false);
          return;
        }
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
      setPublishDialogOpen(false);
    } catch (err) {
      toast({ title: "Publish Failed", description: "Something went wrong. Please try again.", variant: "destructive" });
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

  const filteredTemplates = templates.filter((t: any) =>
    t.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const phaseStatus = existingPhase?.status || 'Draft';
  const isPublished = phaseStatus === 'Active' || phaseStatus === 'Waiting for Movement Check';

  const formatSavedTime = (d: Date) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const weekSchedule = localSchedule.filter(e => e.week === selectedWeek);
  const numWeeks = parseInt(durationWeeks) || 4;

  const totalExercises = localSessions.reduce((sum, s) => sum + s.sections.reduce((sSum, sec) => sSum + sec.exercises.length, 0), 0);

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
            <Label className="text-slate-600">Movement Check</Label>
            <div className="flex items-center gap-3 h-9 px-3 bg-slate-50 border border-slate-200 rounded-md">
              <Switch
                checked={movementCheckEnabled}
                onCheckedChange={setMovementCheckEnabled}
                data-testid="switch-movement-check-gate"
              />
              <span className="text-sm text-slate-700">{movementCheckEnabled ? "Require video approval" : "Disabled"}</span>
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

      {localSessions.map((session, sessionIdx) => {
        const isCollapsed = collapsedSessions[session.id] ?? false;
        const exerciseCount = session.sections.reduce((sum, sec) => sum + sec.exercises.length, 0);

        return (
          <Card key={session.id} className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden" data-testid={`card-session-${sessionIdx}`}>
            <div
              className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-3 cursor-pointer select-none"
              onClick={() => toggleSessionCollapse(session.id)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {isCollapsed ? <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" /> : <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />}
                <Badge variant="secondary" className="bg-indigo-600 text-white border-none shrink-0 text-xs">S{sessionIdx + 1}</Badge>
                <Input
                  value={session.name}
                  onChange={(e) => updateLocalSession(sessionIdx, s => ({ ...s, name: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                  className="text-lg font-display font-bold text-white border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-400 px-2 h-auto bg-transparent placeholder:text-slate-400"
                  placeholder="Session name..."
                  data-testid={`input-session-name-${sessionIdx}`}
                />
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-400">
                  {session.sections.length} section{session.sections.length !== 1 ? 's' : ''} / {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                </span>
                {localSessions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                    onClick={(e) => { e.stopPropagation(); removeSession(sessionIdx); }}
                    data-testid={`button-remove-session-${sessionIdx}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {!isCollapsed && (
              <div className="p-6 space-y-4">
                {session.sections.map((section, sectionIdx) => (
                  <div key={section.id} className="border-2 border-slate-200 rounded-2xl bg-slate-50/50 p-4 relative" data-testid={`section-${sessionIdx}-${sectionIdx}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <Input
                        value={section.name}
                        onChange={(e) => updateSectionName(sessionIdx, sectionIdx, e.target.value)}
                        className="text-sm font-bold uppercase tracking-wider text-slate-700 border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300 px-2 h-8 bg-transparent max-w-[200px]"
                        data-testid={`input-section-name-${sessionIdx}-${sectionIdx}`}
                      />
                      <div className="flex-1" />
                      {session.sections.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-7 text-slate-400 hover:text-rose-600" onClick={() => removeSection(sessionIdx, sectionIdx)} data-testid={`button-remove-section-${sessionIdx}-${sectionIdx}`}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      )}
                    </div>

                    <div>
                      {section.exercises.map((ex, exIdx) => (
                        <div key={ex.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-3 shadow-sm group" data-testid={`exercise-${sessionIdx}-${sectionIdx}-${exIdx}`}>
                          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button
                                  onClick={() => moveExercise(sessionIdx, sectionIdx, exIdx, 'up')}
                                  disabled={exIdx === 0}
                                  className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
                                  data-testid={`button-move-up-${sessionIdx}-${sectionIdx}-${exIdx}`}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => moveExercise(sessionIdx, sectionIdx, exIdx, 'down')}
                                  disabled={exIdx === section.exercises.length - 1}
                                  className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
                                  data-testid={`button-move-down-${sessionIdx}-${sectionIdx}-${exIdx}`}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <Input
                                value={ex.name}
                                onChange={(e) => updateExerciseField(sessionIdx, sectionIdx, exIdx, "name", e.target.value)}
                                className="font-semibold text-slate-900 border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300 px-1 h-8 bg-transparent"
                                data-testid={`input-exercise-name-${sessionIdx}-${sectionIdx}-${exIdx}`}
                              />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {movementCheckEnabled && (
                                <div className="flex items-center gap-1.5 mr-2" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={ex.requiresMovementCheck}
                                    onCheckedChange={(checked) => updateExerciseField(sessionIdx, sectionIdx, exIdx, "requiresMovementCheck", !!checked)}
                                    data-testid={`checkbox-movement-check-${sessionIdx}-${sectionIdx}-${exIdx}`}
                                  />
                                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold whitespace-nowrap">Video check</span>
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeExercise(sessionIdx, sectionIdx, exIdx)}
                                data-testid={`button-remove-exercise-${sessionIdx}-${sectionIdx}-${exIdx}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="p-4 bg-white grid grid-cols-2 md:grid-cols-4 gap-4">
                            {([
                              { key: "sets", label: "Sets" },
                              { key: "reps", label: "Reps" },
                              { key: "load", label: "Load" },
                              { key: "tempo", label: "Tempo" },
                            ] as const).map(({ key, label }) => (
                              <div key={key} className="space-y-1.5">
                                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</Label>
                                <Input
                                  value={ex[key]}
                                  onChange={(e) => updateExerciseField(sessionIdx, sectionIdx, exIdx, key, e.target.value)}
                                  className="h-9 bg-slate-50 border-slate-200 font-medium"
                                  data-testid={`input-${key}-${sessionIdx}-${sectionIdx}-${exIdx}`}
                                />
                              </div>
                            ))}
                          </div>

                          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 space-y-3">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Goal</Label>
                              <Input
                                value={ex.goal}
                                onChange={(e) => updateExerciseField(sessionIdx, sectionIdx, exIdx, "goal", e.target.value)}
                                placeholder="e.g. Hit 3x10 at RPE 7, increase load by 2.5kg next week"
                                className="h-8 text-sm bg-white border-slate-200 text-slate-600"
                                data-testid={`input-goal-${sessionIdx}-${sectionIdx}-${exIdx}`}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Additional Instructions</Label>
                              <Textarea
                                value={ex.additionalInstructions}
                                onChange={(e) => updateExerciseField(sessionIdx, sectionIdx, exIdx, "additionalInstructions", e.target.value)}
                                placeholder="Cues, form tips, modifications..."
                                className="min-h-[60px] text-sm bg-white border-slate-200 text-slate-600 resize-none"
                                data-testid={`input-instructions-${sessionIdx}-${sectionIdx}-${exIdx}`}
                              />
                            </div>
                            <Input
                              value={ex.notes}
                              onChange={(e) => updateExerciseField(sessionIdx, sectionIdx, exIdx, "notes", e.target.value)}
                              placeholder="Coaching notes..."
                              className="h-8 text-sm bg-white border-slate-200 text-slate-600"
                              data-testid={`input-notes-${sessionIdx}-${sectionIdx}-${exIdx}`}
                            />
                            <div className="flex items-center gap-2">
                              <Video className="h-4 w-4 text-slate-400 shrink-0" />
                              <Input
                                value={ex.demoUrl || ""}
                                onChange={(e) => updateExerciseField(sessionIdx, sectionIdx, exIdx, "demoUrl", e.target.value)}
                                placeholder="Demo video URL (YouTube, Vimeo, etc.)"
                                className="h-8 text-sm bg-white border-slate-200 text-slate-600"
                                data-testid={`input-demo-url-${sessionIdx}-${sectionIdx}-${exIdx}`}
                              />
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <Label className="text-xs text-slate-500">Enable structured set logging for client</Label>
                              <Switch
                                checked={ex.enableStructuredLogging}
                                onCheckedChange={(checked) => updateExerciseField(sessionIdx, sectionIdx, exIdx, "enableStructuredLogging", checked)}
                                data-testid={`switch-structured-logging-${sessionIdx}-${sectionIdx}-${exIdx}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      className="w-full mt-2 border-dashed border-slate-300 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300"
                      onClick={() => {
                        setAddExerciseTarget({ sessionIdx, sectionIdx });
                        setExerciseSearch("");
                      }}
                      data-testid={`button-add-exercise-${sessionIdx}-${sectionIdx}`}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Exercise
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full border-dashed border-slate-300 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 rounded-xl"
                  onClick={() => addSection(sessionIdx)}
                  data-testid={`button-add-section-${sessionIdx}`}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Section
                </Button>
              </div>
            )}
          </Card>
        );
      })}

      <div className="flex justify-center mt-8">
        <Button
          className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-8 py-6 text-base shadow-lg"
          onClick={addSession}
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
              {movementCheckEnabled
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
              <Badge className={movementCheckEnabled ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-green-100 text-green-700 border-green-200"}>
                {movementCheckEnabled ? `${collectMovementCheckExercises(localSessions).length} exercise(s)` : "Disabled"}
              </Badge>
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

      <Dialog open={addExerciseTarget !== null} onOpenChange={(open) => { if (!open) setAddExerciseTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Exercise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search exercises or type a custom name..."
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              autoFocus
              data-testid="input-exercise-search"
            />

            {exerciseSearch.trim() && (
              <Button
                variant="outline"
                className="w-full justify-start text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
                onClick={() => {
                  if (addExerciseTarget) {
                    addExercise(addExerciseTarget.sessionIdx, addExerciseTarget.sectionIdx, exerciseSearch.trim());
                    setAddExerciseTarget(null);
                  }
                }}
                data-testid="button-add-custom-exercise"
              >
                <Plus className="mr-2 h-4 w-4" /> Add "{exerciseSearch.trim()}" as custom exercise
              </Button>
            )}

            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((t: any) => (
                  <button
                    key={t.id}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-between group"
                    onClick={() => {
                      if (addExerciseTarget) {
                        addExercise(addExerciseTarget.sessionIdx, addExerciseTarget.sectionIdx, t.name);
                        setAddExerciseTarget(null);
                      }
                    }}
                    data-testid={`button-template-${t.id}`}
                  >
                    <div>
                      <div className="font-medium text-slate-900">{t.name}</div>
                      {t.targetMuscle && <div className="text-xs text-slate-500">{t.targetMuscle}</div>}
                    </div>
                    <Plus className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              ) : (
                !exerciseSearch.trim() && <div className="text-center py-6 text-slate-400 text-sm">Start typing to search your exercise library</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
