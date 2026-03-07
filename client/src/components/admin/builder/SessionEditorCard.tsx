import type { BlueprintExercise, BlueprintSection } from "@/lib/blueprintClone";
import { AddFromTemplatesModal } from "@/components/admin/AddFromTemplatesModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SectionEditorCard } from "./SectionEditorCard";

type SessionLike = {
  id: string;
  name: string;
  description: string;
  sections: BlueprintSection[];
};

type SessionEditorCardProps<TSession extends SessionLike> = {
  session: TSession;
  sessionIdx: number;
  totalSessions: number;
  movementCheckEnabled: boolean;
  sectionTemplates: any[];
  exerciseTemplates: any[];
  onSessionChange: (updater: (session: TSession) => TSession) => void;
  onRemoveSession: () => void;
  onCreateSection: () => BlueprintSection;
  onCloneSectionTemplate: (template: any) => BlueprintSection;
  onCloneExerciseTemplate: (template: any) => BlueprintExercise;
};

export function SessionEditorCard<TSession extends SessionLike>({
  session,
  sessionIdx,
  totalSessions,
  movementCheckEnabled,
  sectionTemplates,
  exerciseTemplates,
  onSessionChange,
  onRemoveSession,
  onCreateSection,
  onCloneSectionTemplate,
  onCloneExerciseTemplate,
}: SessionEditorCardProps<TSession>) {
  const [collapsed, setCollapsed] = useState(false);
  const [addSectionModalOpen, setAddSectionModalOpen] = useState(false);

  const exerciseCount = useMemo(
    () => session.sections.reduce((sum, section) => sum + section.exercises.length, 0),
    [session.sections],
  );

  const addSection = () => {
    onSessionChange((prev) => ({ ...prev, sections: [...prev.sections, onCreateSection()] }));
  };

  const addSectionFromTemplate = (templateSection: any) => {
    onSessionChange((prev) => ({ ...prev, sections: [...prev.sections, onCloneSectionTemplate(templateSection)] }));
  };

  const moveSection = (sectionIdx: number, direction: "up" | "down") => {
    onSessionChange((prev) => {
      const next = [...prev.sections];
      const targetIdx = direction === "up" ? sectionIdx - 1 : sectionIdx + 1;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      [next[sectionIdx], next[targetIdx]] = [next[targetIdx], next[sectionIdx]];
      return { ...prev, sections: next };
    });
  };

  return (
    <div className="border border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
      <div
        className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {collapsed ? <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" /> : <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />}
          <Badge variant="secondary" className="bg-indigo-600 text-white border-none shrink-0 text-xs">S{sessionIdx + 1}</Badge>
          <Input
            value={session.name}
            onChange={(e) => onSessionChange((prev) => ({ ...prev, name: e.target.value }))}
            onClick={(e) => e.stopPropagation()}
            className="text-lg font-display font-bold text-white border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-400 px-2 h-auto bg-transparent placeholder:text-slate-400"
            placeholder="Session name..."
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-400">
            {session.sections.length} section{session.sections.length !== 1 ? "s" : ""} / {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}
          </span>
          {totalSessions > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-rose-400 hover:bg-slate-800"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveSession();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="p-6 space-y-4">
          <Textarea
            value={session.description}
            onChange={(e) => onSessionChange((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Session description"
            className="bg-slate-50 border-slate-200"
          />

          {session.sections.map((section, sectionIdx) => (
            <SectionEditorCard
              key={section.id}
              section={section}
              sectionIdx={sectionIdx}
              sectionCount={session.sections.length}
              movementCheckEnabled={movementCheckEnabled}
              exerciseTemplates={exerciseTemplates}
              onSectionNameChange={(name) => {
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.map((sec, idx) => (idx === sectionIdx ? { ...sec, name } : sec)),
                }));
              }}
              onRemoveSection={() => {
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.filter((_, idx) => idx !== sectionIdx),
                }));
              }}
              onMoveSection={(direction) => moveSection(sectionIdx, direction)}
              onAddExerciseByName={(name) => {
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.map((sec, idx) =>
                    idx === sectionIdx
                      ? {
                          ...sec,
                          exercises: [
                            ...sec.exercises,
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
                        }
                      : sec,
                  ),
                }));
              }}
              onAddExerciseFromTemplate={(templateExercise) => {
                const cloned = onCloneExerciseTemplate(templateExercise);
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.map((sec, idx) =>
                    idx === sectionIdx
                      ? { ...sec, exercises: [...sec.exercises, cloned] }
                      : sec,
                  ),
                }));
              }}
              onRemoveExercise={(exerciseIdx) => {
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.map((sec, idx) =>
                    idx === sectionIdx
                      ? { ...sec, exercises: sec.exercises.filter((_, exIdx) => exIdx !== exerciseIdx) }
                      : sec,
                  ),
                }));
              }}
              onMoveExercise={(exerciseIdx, direction) => {
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.map((sec, idx) => {
                    if (idx !== sectionIdx) return sec;
                    const exercises = [...sec.exercises];
                    const targetIdx = direction === "up" ? exerciseIdx - 1 : exerciseIdx + 1;
                    if (targetIdx < 0 || targetIdx >= exercises.length) return sec;
                    [exercises[exerciseIdx], exercises[targetIdx]] = [exercises[targetIdx], exercises[exerciseIdx]];
                    return { ...sec, exercises };
                  }),
                }));
              }}
              onExerciseFieldChange={(exerciseIdx, field, value) => {
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.map((sec, idx) =>
                    idx === sectionIdx
                      ? {
                          ...sec,
                          exercises: sec.exercises.map((ex, exIdx) =>
                            exIdx === exerciseIdx ? { ...ex, [field]: value } : ex,
                          ),
                        }
                      : sec,
                  ),
                }));
              }}
            />
          ))}

          <Button
            variant="outline"
            className="w-full border-dashed border-slate-300 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 rounded-xl"
            onClick={() => setAddSectionModalOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Section
          </Button>
        </div>
      )}

      <AddFromTemplatesModal
        open={addSectionModalOpen}
        onOpenChange={setAddSectionModalOpen}
        title="Add Section"
        description="Create a new section or insert one from Section Templates."
        createLabel="Create new section"
        searchPlaceholder="Search section templates..."
        templates={sectionTemplates}
        getTemplateId={(item: any) => item.id}
        getTemplateName={(item: any) => item.name}
        getTemplateMeta={(item: any) => `${(item.exercises || []).length} exercise(s)`}
        onCreateNew={addSection}
        onInsertTemplate={addSectionFromTemplate}
      />
    </div>
  );
}
