import type { BlueprintExercise, BlueprintSection } from "@/lib/blueprintClone";
import { AddFromTemplatesModal } from "@/components/admin/AddFromTemplatesModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  Library,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { type DragEvent, useState } from "react";

type SectionEditorCardProps = {
  section: BlueprintSection;
  sectionIdx: number;
  sectionCount: number;
  allSections?: Array<{ id: string; name: string }>;
  movementCheckEnabled: boolean;
  exerciseTemplates: any[];
  onSectionNameChange: (name: string) => void;
  onRemoveSection: () => void;
  onMoveSection: (direction: "up" | "down") => void;
  onMoveSectionToIndex?: (targetSectionIdx: number) => void;
  onDuplicateSection?: () => void;
  onSaveSectionToTemplate?: () => void;
  onAddExerciseByName: (name: string) => void;
  onAddExerciseFromTemplate: (templateExercise: any) => void;
  onRemoveExercise: (exerciseIdx: number) => void;
  onDuplicateExercise?: (exerciseIdx: number) => void;
  onSaveExerciseToTemplate?: (exerciseIdx: number) => void;
  onMoveExercise: (exerciseIdx: number, direction: "up" | "down") => void;
  onMoveExerciseToIndex?: (exerciseIdx: number, targetExerciseIdx: number) => void;
  onMoveExerciseToSection?: (exerciseIdx: number, targetSectionId: string) => void;
  onDropExerciseFromSection?: (
    sourceSectionId: string,
    sourceExerciseId: string,
    targetExerciseIdx: number,
  ) => void;
  onExerciseFieldChange: (exerciseIdx: number, field: keyof BlueprintExercise, value: any) => void;
};

function sectionLetterForIndex(index: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `S${index + 1}`;
}

