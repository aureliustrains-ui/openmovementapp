import type { BlueprintExercise, BlueprintSection } from "@/lib/blueprintClone";
import { AddFromTemplatesModal } from "@/components/admin/AddFromTemplatesModal";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  Library,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
import { SectionEditorCard } from "./SectionEditorCard";

type SessionLike = {
  id: string;
  name: string;
  description: string;
  durationMinutes?: number | null;
  sessionVideoUrl?: string;
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
  onDuplicateSession?: () => void;
  onMoveSessionToIndex?: (targetSessionIdx: number) => void;
  onSaveSessionToTemplate?: () => void;
  onSaveSectionToTemplate?: (sectionIdx: number) => void;
  onSaveExerciseToTemplate?: (sectionIdx: number, exerciseIdx: number) => void;
  onCreateSection: () => BlueprintSection;
  onCloneSectionTemplate: (template: any) => BlueprintSection;
  onCloneExerciseTemplate: (template: any) => BlueprintExercise;
  onCloneExercise: (exercise: BlueprintExercise) => BlueprintExercise;
  onCloneSection: (section: BlueprintSection) => BlueprintSection;
  showSessionVideoField?: boolean;
};

type BuilderDragPayload = {
  type?: string;
  sessionIdx?: number;
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

export function SessionEditorCard<TSession extends SessionLike>({
  session,
  sessionIdx,
  totalSessions,
  movementCheckEnabled,
  sectionTemplates,
  exerciseTemplates,
  onSessionChange,
  onRemoveSession,
  onDuplicateSession,
  onMoveSessionToIndex,
  onSaveSessionToTemplate,
  onSaveSectionToTemplate,
  onSaveExerciseToTemplate,
  onCreateSection,
  onCloneSectionTemplate,
  onCloneExerciseTemplate,
  onCloneExercise,
  onCloneSection,
  showSessionVideoField = false,
}: SessionEditorCardProps<TSession>) {
  const [collapsed, setCollapsed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addSectionModalOpen, setAddSectionModalOpen] = useState(false);

  const exerciseCount = useMemo(
    () => session.sections.reduce((sum, section) => sum + section.exercises.length, 0),
    [session.sections],
  );

  const addSection = () => {
    onSessionChange((prev) => ({ ...prev, sections: [...prev.sections, onCreateSection()] }));
  };

  const addSectionFromTemplate = (templateSection: any) => {
    onSessionChange((prev) => ({
      ...prev,
      sections: [...prev.sections, onCloneSectionTemplate(templateSection)],
    }));
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

  const moveSectionToIndex = (sourceIdx: number, targetIdx: number) => {
    onSessionChange((prev) => {
      const clampedTargetIdx = Math.max(0, Math.min(targetIdx, prev.sections.length - 1));
      if (sourceIdx === clampedTargetIdx) return prev;
      const sections = [...prev.sections];
      const [moving] = sections.splice(sourceIdx, 1);
      if (!moving) return prev;
      sections.splice(clampedTargetIdx, 0, moving);
      return { ...prev, sections };
    });
  };

  const moveExerciseToIndex = (
    sectionIdx: number,
    sourceExerciseIdx: number,
    targetExerciseIdx: number,
  ) => {
    onSessionChange((prev) => ({
      ...prev,
      sections: prev.sections.map((sec, idx) => {
        if (idx !== sectionIdx) return sec;
        const clampedTargetIdx = Math.max(0, Math.min(targetExerciseIdx, sec.exercises.length - 1));
        if (sourceExerciseIdx === clampedTargetIdx) return sec;
        const exercises = [...sec.exercises];
        const [moving] = exercises.splice(sourceExerciseIdx, 1);
        if (!moving) return sec;
        exercises.splice(clampedTargetIdx, 0, moving);
        return { ...sec, exercises };
      }),
    }));
  };

  const dropExerciseFromSection = (
    sourceSectionId: string,
    sourceExerciseId: string,
    targetSectionIdx: number,
    targetExerciseIdx: number,
  ) => {
    onSessionChange((prev) => {
      let movingExercise: BlueprintExercise | null = null;
      const sectionsWithoutMoving = prev.sections.map((sec) => {
        if (sec.id !== sourceSectionId) return sec;
        const nextExercises = sec.exercises.filter((exercise) => {
          if (exercise.id !== sourceExerciseId) return true;
          movingExercise = exercise;
          return false;
        });
        return { ...sec, exercises: nextExercises };
      });

      if (!movingExercise) return prev;

      return {
        ...prev,
        sections: sectionsWithoutMoving.map((sec, idx) => {
          if (idx !== targetSectionIdx) return sec;
          const exercises = [...sec.exercises];
          const clampedTargetIdx = Math.max(0, Math.min(targetExerciseIdx, exercises.length));
          exercises.splice(clampedTargetIdx, 0, movingExercise as BlueprintExercise);
          return { ...sec, exercises };
        }),
      };
    });
  };

  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm ring-1 ring-slate-100"
      onDragOver={(event) => {
        if (hasBuilderDragPayload(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        const payload = readBuilderDragPayload(event);
        if (payload?.type === "session" && payload.sessionIdx !== sessionIdx) {
          event.preventDefault();
          onMoveSessionToIndex?.(sessionIdx);
        }
      }}
    >
      <div
        className="flex cursor-pointer select-none items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-4 py-3"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span
            className="cursor-grab rounded p-1 text-slate-300 hover:bg-white/70 hover:text-slate-500 active:cursor-grabbing"
            draggable={Boolean(onMoveSessionToIndex)}
            onClick={(event) => event.stopPropagation()}
            onDragStart={(event) => {
              event.stopPropagation();
              if (!onMoveSessionToIndex) return;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(
                "application/openmovement-builder",
                JSON.stringify({
                  type: "session",
                  sessionId: session.id,
                  sessionIdx,
                }),
              );
            }}
            title="Drag session"
          >
            <GripVertical className="h-4 w-4 shrink-0" />
          </span>
          {collapsed ? (
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
          )}
          <Badge
            variant="outline"
            className="shrink-0 border-slate-900 bg-slate-900 text-[10px] font-semibold text-white"
          >
            S{sessionIdx + 1}
          </Badge>
          <Input
            value={session.name}
            onChange={(e) => onSessionChange((prev) => ({ ...prev, name: e.target.value }))}
            onClick={(e) => e.stopPropagation()}
            className="h-8 border-none bg-transparent px-1 text-base font-bold text-slate-950 shadow-none focus-visible:ring-1 focus-visible:ring-slate-400"
            placeholder="Session name..."
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600">
            {session.sections.length} section{session.sections.length !== 1 ? "s" : ""} /{" "}
            {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}
          </span>
          {onMoveSessionToIndex ? (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveSessionToIndex(sessionIdx - 1);
                }}
                disabled={sessionIdx === 0}
                title="Move session up"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveSessionToIndex(sessionIdx + 1);
                }}
                disabled={sessionIdx >= totalSessions - 1}
                title="Move session down"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          {onSaveSessionToTemplate ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-slate-400 hover:text-indigo-600"
              onClick={(e) => {
                e.stopPropagation();
                onSaveSessionToTemplate();
              }}
              title="Save session as template"
            >
              <Library className="h-4 w-4" />
            </Button>
          ) : null}
          {onDuplicateSession ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-slate-400 hover:text-indigo-600"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateSession();
              }}
              title="Duplicate session"
            >
              <Copy className="h-4 w-4" />
            </Button>
          ) : null}
          {totalSessions > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-slate-400 hover:text-rose-600"
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
        <div className="space-y-3 bg-white p-3">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-slate-500"
              onClick={() => setDetailsOpen((prev) => !prev)}
            >
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Details
            </Button>
          </div>

          {detailsOpen ? (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <Textarea
                value={session.description}
                onChange={(e) =>
                  onSessionChange((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Session description"
                className="min-h-[72px] border-slate-200 bg-white"
              />

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Duration</label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={session.durationMinutes ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    const parsed = Number.parseInt(raw, 10);
                    const duration =
                      raw.length === 0 || !Number.isFinite(parsed) || parsed <= 0 ? null : parsed;
                    onSessionChange((prev) => ({ ...prev, durationMinutes: duration }));
                  }}
                  placeholder="min"
                  className="border-slate-200 bg-white"
                />
              </div>

              {showSessionVideoField ? (
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-medium text-slate-600">Session video</label>
                  <Input
                    value={session.sessionVideoUrl || ""}
                    onChange={(e) =>
                      onSessionChange((prev) => ({ ...prev, sessionVideoUrl: e.target.value }))
                    }
                    placeholder="https://youtube.com/watch?v=..."
                    className="border-slate-200 bg-white"
                  />
                  {session.sessionVideoUrl?.trim() ? (
                    <InlineVideoPlayer
                      url={session.sessionVideoUrl}
                      sourceType="link"
                      openLinkLabel="Open session video"
                      testId={`session-video-preview-${session.id}`}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {session.sections.map((section, sectionIdx) => (
            <SectionEditorCard
              key={section.id}
              section={section}
              sectionIdx={sectionIdx}
              sectionCount={session.sections.length}
              allSections={session.sections.map((candidate) => ({
                id: candidate.id,
                name: candidate.name,
              }))}
              movementCheckEnabled={movementCheckEnabled}
              exerciseTemplates={exerciseTemplates}
              onSectionNameChange={(name) => {
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.map((sec, idx) =>
                    idx === sectionIdx ? { ...sec, name } : sec,
                  ),
                }));
              }}
              onRemoveSection={() => {
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.filter((_, idx) => idx !== sectionIdx),
                }));
              }}
              onMoveSection={(direction) => moveSection(sectionIdx, direction)}
              onMoveSectionToIndex={(targetSectionIdx) =>
                moveSectionToIndex(sectionIdx, targetSectionIdx)
              }
              onDuplicateSection={() => {
                onSessionChange((prev) => {
                  const cloned = onCloneSection(prev.sections[sectionIdx]);
                  const sections = [...prev.sections];
                  sections.splice(sectionIdx + 1, 0, cloned);
                  return { ...prev, sections };
                });
              }}
              onSaveSectionToTemplate={
                onSaveSectionToTemplate ? () => onSaveSectionToTemplate(sectionIdx) : undefined
              }
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
                              load: "",
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
                    idx === sectionIdx ? { ...sec, exercises: [...sec.exercises, cloned] } : sec,
                  ),
                }));
              }}
              onRemoveExercise={(exerciseIdx) => {
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.map((sec, idx) =>
                    idx === sectionIdx
                      ? {
                          ...sec,
                          exercises: sec.exercises.filter((_, exIdx) => exIdx !== exerciseIdx),
                        }
                      : sec,
                  ),
                }));
              }}
              onDuplicateExercise={(exerciseIdx) => {
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.map((sec, idx) => {
                    if (idx !== sectionIdx) return sec;
                    const exercises = [...sec.exercises];
                    exercises.splice(
                      exerciseIdx + 1,
                      0,
                      onCloneExercise(sec.exercises[exerciseIdx]),
                    );
                    return { ...sec, exercises };
                  }),
                }));
              }}
              onSaveExerciseToTemplate={
                onSaveExerciseToTemplate
                  ? (exerciseIdx) => onSaveExerciseToTemplate(sectionIdx, exerciseIdx)
                  : undefined
              }
              onMoveExercise={(exerciseIdx, direction) => {
                onSessionChange((prev) => ({
                  ...prev,
                  sections: prev.sections.map((sec, idx) => {
                    if (idx !== sectionIdx) return sec;
                    const exercises = [...sec.exercises];
                    const targetIdx = direction === "up" ? exerciseIdx - 1 : exerciseIdx + 1;
                    if (targetIdx < 0 || targetIdx >= exercises.length) return sec;
                    [exercises[exerciseIdx], exercises[targetIdx]] = [
                      exercises[targetIdx],
                      exercises[exerciseIdx],
                    ];
                    return { ...sec, exercises };
                  }),
                }));
              }}
              onMoveExerciseToIndex={(exerciseIdx, targetExerciseIdx) =>
                moveExerciseToIndex(sectionIdx, exerciseIdx, targetExerciseIdx)
              }
              onMoveExerciseToSection={(exerciseIdx, targetSectionId) => {
                onSessionChange((prev) => {
                  const sourceSection = prev.sections[sectionIdx];
                  const movingExercise = sourceSection?.exercises[exerciseIdx];
                  if (!movingExercise) return prev;
                  return {
                    ...prev,
                    sections: prev.sections.map((sec, idx) => {
                      if (idx === sectionIdx) {
                        return {
                          ...sec,
                          exercises: sec.exercises.filter((_, exIdx) => exIdx !== exerciseIdx),
                        };
                      }
                      if (sec.id === targetSectionId) {
                        return { ...sec, exercises: [...sec.exercises, movingExercise] };
                      }
                      return sec;
                    }),
                  };
                });
              }}
              onDropExerciseFromSection={(sourceSectionId, sourceExerciseId, targetExerciseIdx) =>
                dropExerciseFromSection(
                  sourceSectionId,
                  sourceExerciseId,
                  sectionIdx,
                  targetExerciseIdx,
                )
              }
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
            className="w-full rounded-lg border-dashed border-slate-300 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
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
        allLabel="All Sections"
        searchPlaceholder="Search section templates..."
        folderType="section"
        templates={sectionTemplates}
        getTemplateId={(item: any) => item.id}
        getTemplateName={(item: any) => item.name}
        getTemplateMeta={(item: any) => `${(item.exercises || []).length} exercise(s)`}
        getTemplateSearchText={(item: any) =>
          (item.exercises || []).map((exercise: any) => exercise.name || "").join(" ")
        }
        getTemplateFolderId={(item: any) => item.folderId ?? null}
        onCreateNew={addSection}
        onInsertTemplate={addSectionFromTemplate}
      />
    </div>
  );
}
