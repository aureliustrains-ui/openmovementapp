import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  exerciseTemplatesQuery,
  sectionTemplatesQuery,
  sessionTemplatesQuery,
  useDeleteSessionTemplate,
  useCreateSessionTemplate,
  useUpdateSessionTemplate,
} from "@/lib/api";
import {
  cloneExerciseFromTemplate,
  cloneSectionFromTemplate,
  toBlueprintExercise,
} from "@/lib/blueprintClone";
import type { BlueprintSection } from "@/lib/blueprintClone";
import { SessionEditorCard } from "@/components/admin/builder/SessionEditorCard";
import { TemplateEditorHeader } from "@/components/admin/TemplateEditorHeader";

type SessionTemplateModel = {
  id: string;
  name: string;
  description: string;
  sections: BlueprintSection[];
};

function makeSection(name = "New Section"): BlueprintSection {
  return { id: crypto.randomUUID(), name, exercises: [] };
}

export default function SessionTemplateEditor() {
  const [, params] = useRoute("/app/admin/templates/sessions/:sessionTemplateId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const templateId = params?.sessionTemplateId || "";

  const { data: allTemplates = [] } = useQuery(sessionTemplatesQuery);
  const { data: sectionTemplates = [] } = useQuery(sectionTemplatesQuery);
  const { data: exerciseTemplates = [] } = useQuery(exerciseTemplatesQuery);

  const updateTemplate = useUpdateSessionTemplate();
  const deleteTemplate = useDeleteSessionTemplate();
  const createTemplate = useCreateSessionTemplate();

  const template = allTemplates.find((item: any) => item.id === templateId);

  const [model, setModel] = useState<SessionTemplateModel | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!template) return;
    setModel({
      id: template.id,
      name: template.name || "",
      description: template.description || "",
      sections: (template.sections || []) as BlueprintSection[],
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
        sections: model.sections,
      });
      toast({ title: "Session template saved" });
    } catch {
      toast({ title: "Could not save session template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!model) return;
    if (!window.confirm(`Delete "${model.name}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(model.id);
      setLocation("/app/admin/templates?tab=sessions");
    } catch {
      toast({ title: "Could not delete session template", variant: "destructive" });
    }
  };

  const duplicate = async () => {
    if (!model) return;
    try {
      const created = await createTemplate.mutateAsync({
        name: `${model.name} (Copy)`,
        description: model.description.trim() || null,
        sections: model.sections,
      });
      toast({ title: "Session template duplicated" });
      setLocation(`/app/admin/templates/sessions/${created.id}?tab=sessions`);
    } catch {
      toast({ title: "Could not duplicate session template", variant: "destructive" });
    }
  };

  if (!model) {
    return (
      <div className="w-full py-12 text-slate-500">Loading session template...</div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-20">
      <TemplateEditorHeader
        backHref="/app/admin/templates?tab=sessions"
        title="Session Templates"
        name={model.name}
        onNameChange={(value) => setModel((prev) => (prev ? { ...prev, name: value } : prev))}
        onSave={save}
        saveDisabled={saving || !model.name.trim()}
        saving={saving}
        onDelete={remove}
        onDuplicate={duplicate}
      />

      <SessionEditorCard
        session={model}
        sessionIdx={0}
        totalSessions={1}
        movementCheckEnabled
        sectionTemplates={sectionTemplates as any[]}
        exerciseTemplates={exerciseTemplates as any[]}
        onSessionChange={(updater) => setModel((prev) => (prev ? updater(prev as any) : prev))}
        onRemoveSession={() => {}}
        onCreateSection={() => makeSection(`Section ${model.sections.length + 1}`)}
        onCloneSectionTemplate={(templateSection) => cloneSectionFromTemplate(templateSection)}
        onCloneExerciseTemplate={(templateExercise) => cloneExerciseFromTemplate(toBlueprintExercise(templateExercise))}
      />
    </div>
  );
}
