import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  exerciseTemplatesQuery,
  phaseTemplateQuery,
  sectionTemplatesQuery,
  sessionTemplatesQuery,
  useCreatePhaseTemplate,
  useDeletePhaseTemplate,
  useUpdatePhaseTemplate,
} from "@/lib/api";
import type {
  BlueprintScheduleEntry,
  BlueprintSection,
  BlueprintSession,
} from "@/lib/blueprintClone";
import {
  clonePhaseTemplate,
  cloneExercise,
  cloneExerciseFromTemplate,
  cloneSection,
  cloneSectionFromTemplate,
  cloneSessionFromTemplate,
  toBlueprintExercise,
} from "@/lib/blueprintClone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, X } from "lucide-react";
import { AddFromTemplatesModal } from "@/components/admin/AddFromTemplatesModal";
import { SessionEditorCard } from "@/components/admin/builder/SessionEditorCard";
import { TemplateEditorHeader } from "@/components/admin/TemplateEditorHeader";
import { useAutosave } from "@/hooks/useAutosave";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOTS = ["AM", "PM"];
const getScheduleDayLabel = (day: string) => {
  const index = WEEKDAYS.indexOf(day);
  return index >= 0 ? `Day ${index + 1}` : day;
};

function makeSection(name = "New Section"): BlueprintSection {
  return { id: crypto.randomUUID(), name, exercises: [] };
}

function makeSession(name = "New Session"): BlueprintSession {
  return {
    id: crypto.randomUUID(),
    name,
    description: "",
    durationMinutes: null,
    sections: [makeSection("A. Main")],
  };
}

