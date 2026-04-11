import { useEffect, useState } from "react";
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
  cloneExerciseFromTemplate,
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
import { Plus, X } from "lucide-react";
import { AddFromTemplatesModal } from "@/components/admin/AddFromTemplatesModal";
import { SessionEditorCard } from "@/components/admin/builder/SessionEditorCard";
import { TemplateEditorHeader } from "@/components/admin/TemplateEditorHeader";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOTS = ["AM", "PM"];

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
  const [assignSessionTarget, setAssignSessionTarget] = useState<{ day: string; slot: string } | null>(null);
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
    setSchedule(Array.isArray(template.schedule) ? (template.schedule as BlueprintScheduleEntry[]) : []);
  }, [template, isNew]);

  useEffect(() => {
    const maxWeek = parseInt(durationWeeks, 10) || 4;
    setSchedule((prev) => prev.filter((entry) => entry.week <= maxWeek));
    if (selectedWeek > maxWeek) setSelectedWeek(maxWeek);
  }, [durationWeeks, selectedWeek]);

  const weekSchedule = schedule.filter((entry) => entry.week === selectedWeek);
  const weeks = parseInt(durationWeeks, 10) || 4;

  const saveTemplate = async () => {
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
        toast({ title: "Phase template created" });
        setLocation(`/app/admin/templates/phases/${created.id}?tab=phases`);
      } else {
        await updateTemplate.mutateAsync({ id: templateId, ...payload });
        toast({ title: "Phase template saved" });
      }
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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

  const updateSession = (sessionIdx: number, updater: (session: BlueprintSession) => BlueprintSession) => {
    setSessions((prev) => prev.map((session, idx) => (idx === sessionIdx ? updater(session) : session)));
  };

  const addSession = () => setSessions((prev) => [...prev, makeSession(`Session ${prev.length + 1}`)]);
  const addSessionFromTemplate = (templateSession: any) =>
    setSessions((prev) => [...prev, cloneSessionFromTemplate(templateSession)]);
  const removeSession = (sessionIdx: number) => {
    const sessionId = sessions[sessionIdx]?.id;
    setSessions((prev) => prev.filter((_, idx) => idx !== sessionIdx));
    setSchedule((prev) => prev.filter((entry) => entry.sessionId !== sessionId));
  };

  const addScheduleEntry = (day: string, slot: string, sessionId: string) => {
    setSchedule((prev) => {
      const additions: BlueprintScheduleEntry[] = [];
      for (let week = 1; week <= weeks; week += 1) {
        if (!prev.some((entry) => entry.day === day && entry.slot === slot && entry.week === week && entry.sessionId === sessionId)) {
          additions.push({ day, slot, week, sessionId });
        }
      }
      return [...prev, ...additions];
    });
  };

  const removeScheduleEntry = (day: string, slot: string, sessionId: string) => {
    setSchedule((prev) => prev.filter((entry) => !(entry.day === day && entry.slot === slot && entry.sessionId === sessionId)));
  };

  return (
    <div className="space-y-6 w-full pb-16">
      <TemplateEditorHeader
        backHref="/app/admin/templates?tab=phases"
        title="Phase Templates"
        name={name}
        onNameChange={setName}
        onSave={saveTemplate}
        saveDisabled={saving || !name.trim()}
        saving={saving}
        onDelete={isNew ? undefined : removeTemplate}
        onDuplicate={isNew ? undefined : duplicateTemplate}
      />

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Label>Goal</Label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="min-h-[96px] bg-slate-50"
            />
          </div>
          <div>
            <Label>Duration (weeks)</Label>
            <Input value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} />
          </div>
          <div className="md:col-span-3 flex items-center justify-between">
            <Label>Movement check enabled</Label>
            <Switch checked={movementCheckEnabled} onCheckedChange={setMovementCheckEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-semibold">Schedule</h3>
          <div className="flex gap-1">
            {Array.from({ length: weeks }, (_, idx) => idx + 1).map((week) => (
              <Button key={week} size="sm" variant={selectedWeek === week ? "secondary" : "ghost"} onClick={() => setSelectedWeek(week)}>
                W{week}
              </Button>
            ))}
          </div>
        </div>
        <div className="p-4 space-y-2">
          {WEEKDAYS.map((day) => (
            <div key={day} className="grid grid-cols-3 gap-2 items-center">
              <div className="text-sm text-slate-700">{day}</div>
              {SLOTS.map((slot) => (
                <div key={slot} className="border rounded-lg p-2 min-h-[40px]">
                  <div className="flex flex-wrap gap-1">
                    {weekSchedule
                      .filter((entry) => entry.day === day && entry.slot === slot)
                      .map((entry) => {
                        const session = sessions.find((s) => s.id === entry.sessionId);
                        return (
                          <Badge key={`${entry.sessionId}-${day}-${slot}`} variant="outline">
                            {session?.name || "Session"}
                            <button className="ml-2" onClick={() => removeScheduleEntry(day, slot, entry.sessionId)}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    <button onClick={() => setAssignSessionTarget({ day, slot })} className="text-slate-400 hover:text-indigo-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

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
          onCreateSection={() => makeSection(`Section ${session.sections.length + 1}`)}
          onCloneSectionTemplate={(templateSection) => cloneSectionFromTemplate(templateSection)}
          onCloneExerciseTemplate={(templateExercise) => cloneExerciseFromTemplate(toBlueprintExercise(templateExercise))}
        />
      ))}

      <div className="flex justify-center">
        <Button onClick={() => setAddSessionModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Session
        </Button>
      </div>

      <Dialog open={assignSessionTarget !== null} onOpenChange={(open) => !open && setAssignSessionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Session</DialogTitle>
            <DialogDescription>
              {assignSessionTarget?.day} - {assignSessionTarget?.slot}
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
