import type { BlueprintExercise, BlueprintSection } from "@/lib/blueprintClone";
import { AddFromTemplatesModal } from "@/components/admin/AddFromTemplatesModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  Library,
  Plus,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { type DragEvent, useState } from "react";
import { formatReps, formatSets } from "@/lib/prescription";
import {
  ExerciseFieldsEditor,
  toExerciseEditableFields,
} from "@/components/admin/exercise/ExerciseFieldsEditor";

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
    formatSets(exercise.sets),
    formatReps(exercise.reps),
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-700"
              aria-label="Section actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onSaveSectionToTemplate ? (
              <DropdownMenuItem onSelect={onSaveSectionToTemplate}>
                <Library className="mr-2 h-4 w-4" /> Save section as template
              </DropdownMenuItem>
            ) : null}
            {onDuplicateSection ? (
              <DropdownMenuItem onSelect={onDuplicateSection}>
                <Copy className="mr-2 h-4 w-4" /> Duplicate section
              </DropdownMenuItem>
            ) : null}
            {sectionCount > 1 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600"
                  onSelect={onRemoveSection}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove section
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
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
              <div
                className="grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-1.5 px-2 py-1.5 hover:bg-slate-50/70"
                onClick={(event) => {
                  // Clicking anywhere on the row opens it, except on its own controls.
                  const target = event.target as HTMLElement;
                  if (target.closest("input, button, select, [role='combobox'], [role='checkbox'], label, [draggable='true']")) return;
                  toggleExercise(ex.id);
                }}
              >
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-700"
                        aria-label="Exercise actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onDuplicateExercise ? (
                        <DropdownMenuItem onSelect={() => onDuplicateExercise(exIdx)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate exercise
                        </DropdownMenuItem>
                      ) : null}
                      {onSaveExerciseToTemplate ? (
                        <DropdownMenuItem onSelect={() => onSaveExerciseToTemplate(exIdx)}>
                          <Library className="mr-2 h-4 w-4" /> Save exercise as template
                        </DropdownMenuItem>
                      ) : null}
                      {moveTargetSections.length > 0 && onMoveExerciseToSection ? (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Move to section</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {moveTargetSections.map((candidate) => (
                              <DropdownMenuItem
                                key={candidate.id}
                                onSelect={() => onMoveExerciseToSection(exIdx, candidate.id)}
                              >
                                {candidate.name || "Untitled section"}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-rose-600 focus:text-rose-600"
                        onSelect={() => onRemoveExercise(exIdx)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove exercise
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {isExpanded ? (
                <div
                  className="border-t border-slate-100 bg-slate-50/60 p-3"
                  data-testid={`exercise-details-${ex.id}`}
                >
                  <ExerciseFieldsEditor
                    idPrefix={`builder-${ex.id}`}
                    value={toExerciseEditableFields(ex)}
                    onChange={(field, value) => onExerciseFieldChange(exIdx, field, value)}
                    showMovementCheck={movementCheckEnabled}
                  />
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