export default function TemplateBuilder() {
  const [, phaseParams] = useRoute("/app/admin/templates/phases/:phaseTemplateId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const templateId = phaseParams?.phaseTemplateId || "new";
  const isNew = templateId === "new";

  const { data: template } = useQuery({
    ...phaseTemplateQuery(templateId),
    enabled: !isNew,
  });
  const { data: exerciseTemplates = [] } = useQuery(exerciseTemplatesQuery);
  const { data: sectionTemplates = [] } = useQuery(sectionTemplatesQuery);
  const { data: sessionTemplates = [] } = useQuery(sessionTemplatesQuery);

  const createTemplate = useCreatePhaseTemplate();
  const updateTemplate = useUpdatePhaseTemplate();
  const deleteTemplate = useDeletePhaseTemplate();

  const [name, setName] = useState("New Phase Template");
  const [goal, setGoal] = useState("");
  const [durationWeeks, setDurationWeeks] = useState("4");
  const [movementCheckEnabled, setMovementCheckEnabled] = useState(false);
  const [sessions, setSessions] = useState<BlueprintSession[]>([makeSession("Session 1")]);
  const [schedule, setSchedule] = useState<BlueprintScheduleEntry[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [saving, setSaving] = useState(false);
  const [assignSessionTarget, setAssignSessionTarget] = useState<{
    day: string;
    slot: string;
  } | null>(null);
  const [addSessionModalOpen, setAddSessionModalOpen] = useState(false);

  useEffect(() => {
    if (!template || isNew) return;
    setName(template.name || "Template");
    setGoal(template.goal || "");
    setDurationWeeks(String(template.durationWeeks || 4));
    setMovementCheckEnabled(Boolean(template.movementCheckEnabled));
    setSessions(
      Array.isArray(template.sessions) && template.sessions.length > 0
        ? (template.sessions as BlueprintSession[])
        : [makeSession("Session 1")],
    );
    setSchedule(
      Array.isArray(template.schedule) ? (template.schedule as BlueprintScheduleEntry[]) : [],
    );
  }, [template, isNew]);

  useEffect(() => {
    const maxWeek = parseInt(durationWeeks, 10) || 4;
    setSchedule((prev) => prev.filter((entry) => entry.week <= maxWeek));
    if (selectedWeek > maxWeek) setSelectedWeek(maxWeek);
  }, [durationWeeks, selectedWeek]);

  const weekSchedule = schedule.filter((entry) => entry.week === selectedWeek);
  const weeks = parseInt(durationWeeks, 10) || 4;

  const autosaveSnapshot = useMemo(
    () =>
      JSON.stringify({
        name,
        goal,
        weeks,
        movementCheckEnabled,
        sessions,
        schedule,
      }),
    [goal, movementCheckEnabled, name, schedule, sessions, weeks],
  );

  const saveTemplate = useCallback(
    async (options?: { silent?: boolean }) => {
      if (saving || !name.trim()) return;
      setSaving(true);
      try {
        const payload = {
          name: name.trim(),
          goal: goal.trim() || null,
          durationWeeks: weeks,
          movementCheckEnabled,
          sessions,
          schedule,
        };
        if (isNew) {
          const created = await createTemplate.mutateAsync(payload);
          if (!options?.silent) toast({ title: "Phase template created" });
          setLocation(`/app/admin/templates/phases/${created.id}?tab=phases`);
        } else {
          await updateTemplate.mutateAsync({ id: templateId, ...payload });
          if (!options?.silent) toast({ title: "Phase template saved" });
        }
      } catch {
        toast({ title: "Save failed", variant: "destructive" });
        throw new Error("Save failed");
      } finally {
        setSaving(false);
      }
    },
    [
      createTemplate,
      goal,
      isNew,
      movementCheckEnabled,
      name,
      saving,
      schedule,
      sessions,
      setLocation,
      templateId,
      toast,
      updateTemplate,
      weeks,
    ],
  );

  const autosave = useAutosave({
    snapshot: autosaveSnapshot,
    enabled: !isNew && Boolean(templateId && name.trim()),
    delayMs: 30_000,
    onSave: () => saveTemplate({ silent: true }),
  });

  const removeTemplate = async () => {
    if (isNew) return;
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(templateId);
      toast({ title: "Phase template deleted" });
      setLocation("/app/admin/templates?tab=phases");
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const duplicateTemplate = async () => {
    if (isNew) return;
    try {
      const cloned = clonePhaseTemplate({
        sessions: sessions as any[],
        schedule: schedule as any[],
      });
      const created = await createTemplate.mutateAsync({
        name: `${name} (Copy)`,
        goal: goal.trim() || null,
        durationWeeks: weeks,
        movementCheckEnabled,
        sessions: cloned.sessions,
        schedule: cloned.schedule,
      });
      toast({ title: "Phase template duplicated" });
      setLocation(`/app/admin/templates/phases/${created.id}?tab=phases`);
    } catch {
      toast({ title: "Duplicate failed", variant: "destructive" });
    }
  };

  const updateSession = (
    sessionIdx: number,
    updater: (session: BlueprintSession) => BlueprintSession,
  ) => {
    setSessions((prev) =>
      prev.map((session, idx) => (idx === sessionIdx ? updater(session) : session)),
    );
  };

  const addSession = () =>
    setSessions((prev) => [...prev, makeSession(`Session ${prev.length + 1}`)]);
  const addSessionFromTemplate = (templateSession: any) =>
    setSessions((prev) => [...prev, cloneSessionFromTemplate(templateSession)]);
  const duplicateSession = (sessionIdx: number) => {
    setSessions((prev) => {
      const source = prev[sessionIdx];
      if (!source) return prev;
      const cloned = cloneSessionFromTemplate({
        ...source,
        name: `${source.name || "Session"} (Copy)`,
      });
      const next = [...prev];
      next.splice(sessionIdx + 1, 0, cloned);
      return next;
    });
  };
  const removeSession = (sessionIdx: number) => {
    const sessionId = sessions[sessionIdx]?.id;
    setSessions((prev) => prev.filter((_, idx) => idx !== sessionIdx));
    setSchedule((prev) => prev.filter((entry) => entry.sessionId !== sessionId));
  };

  const moveSessionToIndex = (sourceIdx: number, targetIdx: number) => {
    setSessions((prev) => {
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
    setSchedule((prev) => {
      if (
        prev.some(
          (entry) =>
            entry.day === day &&
            entry.slot === slot &&
            entry.week === selectedWeek &&
            entry.sessionId === sessionId,
        )
      ) {
        return prev;
      }
      return [...prev, { day, slot, week: selectedWeek, sessionId }];
    });
  };

  const removeScheduleEntry = (day: string, slot: string, sessionId: string) => {
    setSchedule((prev) =>
      prev.filter(
        (entry) => !(entry.day === day && entry.slot === slot && entry.sessionId === sessionId),
      ),
    );
  };

  const makeScheduleEntryWeekSpecific = (entry: BlueprintScheduleEntry) => {
    const sourceSession = sessions.find((session) => session.id === entry.sessionId);
    if (!sourceSession) return;
    const cloned = cloneSessionFromTemplate({
      ...sourceSession,
      name: `${sourceSession.name || "Session"} W${entry.week}`,
    });
    setSessions((prev) => [...prev, cloned]);
    setSchedule((prev) =>
      prev.map((candidate) =>
        candidate.week === entry.week &&
        candidate.day === entry.day &&
        candidate.slot === entry.slot &&
        candidate.sessionId === entry.sessionId
          ? { ...candidate, sessionId: cloned.id }
          : candidate,
      ),
    );
    toast({ title: "Week-specific copy created" });
  };

  return (
    <div className="space-y-6 w-full pb-16">
      <TemplateEditorHeader
        backHref="/app/admin/templates?tab=phases"
        title="Phase Templates"
        name={name}
        onNameChange={setName}
        onSave={() => void saveTemplate().then(() => autosave.markSaved())}
        saveDisabled={saving || !name.trim()}
        saving={saving}
        autosaveStatus={autosave.status}
        onDelete={isNew ? undefined : removeTemplate}
        onDuplicate={isNew ? undefined : duplicateTemplate}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Goal
              </Label>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="min-h-[72px] border-slate-200 bg-slate-50 text-sm"
              />
            </div>
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Weeks
                </Label>
                <Input
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Movement check
                </Label>
                <div className="flex h-9 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3">
                  <span className="text-sm text-slate-700">
                    {movementCheckEnabled ? "Enabled" : "Off"}
                  </span>
                  <Switch
                    checked={movementCheckEnabled}
                    onCheckedChange={setMovementCheckEnabled}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
            <h3 className="font-semibold text-slate-900">Schedule</h3>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {Array.from({ length: weeks }, (_, idx) => idx + 1).map((week) => (
                <Button
                  key={week}
                  size="sm"
                  variant={selectedWeek === week ? "secondary" : "ghost"}
                  className={`h-7 px-3 text-xs ${
                    selectedWeek === week ? "bg-white shadow-sm" : "text-slate-500"
                  }`}
                  onClick={() => setSelectedWeek(week)}
                >
                  W{week}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 p-2.5">
            {WEEKDAYS.map((day) => (
              <div key={day} className="grid grid-cols-[74px_1fr_1fr] items-center gap-2">
                <div className="text-sm text-slate-700">{getScheduleDayLabel(day)}</div>
                {SLOTS.map((slot) => (
                  <div key={slot} className="min-h-[34px] rounded-lg border p-1.5">
                    <div className="flex flex-wrap gap-1">
                      {weekSchedule
                        .filter((entry) => entry.day === day && entry.slot === slot)
                        .map((entry) => {
                          const session = sessions.find((s) => s.id === entry.sessionId);
                          const sharedAcrossWeeks = schedule.some(
                            (candidate) =>
                              candidate.week !== selectedWeek &&
                              candidate.sessionId === entry.sessionId,
                          );
                          return (
                            <Badge key={`${entry.sessionId}-${day}-${slot}`} variant="outline">
                              {session?.name || "Session"}
                              {sharedAcrossWeeks ? (
                                <button
                                  className="ml-1"
                                  onClick={() => makeScheduleEntryWeekSpecific(entry)}
                                  title="Edit this week separately"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              ) : null}
                              <button
                                className="ml-1"
                                onClick={() => removeScheduleEntry(day, slot, entry.sessionId)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      <button
                        onClick={() => setAssignSessionTarget({ day, slot })}
                        className="text-slate-400 hover:text-indigo-600"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {sessions.map((session, sessionIdx) => (
        <SessionEditorCard
          key={session.id}
          session={session}
          sessionIdx={sessionIdx}
          totalSessions={sessions.length}
          movementCheckEnabled={movementCheckEnabled}
          sectionTemplates={sectionTemplates as any[]}
          exerciseTemplates={exerciseTemplates as any[]}
          onSessionChange={(updater) => updateSession(sessionIdx, updater)}
          onRemoveSession={() => removeSession(sessionIdx)}
          onDuplicateSession={() => duplicateSession(sessionIdx)}
          onMoveSessionToIndex={(targetSessionIdx) =>
            moveSessionToIndex(sessionIdx, targetSessionIdx)
          }
          onCreateSection={() => makeSection(`Section ${session.sections.length + 1}`)}
          onCloneSectionTemplate={(templateSection) => cloneSectionFromTemplate(templateSection)}
          onCloneExerciseTemplate={(templateExercise) =>
            cloneExerciseFromTemplate(toBlueprintExercise(templateExercise))
          }
          onCloneExercise={(exercise) => cloneExercise(exercise)}
          onCloneSection={(sourceSection) => cloneSection(sourceSection)}
        />
      ))}

      <div className="flex justify-center">
        <Button onClick={() => setAddSessionModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Session
        </Button>
      </div>

      <Dialog
        open={assignSessionTarget !== null}
        onOpenChange={(open) => !open && setAssignSessionTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Session</DialogTitle>
            <DialogDescription>
              {assignSessionTarget?.day ? getScheduleDayLabel(assignSessionTarget.day) : ""} -{" "}
              {assignSessionTarget?.slot}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {sessions.map((session) => (
              <Button
                key={session.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  if (!assignSessionTarget) return;
                  addScheduleEntry(assignSessionTarget.day, assignSessionTarget.slot, session.id);
                  setAssignSessionTarget(null);
                }}
              >
                {session.name}
              </Button>
            ))}
          </div>
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
