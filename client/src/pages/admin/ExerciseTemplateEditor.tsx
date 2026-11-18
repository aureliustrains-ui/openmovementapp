import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { TemplateEditorHeader } from "@/components/admin/TemplateEditorHeader";
import { useAutosave } from "@/hooks/useAutosave";
import {
  ExerciseFieldsEditor,
  toExerciseEditableFields,
  type ExerciseEditableFields,
} from "@/components/admin/exercise/ExerciseFieldsEditor";
import { ExerciseClientPreview } from "@/components/admin/exercise/ExerciseClientPreview";
import { ExerciseLibraryTags } from "@/components/admin/ExerciseLibraryTags";
import { exerciseStandardToPayload } from "@/lib/exerciseStandard";

type ExerciseTemplateModel = ExerciseEditableFields & {
  id: string;
  name: string;
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
      ...toExerciseEditableFields(template),
    });
  }, [template]);

  const autosaveSnapshot = useMemo(() => JSON.stringify(model), [model]);

  const save = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!model || !model.name.trim()) return;
      setSaving(true);
      try {
        await updateTemplate.mutateAsync({
          id: model.id,
          name: model.name.trim(),
          demoUrl: model.demoUrl.trim() || null,
          sets: model.sets.trim() || null,
          reps: model.reps.trim() || null,
          load: model.load.trim() || null,
          tempo: model.tempo.trim() || null,
          notes: model.notes.trim() || null,
          goal: model.goal.trim() || null,
          additionalInstructions: model.additionalInstructions.trim() || null,
        ...exerciseStandardToPayload(model),
          ...exerciseStandardToPayload(model),
          requiresMovementCheck: model.requiresMovementCheck,
          enableStructuredLogging: model.enableStructuredLogging,
          ...(model.demoUrl.trim() && template?.needsVideo ? { needsVideo: false } : {}),
        });
        if (!options?.silent) toast({ title: "Exercise template saved" });
      } catch {
        toast({ title: "Could not save exercise template", variant: "destructive" });
        throw new Error("Could not save exercise template");
      } finally {
        setSaving(false);
      }
    },
    [model, template?.needsVideo, toast, updateTemplate],
  );

  const autosave = useAutosave({
    snapshot: autosaveSnapshot,
    enabled: Boolean(model?.id && model.name.trim()),
    delayMs: 30_000,
    onSave: () => save({ silent: true }),
  });

  const remove = async () => {
    if (!model) return;
    if (!window.confirm(`Delete "${model.name}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(model.id);
      setLocation("/app/admin/templates?tab=exercises");
    } catch {
      toast({ title: "Could not delete exercise template", variant: "destructive" });
    }
  };

  const duplicate = async () => {
    if (!model) return;
    try {
      const created = await createTemplate.mutateAsync({
        name: `${model.name} (Copy)`,
        folderId: template?.folderId ?? null,
        facets: template?.facets ?? {},
        keywords: Array.isArray(template?.keywords) ? template.keywords : [],
        needsVideo: Boolean(template?.needsVideo),
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
      setLocation(`/app/admin/templates/exercises/${created.id}?tab=exercises`);
    } catch {
      toast({ title: "Could not duplicate exercise template", variant: "destructive" });
    }
  };

  if (!model) {
    return <div className="w-full py-12 text-slate-500">Loading exercise template...</div>;
  }

  return (
    <div className="space-y-6 w-full pb-20">
      <TemplateEditorHeader
        backHref="/app/admin/templates?tab=exercises"
        title="Exercise Templates"
        name={model.name}
        onNameChange={(value) => setModel((prev) => (prev ? { ...prev, name: value } : prev))}
        onSave={() => void save().then(() => autosave.markSaved())}
        saveDisabled={saving || !model.name.trim()}
        saving={saving}
        autosaveStatus={autosave.status}
        onDelete={remove}
        onDuplicate={duplicate}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <ExerciseFieldsEditor
                idPrefix={`exercise-template-${model.id}`}
                value={model}
                onChange={(field, value) =>
                  setModel((prev) => (prev ? { ...prev, [field]: value } : prev))
                }
              />
            </CardContent>
          </Card>
          {template ? <ExerciseLibraryTags item={template} /> : null}
        </div>
        <div className="xl:sticky xl:top-24 xl:self-start">
          <ExerciseClientPreview exercise={model} />
        </div>
      </div>
    </div>
  );
}
