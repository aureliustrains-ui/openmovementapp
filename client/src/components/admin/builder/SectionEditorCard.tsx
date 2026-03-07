import type { BlueprintExercise, BlueprintSection } from "@/lib/blueprintClone";
import { AddFromTemplatesModal } from "@/components/admin/AddFromTemplatesModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, Plus, Trash2, Video } from "lucide-react";
import { useState } from "react";

type SectionEditorCardProps = {
  section: BlueprintSection;
  sectionIdx: number;
  sectionCount: number;
  movementCheckEnabled: boolean;
  exerciseTemplates: any[];
  onSectionNameChange: (name: string) => void;
  onRemoveSection: () => void;
  onMoveSection: (direction: "up" | "down") => void;
  onAddExerciseByName: (name: string) => void;
  onAddExerciseFromTemplate: (templateExercise: any) => void;
  onRemoveExercise: (exerciseIdx: number) => void;
  onMoveExercise: (exerciseIdx: number, direction: "up" | "down") => void;
  onExerciseFieldChange: (exerciseIdx: number, field: keyof BlueprintExercise, value: any) => void;
};

export function SectionEditorCard({
  section,
  sectionIdx,
  sectionCount,
  movementCheckEnabled,
  exerciseTemplates,
  onSectionNameChange,
  onRemoveSection,
  onMoveSection,
  onAddExerciseByName,
  onAddExerciseFromTemplate,
  onRemoveExercise,
  onMoveExercise,
  onExerciseFieldChange,
}: SectionEditorCardProps) {
  const [addExerciseModalOpen, setAddExerciseModalOpen] = useState(false);

  return (
    <div className="border-2 border-slate-200 rounded-2xl bg-slate-50/50 p-4 relative">
      <div className="flex items-center gap-2 mb-4">
        <Input
          value={section.name}
          onChange={(e) => onSectionNameChange(e.target.value)}
          className="text-sm font-bold uppercase tracking-wider text-slate-700 border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300 px-2 h-8 bg-transparent max-w-[260px]"
        />
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-indigo-600"
            onClick={() => onMoveSection("up")}
            disabled={sectionIdx === 0}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-indigo-600"
            onClick={() => onMoveSection("down")}
            disabled={sectionIdx >= sectionCount - 1}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
        {sectionCount > 1 && (
          <Button variant="ghost" size="sm" className="h-7 text-slate-400 hover:text-rose-600" onClick={onRemoveSection}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
        )}
      </div>

      <div>
        {section.exercises.map((ex, exIdx) => (
          <div key={ex.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-3 shadow-sm group">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => onMoveExercise(exIdx, "up")}
                    disabled={exIdx === 0}
                    className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onMoveExercise(exIdx, "down")}
                    disabled={exIdx === section.exercises.length - 1}
                    className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  value={ex.name}
                  onChange={(e) => onExerciseFieldChange(exIdx, "name", e.target.value)}
                  className="font-semibold text-slate-900 border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300 px-1 h-8 bg-transparent"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {movementCheckEnabled && (
                  <div className="flex items-center gap-1.5 mr-2">
                    <Checkbox
                      checked={ex.requiresMovementCheck}
                      onCheckedChange={(checked) => onExerciseFieldChange(exIdx, "requiresMovementCheck", !!checked)}
                    />
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold whitespace-nowrap">Video check</span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemoveExercise(exIdx)}
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
                    onChange={(e) => onExerciseFieldChange(exIdx, key, e.target.value)}
                    className="h-9 bg-slate-50 border-slate-200 font-medium"
                  />
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Goal</Label>
                <Input
                  value={ex.goal}
                  onChange={(e) => onExerciseFieldChange(exIdx, "goal", e.target.value)}
                  placeholder="e.g. Hit 3x10 at RPE 7, increase load by 2.5kg next week"
                  className="h-8 text-sm bg-white border-slate-200 text-slate-600"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Additional Instructions</Label>
                <Textarea
                  value={ex.additionalInstructions}
                  onChange={(e) => onExerciseFieldChange(exIdx, "additionalInstructions", e.target.value)}
                  placeholder="Cues, form tips, modifications..."
                  className="min-h-[60px] text-sm bg-white border-slate-200 text-slate-600 resize-none"
                />
              </div>
              <Input
                value={ex.notes}
                onChange={(e) => onExerciseFieldChange(exIdx, "notes", e.target.value)}
                placeholder="Coaching notes..."
                className="h-8 text-sm bg-white border-slate-200 text-slate-600"
              />
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-slate-400 shrink-0" />
                <Input
                  value={ex.demoUrl || ""}
                  onChange={(e) => onExerciseFieldChange(exIdx, "demoUrl", e.target.value)}
                  placeholder="Demo video URL (YouTube, Vimeo, etc.)"
                  className="h-8 text-sm bg-white border-slate-200 text-slate-600"
                />
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <Label className="text-xs text-slate-500">Enable structured set logging for client</Label>
                <Switch
                  checked={ex.enableStructuredLogging}
                  onCheckedChange={(checked) => onExerciseFieldChange(exIdx, "enableStructuredLogging", checked)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full mt-2 border-dashed border-slate-300 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300"
        onClick={() => setAddExerciseModalOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" /> Add Exercise
      </Button>

      <AddFromTemplatesModal
        open={addExerciseModalOpen}
        onOpenChange={setAddExerciseModalOpen}
        title="Add Exercise"
        description="Create a new exercise or insert one from Exercise Templates."
        createLabel="Create new exercise"
        searchPlaceholder="Search exercise templates..."
        templates={exerciseTemplates}
        getTemplateId={(item: any) => item.id}
        getTemplateName={(item: any) => item.name}
        getTemplateMeta={(item: any) => item.targetMuscle || ""}
        onCreateNew={() => onAddExerciseByName("New Exercise")}
        onInsertTemplate={onAddExerciseFromTemplate}
      />
    </div>
  );
}