function formatPrescription(exercise: BlueprintExercise): string {
  return [
    exercise.sets ? `${exercise.sets} sets` : null,
    exercise.reps ? `${exercise.reps} reps` : null,
    exercise.load && exercise.load !== "Auto" ? exercise.load : null,
    exercise.tempo || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

type BuilderDragPayload = {
  type?: string;
  sectionId?: string;
  exerciseId?: string;
  exerciseIdx?: number;
};

function readBuilderDragPayload(event: DragEvent): BuilderDragPayload | null {
  const raw = event.dataTransfer.getData("application/openmovement-builder");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BuilderDragPayload;
  } catch {
    return null;
  }
}

function hasBuilderDragPayload(event: DragEvent): boolean {
  return event.dataTransfer.types.includes("application/openmovement-builder");
}

export function SectionEditorCard({
  section,
  sectionIdx,
  sectionCount,
  allSections = [],
  movementCheckEnabled,
  exerciseTemplates,
  onSectionNameChange,
  onRemoveSection,
  onMoveSectionToIndex,
  onDuplicateSection,
  onSaveSectionToTemplate,
  onAddExerciseByName,
  onAddExerciseFromTemplate,
  onRemoveExercise,
  onDuplicateExercise,
  onSaveExerciseToTemplate,
  onMoveExerciseToIndex,
  onMoveExerciseToSection,
  onDropExerciseFromSection,
  onExerciseFieldChange,
}: SectionEditorCardProps) {
  const [addExerciseModalOpen, setAddExerciseModalOpen] = useState(false);
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<Set<string>>(new Set());

  const toggleExercise = (exerciseId: string) => {
    setExpandedExerciseIds((previous) => {
      const next = new Set(previous);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  };

  const moveTargetSections = allSections.filter((candidate) => candidate.id !== section.id);
  const sectionLetter = sectionLetterForIndex(sectionIdx);

  return (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
      onDragOver={(event) => {
        if (hasBuilderDragPayload(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        const payload = readBuilderDragPayload(event);
        if (!payload) return;
        if (payload.type === "section" && payload.sectionId !== section.id) {
          event.preventDefault();
          event.stopPropagation();
          onMoveSectionToIndex?.(sectionIdx);
          return;
        }
        if (payload.type === "exercise" && payload.exerciseId && payload.sectionId) {
          event.preventDefault();
          event.stopPropagation();
          if (payload.sectionId === section.id) {
            const lastExerciseIdx = section.exercises.length - 1;
            if (
              typeof payload.exerciseIdx === "number" &&
              lastExerciseIdx >= 0 &&
              payload.exerciseIdx !== lastExerciseIdx
            ) {
              onMoveExerciseToIndex?.(payload.exerciseIdx, lastExerciseIdx);
            }
            return;
          }
          onDropExerciseFromSection?.(
            payload.sectionId,
            payload.exerciseId,
            section.exercises.length,
          );
        }
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="cursor-grab rounded p-1 text-slate-300 hover:bg-white hover:text-slate-500 active:cursor-grabbing"
          draggable={Boolean(onMoveSectionToIndex)}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(
              "application/openmovement-builder",
              JSON.stringify({ type: "section", sectionId: section.id }),
            );
          }}
          title="Drag section"
        >
          <GripVertical className="h-4 w-4 shrink-0" />
        </span>
        <Input
          value={section.name}
          onChange={(e) => onSectionNameChange(e.target.value)}
          className="h-8 max-w-[260px] border-none bg-transparent px-1 text-sm font-semibold text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300"
        />
        <div className="flex-1" />
        {onSaveSectionToTemplate ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-indigo-600"
            onClick={onSaveSectionToTemplate}
            title="Save section as template"
          >
            <Library className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {onDuplicateSection ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-slate-400 hover:text-indigo-600"
            onClick={onDuplicateSection}
            title="Duplicate section"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {sectionCount > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-rose-600"
            onClick={onRemoveSection}
            title="Remove section"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {section.exercises.map((ex, exIdx) => {
          const isExpanded = expandedExerciseIds.has(ex.id);
          return (
            <div
              key={ex.id}
              className="group overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]"
              onDragOver={(event) => {
                if (hasBuilderDragPayload(event)) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.stopPropagation();
                const payload = readBuilderDragPayload(event);
                if (payload?.type !== "exercise" || !payload.exerciseId || !payload.sectionId) {
                  return;
                }
                event.preventDefault();
                if (payload.sectionId === section.id) {
                  if (typeof payload.exerciseIdx === "number" && payload.exerciseIdx !== exIdx) {
                    onMoveExerciseToIndex?.(payload.exerciseIdx, exIdx);
                  }
                  return;
                }
                onDropExerciseFromSection?.(payload.sectionId, payload.exerciseId, exIdx);
              }}
            >
              <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-1.5 px-2 py-1.5">
                <span
                  className="cursor-grab rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
                  draggable
                  onDragStart={(event) => {
                    event.stopPropagation();
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                      "application/openmovement-builder",
                      JSON.stringify({
                        type: "exercise",
                        sectionId: section.id,
                        exerciseId: ex.id,
                        exerciseIdx: exIdx,
                      }),
                    );
                  }}
                  title="Drag exercise"
                >
                  <GripVertical className="h-4 w-4 shrink-0" />
                </span>
                <button
                  type="button"
                  className="h-6 w-6 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => toggleExercise(ex.id)}
                  data-testid={`button-expand-exercise-${ex.id}`}
                  title={isExpanded ? "Collapse exercise" : "Open exercise"}
                >
                  {isExpanded ? (
                    <ChevronDown className="mx-auto h-4 w-4" />
                  ) : (
                    <ChevronRight className="mx-auto h-4 w-4" />
                  )}
                </button>

                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2">
                  <span className="row-span-2 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {sectionLetter}
                    {exIdx + 1}
                  </span>
                  <Input
                    value={ex.name}
                    onChange={(e) => onExerciseFieldChange(exIdx, "name", e.target.value)}
                    className="h-6 min-w-0 border-none bg-transparent px-1 font-semibold text-slate-900 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300"
                  />
                  <div className="min-w-0 truncate px-1 text-xs text-slate-500">
                    {formatPrescription(ex)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {movementCheckEnabled && (
                    <div className="flex items-center gap-1.5 mr-1">
                      <Checkbox
                        checked={ex.requiresMovementCheck}
                        onCheckedChange={(checked) =>
                          onExerciseFieldChange(exIdx, "requiresMovementCheck", !!checked)
                        }
                      />
                      <span className="hidden text-[10px] uppercase tracking-wider text-slate-400 font-semibold whitespace-nowrap sm:inline">
                        Video check
                      </span>
                    </div>
                  )}
                  {moveTargetSections.length > 0 && onMoveExerciseToSection ? (
                    <Select
                      onValueChange={(targetSectionId) =>
                        onMoveExerciseToSection(exIdx, targetSectionId)
                      }
                    >
                      <SelectTrigger className="h-7 w-[104px] text-xs" aria-label="Move to section">
                        <SelectValue placeholder="Move" />
                      </SelectTrigger>
                      <SelectContent>
                        {moveTargetSections.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.name || "Untitled section"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  {onDuplicateExercise ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                      onClick={() => onDuplicateExercise(exIdx)}
                      title="Duplicate exercise"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {onSaveExerciseToTemplate ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                      onClick={() => onSaveExerciseToTemplate(exIdx)}
                      title="Save exercise as template"
                    >
                      <Library className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-rose-600 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemoveExercise(exIdx)}
                    title="Remove exercise"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isExpanded ? (
                <div
                  className="border-t border-slate-100 bg-slate-50/60 p-3 space-y-3"
                  data-testid={`exercise-details-${ex.id}`}
                >
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {(
                      [
                        { key: "sets", label: "Sets" },
                        { key: "reps", label: "Reps" },
                        { key: "load", label: "Load" },
                        { key: "tempo", label: "Tempo" },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          {label}
                        </Label>
                        <Input
                          value={ex[key]}
                          onChange={(e) => onExerciseFieldChange(exIdx, key, e.target.value)}
                          className="h-8 bg-white border-slate-200 font-medium"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        Goal
                      </Label>
                      <Input
                        value={ex.goal}
                        onChange={(e) => onExerciseFieldChange(exIdx, "goal", e.target.value)}
                        placeholder="Target or progression"
                        className="h-8 text-sm bg-white border-slate-200 text-slate-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        Coaching notes
                      </Label>
                      <Input
                        value={ex.notes}
                        onChange={(e) => onExerciseFieldChange(exIdx, "notes", e.target.value)}
                        placeholder="Internal notes"
                        className="h-8 text-sm bg-white border-slate-200 text-slate-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      Instructions
                    </Label>
                    <Textarea
                      value={ex.additionalInstructions}
                      onChange={(e) =>
                        onExerciseFieldChange(exIdx, "additionalInstructions", e.target.value)
                      }
                      placeholder="Cues, form tips, modifications..."
                      className="min-h-[56px] text-sm bg-white border-slate-200 text-slate-600 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-slate-400 shrink-0" />
                      <Input
                        value={ex.demoUrl || ""}
                        onChange={(e) => onExerciseFieldChange(exIdx, "demoUrl", e.target.value)}
                        placeholder="Demo video URL"
                        className="h-8 text-sm bg-white border-slate-200 text-slate-600"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                      <Label className="text-xs text-slate-500">Structured logging</Label>
                      <Switch
                        checked={ex.enableStructuredLogging}
                        onCheckedChange={(checked) =>
                          onExerciseFieldChange(exIdx, "enableStructuredLogging", checked)
                        }
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
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
        allLabel="All Exercises"
        searchPlaceholder="Search exercise templates..."
        folderType="exercise"
        templates={exerciseTemplates}
        getTemplateId={(item: any) => item.id}
        getTemplateName={(item: any) => item.name}
        getTemplateMeta={(item: any) => item.targetMuscle || ""}
        getTemplateSearchText={(item: any) => item.targetMuscle || ""}
        getTemplateFolderId={(item: any) => item.folderId ?? null}
        onCreateNew={() => onAddExerciseByName("New Exercise")}
        onInsertTemplate={onAddExerciseFromTemplate}
      />
    </div>
  );
}
