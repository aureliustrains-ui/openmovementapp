import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  exerciseTemplatesQuery,
  sectionTemplatesQuery,
  useCreateSectionTemplate,
  useDeleteSectionTemplate,
  useUpdateSectionTemplate,
} from "@/lib/api";
import { cloneExerciseFromTemplate, toBlueprintExercise } from "@/lib/blueprintClone";
import type { BlueprintSection } from "@/lib/blueprintClone";
import { SectionEditorCard } from "@/components/admin/builder/SectionEditorCard";
import { Textarea } from "@/components/ui/textarea";
import { TemplateEditorHeader } from "@/components/admin/TemplateEditorHeader";

type SectionTemplateModel = {
  id: string;
  name: string;
  description: string;
  exercises: any[];
};

export default function SectionTemplateEditor() {
  const [, params] = useRoute("/app/admin/templates/sections/:sectionTemplateId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const templateId = params?.sectionTemplateId || "";

  const { data: allTemplates = [] } = useQuery(sectionTemplatesQuery);
  const { data: exerciseTemplates = [] } = useQuery(exerciseTemplatesQuery);

  const updateTemplate = useUpdateSectionTemplate();
  const deleteTemplate = useDeleteSectionTemplate();
  const createTemplate = useCreateSectionTemplate();

  const template = allTemplates.find((item: any) => item.id === templateId);

  const [model, setModel] = useState<SectionTemplateModel | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!template) return;
    setModel({
      id: template.id,
      name: template.name || "",
      description: template.description || "",
      exercises: template.exercises || [],
    });
  }, [template]);

  const save = async () => {
    if (!model || !model.name.trim()) return;
    setSaving(true);
    try {
      await updateTemplate.mutateAsync({
        id: model.id,
        name: model.name.trim(),
        description: model.description.trim() || null,
        exercises: model.exercises,
      });
      toast({ title: "Section template saved" });
    } catch {
      toast({ title: "Could not save section template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!model) return;
    if (!window.confirm(`Delete "${model.name}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(model.id);
      setLocation("/app/admin/templates?tab=sections");
    } catch {
      toast({ title: "Could not delete section template", variant: "destructive" });
    }
  };

  const duplicate = async () => {
    if (!model) return;
    try {
      const created = await createTemplate.mutateAsync({
        name: `${model.name} (Copy)`,
        description: model.description.trim() || null,
        exercises: model.exercises,
      });
      toast({ title: "Section template duplicated" });
      setLocation(`/app/admin/templates/sections/${created.id}?tab=sections`);
    } catch {
      toast({ title: "Could not duplicate section template", variant: "destructive" });
    }
  };

  if (!model) {
    return <div className="w-full py-12 text-slate-500">Loading section template...</div>;
  }

  const sectionForEditor: BlueprintSection = {
    id: model.id,
    name: model.name,
    exercises: model.exercises as any[],
  };

  return (
    <div className="space-y-6 w-full pb-20">
      <TemplateEditorHeader
        backHref="/app/admin/templates?tab=sections"
        title="Section Templates"
        name={model.name}
        onNameChange={(value) => setModel((prev) => (prev ? { ...prev, name: value } : prev))}
        onSave={save}
        saveDisabled={saving || !model.name.trim()}
        saving={saving}
        onDelete={remove}
        onDuplicate={duplicate}
      />

      <div className="space-y-2">
        <p className="text-sm text-slate-600">Description (optional)</p>
        <Textarea
          value={model.description}
          onChange={(e) => setModel((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
          className="bg-white"
        />
      </div>

      <SectionEditorCard
        section={sectionForEditor}
        sectionIdx={0}
        sectionCount={1}
        movementCheckEnabled
        exerciseTemplates={exerciseTemplates as any[]}
        onSectionNameChange={(name) => setModel((prev) => (prev ? { ...prev, name } : prev))}
        onRemoveSection={() => {}}
        onMoveSection={() => {}}
        onAddExerciseByName={(name) => {
          setModel((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              exercises: [
                ...prev.exercises,
                {
                  id: crypto.randomUUID(),
                  name,
                  sets: "3",
                  reps: "10",
                  load: "Auto",
                  tempo: "3010",
                  notes: "",
                  goal: "",
                  additionalInstructions: "",
                  demoUrl: "",
                  enableStructuredLogging: false,
                  requiresMovementCheck: false,
                },
              ],
            };
          });
        }}
        onAddExerciseFromTemplate={(templateExercise) => {
          setModel((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              exercises: [...prev.exercises, cloneExerciseFromTemplate(toBlueprintExercise(templateExercise))],
            };
          });
        }}
        onRemoveExercise={(exerciseIdx) => {
          setModel((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              exercises: prev.exercises.filter((_, idx) => idx !== exerciseIdx),
            };
          });
        }}
        onMoveExercise={(exerciseIdx, direction) => {
          setModel((prev) => {
            if (!prev) return prev;
            const exercises = [...prev.exercises];
            const targetIdx = direction === "up" ? exerciseIdx - 1 : exerciseIdx + 1;
            if (targetIdx < 0 || targetIdx >= exercises.length) return prev;
            [exercises[exerciseIdx], exercises[targetIdx]] = [exercises[targetIdx], exercises[exerciseIdx]];
            return { ...prev, exercises };
          });
        }}
        onExerciseFieldChange={(exerciseIdx, field, value) => {
          setModel((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              exercises: prev.exercises.map((exercise: any, idx) =>
                idx === exerciseIdx ? { ...exercise, [field]: value } : exercise,
              ),
            };
          });
        }}
      />
    </div>
  );
}
