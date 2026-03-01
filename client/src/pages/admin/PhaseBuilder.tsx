import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { phasesQuery, sessionsByPhaseQuery, exerciseTemplatesQuery, useUpdatePhase, useCreatePhase, useCreateSession, useUpdateSession, useDeleteSession } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Trash2, ArrowLeft, Save, Loader2, AlertCircle, Send, CalendarDays, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

function generateId() {
  return crypto.randomUUID();
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Exercise = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  load: string;
  rpe: string;
  tempo: string;
  rest: string;
  notes: string;
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

function makeExercise(name = "New Exercise"): Exercise {
  return { id: generateId(), name, sets: "3", reps: "10", load: "Auto", rpe: "8", tempo: "3010", rest: "90s", notes: "" };
}

function makeSection(name = "New Section"): Section {
  return { id: generateId(), name, exercises: [] };
}

function makeSession(name = "New Session"): LocalSession {
  return { id: generateId(), name, description: "", sections: [makeSection("A. Main")], isNew: true };
}

function buildSchedule(sessionIds: string[], dayAssignments: Record<number, string>, weeks: number) {
  const schedule: { day: string; week: number; sessionId: string }[] = [];
  for (let w = 1; w <= weeks; w++) {
    sessionIds.forEach((sid, idx) => {
      const day = dayAssignments[idx] || WEEKDAYS[idx % 7];
      schedule.push({ day, week: w, sessionId: sid });
    });
  }
  return schedule;
}

function collectExerciseNames(sessions: LocalSession[]): string[] {
  const names: string[] = [];
  for (const s of sessions) {
    for (const sec of s.sections) {
      for (const ex of sec.exercises) {
        if (ex.name && !names.includes(ex.name)) {
          names.push(ex.name);
        }
      }
    }
  }
  return names;
}

export default function AdminPhaseBuilder() {
  const [, params] = useRoute("/app/admin/clients/:clientId/builder/:phaseId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isNew = params?.phaseId === 'new';

  const { data: allPhases = [] } = useQuery(phasesQuery);
  const { data: phaseSessions = [], isLoading: loadingSessions } = useQuery(sessionsByPhaseQuery(params?.phaseId || ''));
  const { data: templates = [] } = useQuery(exerciseTemplatesQuery);
  const updatePhase = useUpdatePhase();
  const createPhase = useCreatePhase();
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();

  const existingPhase = allPhases.find((p: any) => p.id === params?.phaseId);

  const [phaseName, setPhaseName] = useState("New Phase");
  const [goal, setGoal] = useState("");
  const [durationWeeks, setDurationWeeks] = useState("4");
  const [localSessions, setLocalSessions] = useState<LocalSession[]>([]);
  const [initializedForPhase, setInitializedForPhase] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [movementCheckGate, setMovementCheckGate] = useState("yes");
  const [dayAssignments, setDayAssignments] = useState<Record<number, string>>({});
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const isDirty = useMemo(() => {
    if (!existingPhase && isNew) {
      return phaseName !== "New Phase" || goal !== "" || durationWeeks !== "4" || localSessions.length > 1 || localSessions[0]?.sections.length > 1 || localSessions[0]?.sections[0]?.exercises.length > 0;
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

    return false;
  }, [phaseName, goal, durationWeeks, localSessions, existingPhase, phaseSessions, isNew]);

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
      setMovementCheckGate("yes");
      setLocalSessions([makeSession("Session 1")]);
      setDayAssignments({ 0: "Monday" });
      setLastSavedAt(null);
      setInitializedForPhase(currentPhaseId);
      return;
    }

    if (!existingPhase) return;
    if (loadingSessions) return;

    setPhaseName(existingPhase.name);
    setGoal(existingPhase.goal || "");
    setDurationWeeks(String(existingPhase.durationWeeks));

    const hasMovementChecks = (existingPhase.movementChecks as any[])?.length > 0;
    setMovementCheckGate(hasMovementChecks || existingPhase.status === 'Waiting for Movement Check' ? "yes" : "no");

    if (phaseSessions.length > 0) {
      setLocalSessions(phaseSessions.map((s: any) => ({
        id: s.id,
        dbId: s.id,
        name: s.name,
        description: s.description || "",
        sections: (s.sections as Section[]) || [],
      })));

      const existingSchedule = (existingPhase.schedule as any[]) || [];
      const assignments: Record<number, string> = {};
      phaseSessions.forEach((s: any, idx: number) => {
        const schedEntry = existingSchedule.find((sc: any) => sc.sessionId === s.id);
        assignments[idx] = schedEntry?.day || WEEKDAYS[idx % 7];
      });
      setDayAssignments(assignments);
    } else {
      setLocalSessions([makeSession("Session 1")]);
      setDayAssignments({ 0: "Monday" });
    }
    setLastSavedAt(null);
    setInitializedForPhase(currentPhaseId);
  }, [existingPhase, phaseSessions, isNew, currentPhaseId, initializedForPhase, loadingSessions]);

  const updateLocalSession = useCallback((sessionIdx: number, updater: (s: LocalSession) => LocalSession) => {
    setLocalSessions(prev => prev.map((s, i) => i === sessionIdx ? updater(s) : s));
  }, []);

  const addSession = () => {
    setLocalSessions(prev => {
      const newIdx = prev.length;
      setDayAssignments(a => ({ ...a, [newIdx]: WEEKDAYS[newIdx % 7] }));
      return [...prev, makeSession(`Session ${newIdx + 1}`)];
    });
  };

  const removeSession = (idx: number) => {
    setLocalSessions(prev => prev.filter((_, i) => i !== idx));
    setDayAssignments(prev => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k);
        if (ki < idx) next[ki] = v;
        else if (ki > idx) next[ki - 1] = v;
      });
      return next;
    });
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

  const updateExerciseField = (sessionIdx: number, sectionIdx: number, exerciseIdx: number, field: keyof Exercise, value: string) => {
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

  const savePhase = async (): Promise<{ phaseId: string; savedSessions: any[] } | null> => {
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

    const sessionIds = savedSessions.map((s: any) => s.id);
    const schedule = buildSchedule(sessionIds, dayAssignments, parseInt(durationWeeks));

    await updatePhase.mutateAsync({
      id: phaseId,
      schedule,
    });

    return { phaseId, savedSessions };
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

      const { phaseId, savedSessions } = result;

      setLocalSessions(prev => prev.map((ls, idx) => ({
        ...ls,
        id: savedSessions[idx]?.id || ls.id,
        dbId: savedSessions[idx]?.id || ls.dbId,
        isNew: false,
      })));

      const now = new Date();
      setLastSavedAt(now);

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

      if (movementCheckGate === "yes") {
        const exerciseNames = collectExerciseNames(localSessions);
        const movementChecks = exerciseNames.slice(0, 5).map(name => ({
          exerciseId: generateId(),
          name,
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

  const filteredTemplates = templates.filter((t: any) =>
    t.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const phaseStatus = existingPhase?.status || 'Draft';
  const isPublished = phaseStatus === 'Active' || phaseStatus === 'Waiting for Movement Check';

  const formatSavedTime = (d: Date) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
            disabled={saving || publishing || !phaseName.trim() || localSessions.every(s => s.sections.every(sec => sec.exercises.length === 0))}
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
            <Label className="text-slate-600">Movement Check Gate</Label>
            <Select value={movementCheckGate} onValueChange={setMovementCheckGate}>
              <SelectTrigger className={`bg-slate-50 ${movementCheckGate === 'yes' ? 'border-amber-200 text-amber-900' : ''}`} data-testid="select-movement-gate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Require video approval before start</SelectItem>
                <SelectItem value="no">Bypass (Go online immediately)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {localSessions.map((session, sessionIdx) => (
        <Card key={session.id} className="mt-6 border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden" data-testid={`card-session-${sessionIdx}`}>
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Badge variant="secondary" className="bg-indigo-600 text-white border-none shrink-0 text-xs">Session {sessionIdx + 1}</Badge>
              <Input
                value={session.name}
                onChange={(e) => updateLocalSession(sessionIdx, s => ({ ...s, name: e.target.value }))}
                className="text-lg font-display font-bold text-white border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-400 px-2 h-auto bg-transparent placeholder:text-slate-400"
                placeholder="Session name..."
                data-testid={`input-session-name-${sessionIdx}`}
              />
            </div>
            <div className="flex gap-2 shrink-0">
              {localSessions.length > 1 && (
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-rose-400 hover:bg-slate-800" onClick={() => removeSession(sessionIdx)} data-testid={`button-remove-session-${sessionIdx}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

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
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="cursor-move text-slate-400 hover:text-slate-600 shrink-0">
                          <GripVertical className="h-5 w-5" />
                        </div>
                        <Input
                          value={ex.name}
                          onChange={(e) => updateExerciseField(sessionIdx, sectionIdx, exIdx, "name", e.target.value)}
                          className="font-semibold text-slate-900 border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300 px-1 h-8 bg-transparent"
                          data-testid={`input-exercise-name-${sessionIdx}-${sectionIdx}-${exIdx}`}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => removeExercise(sessionIdx, sectionIdx, exIdx)}
                        data-testid={`button-remove-exercise-${sessionIdx}-${sectionIdx}-${exIdx}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="p-4 bg-white grid grid-cols-2 md:grid-cols-6 gap-4">
                      {([
                        { key: "sets", label: "Sets" },
                        { key: "reps", label: "Reps" },
                        { key: "load", label: "Load" },
                        { key: "rpe", label: "RPE / RIR" },
                        { key: "tempo", label: "Tempo" },
                        { key: "rest", label: "Rest" },
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

                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                      <Input
                        value={ex.notes}
                        onChange={(e) => updateExerciseField(sessionIdx, sectionIdx, exIdx, "notes", e.target.value)}
                        placeholder="Add coaching notes or cues..."
                        className="h-8 text-sm bg-white border-slate-200 text-slate-600"
                        data-testid={`input-notes-${sessionIdx}-${sectionIdx}-${exIdx}`}
                      />
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
        </Card>
      ))}

      <div className="flex justify-center mt-8">
        <Button
          className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-8 py-6 text-base shadow-lg"
          onClick={addSession}
          data-testid="button-add-session"
        >
          <Plus className="mr-2 h-5 w-5" /> Add Session
        </Button>
      </div>

      {localSessions.length > 0 && (
        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-indigo-400" />
            <h3 className="font-display font-bold text-lg">Weekly Schedule</h3>
          </div>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm text-slate-500 mb-4">Assign each session to a day of the week. This schedule repeats for all {durationWeeks} weeks.</p>
            {localSessions.map((session, idx) => (
              <div key={session.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100" data-testid={`schedule-row-${idx}`}>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-none shrink-0 text-xs">Session {idx + 1}</Badge>
                <span className="font-medium text-slate-900 flex-1 min-w-0 truncate">{session.name}</span>
                <Select value={dayAssignments[idx] || WEEKDAYS[idx % 7]} onValueChange={(val) => setDayAssignments(prev => ({ ...prev, [idx]: val }))}>
                  <SelectTrigger className="w-[140px] bg-white" data-testid={`select-day-${idx}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isPublished ? "Re-publish Phase" : "Publish Phase"}</DialogTitle>
            <DialogDescription>
              {movementCheckGate === "yes"
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
              <span className="text-sm font-medium text-slate-700">Movement Checks</span>
              <Badge className={movementCheckGate === "yes" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-green-100 text-green-700 border-green-200"}>
                {movementCheckGate === "yes" ? "Required" : "Bypassed"}
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
