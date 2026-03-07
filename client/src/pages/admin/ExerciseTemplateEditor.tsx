import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  exerciseTemplatesQuery,
  useCreateExerciseTemplate,
  useDeleteExerciseTemplate,
  useUpdateExerciseTemplate,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { TemplateEditorHeader } from "@/components/admin/TemplateEditorHeader";

type ExerciseTemplateModel = {
  id: string;
  name: string;
  targetMuscle: string;
  demoUrl: string;
  sets: string;
  reps: string;
  load: string;
  tempo: string;
  notes: string;
  goal: string;
  additionalInstructions: string;
  requiresMovementCheck: boolean;
  enableStructuredLogging: boolean;
};

export default function ExerciseTemplateEditor() {
  const [, params] = useRoute("/app/admin/templates/exercises/:exerciseTemplateId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const templateId = params?.exerciseTemplateId || "";

  const { data: allTemplates = [] } = useQuery(exerciseTemplatesQuery);
  const createTemplate = useCreateExerciseTemplate();
  const updateTemplate = useUpdateExerciseTemplate();
  const deleteTemplate = useDeleteExerciseTemplate();

  const template = allTemplates.find((item: any) => item.id === templateId);

  const [model, setModel] = useState<ExerciseTemplateModel | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!template) return;
    setModel({
      id: template.id,
      name: template.name || "",
      targetMuscle: template.targetMuscle || "",
      demoUrl: template.demoUrl || "",
      sets: template.sets || "",
      reps: template.reps || "",
      load: template.load || "",
      tempo: template.tempo || "",
      notes: template.notes || "",
      goal: template.goal || "",
      additionalInstructions: template.additionalInstructions || "",
      requiresMovementCheck: Boolean(template.requiresMovementCheck),
      enableStructuredLogging: Boolean(template.enableStructuredLogging),
    });
  }, [template]);

  const save = async () => {
    if (!model || !model.name.trim()) return;
    setSaving(true);
    try {
      await updateTemplate.mutateAsync({
        id: model.id,
        name: model.name.trim(),
        targetMuscle: model.targetMuscle.trim() || null,
        demoUrl: model.demoUrl.trim() || null,
        sets: model.sets.trim() || null,
        reps: model.reps.trim() || null,
        load: model.load.trim() || null,
        tempo: model.tempo.trim() || null,
        notes: model.notes.trim() || null,
        goal: model.goal.trim() || null,
        additionalInstructions: model.additionalInstructions.trim() || null,
        requiresMovementCheck: model.requiresMovementCheck,
        enableStructuredLogging: model.enableStructuredLogging,
      });
      toast({ title: "Exercise template saved" });
    } catch {
      toast({ title: "Could not save exercise template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!model) return;
    if (!window.confirm(`Delete "${model.name}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(model.id);
      setLocation("/app/admin/templates");
    } catch {
      toast({ title: "Could not delete exercise template", variant: "destructive" });
    }
  };

  const duplicate = async () => {
    if (!model) return;
    try {
      const created = await createTemplate.mutateAsync({
        name: `${model.name} (Copy)`,
        targetMuscle: model.targetMuscle.trim() || null,
        demoUrl: model.demoUrl.trim() || null,
        sets: model.sets.trim() || null,
        reps: model.reps.trim() || null,
        load: model.load.trim() || null,
        tempo: model.tempo.trim() || null,
        notes: model.notes.trim() || null,
        goal: model.goal.trim() || null,
        additionalInstructions: model.additionalInstructions.trim() || null,
        requiresMovementCheck: model.requiresMovementCheck,
        enableStructuredLogging: model.enableStructuredLogging,
      });
      toast({ title: "Exercise template duplicated" });
      setLocation(`/app/admin/templates/exercises/${created.id}`);
    } catch {
      toast({ title: "Could not duplicate exercise template", variant: "destructive" });
    }
  };

  if (!model) {
    return <div className="max-w-6xl mx-auto py-12 text-slate-500">Loading exercise template...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <TemplateEditorHeader
        backHref="/app/admin/templates"
        title="Exercise Templates"
        name={model.name}
        onNameChange={(value) => setModel((prev) => (prev ? { ...prev, name: value } : prev))}
        onSave={save}
        saveDisabled={saving || !model.name.trim()}
        saving={saving}
        onDelete={remove}
        onDuplicate={duplicate}
      />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Target Effect</Label>
              <Input value={model.targetMuscle} onChange={(e) => setModel((prev) => (prev ? { ...prev, targetMuscle: e.target.value } : prev))} />
            </div>
            <div>
              <Label>Demo URL</Label>
              <Input value={model.demoUrl} onChange={(e) => setModel((prev) => (prev ? { ...prev, demoUrl: e.target.value } : prev))} />
            </div>
            <div>
              <Label>Sets</Label>
              <Input value={model.sets} onChange={(e) => setModel((prev) => (prev ? { ...prev, sets: e.target.value } : prev))} />
            </div>
            <div>
              <Label>Reps</Label>
              <Input value={model.reps} onChange={(e) => setModel((prev) => (prev ? { ...prev, reps: e.target.value } : prev))} />
            </div>
            <div>
              <Label>Load</Label>
              <Input value={model.load} onChange={(e) => setModel((prev) => (prev ? { ...prev, load: e.target.value } : prev))} />
            </div>
            <div>
              <Label>Tempo</Label>
              <Input value={model.tempo} onChange={(e) => setModel((prev) => (prev ? { ...prev, tempo: e.target.value } : prev))} />
            </div>
          </div>

          <div>
            <Label>Goal</Label>
            <Input value={model.goal} onChange={(e) => setModel((prev) => (prev ? { ...prev, goal: e.target.value } : prev))} />
          </div>

          <div>
            <Label>Notes</Label>
            <Input value={model.notes} onChange={(e) => setModel((prev) => (prev ? { ...prev, notes: e.target.value } : prev))} />
          </div>

          <div>
            <Label>Additional Instructions</Label>
            <Textarea value={model.additionalInstructions} onChange={(e) => setModel((prev) => (prev ? { ...prev, additionalInstructions: e.target.value } : prev))} />
          </div>

          <div className="flex items-center justify-between border rounded-md px-3 py-2">
            <Label>Requires movement check</Label>
            <Switch
              checked={model.requiresMovementCheck}
              onCheckedChange={(checked) => setModel((prev) => (prev ? { ...prev, requiresMovementCheck: checked } : prev))}
            />
          </div>

          <div className="flex items-center justify-between border rounded-md px-3 py-2">
            <Label>Enable structured logging</Label>
            <Switch
              checked={model.enableStructuredLogging}
              onCheckedChange={(checked) => setModel((prev) => (prev ? { ...prev, enableStructuredLogging: checked } : prev))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
