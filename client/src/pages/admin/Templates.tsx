import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Save, Layers, Library, Shapes, Spline, Video } from "lucide-react";
import {
  exerciseTemplatesQuery,
  phaseTemplatesQuery,
  sectionTemplatesQuery,
  sessionTemplatesQuery,
  templateFoldersQuery,
  useCreateExerciseTemplate,
  useCreatePhaseTemplate,
  useCreateSectionTemplate,
  useCreateSessionTemplate,
  useCreateTemplateFolder,
  useDeleteExerciseTemplate,
  useDeletePhaseTemplate,
  useDeleteSectionTemplate,
  useDeleteSessionTemplate,
  useDeleteTemplateFolder,
  useMoveTemplateToFolder,
  useReorderTemplates,
  useUpdateExerciseTemplate,
  useUpdateTemplateFolder,
  type TemplateFolderType,
} from "@/lib/api";
import {
  clonePhaseTemplate,
  cloneSectionFromTemplate,
  cloneSessionFromTemplate,
} from "@/lib/blueprintClone";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";
import { TemplateLibraryPane } from "@/components/admin/TemplateLibraryPane";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

function DemoVideoPreview({
  url,
  size = "tiny",
}: {
  url?: string | null;
  size?: "tiny" | "inline";
}) {
  if (!url) return null;

  return (
    <div
      className={
        size === "tiny"
          ? "w-72 max-w-[44vw] shrink-0 self-stretch overflow-hidden rounded-md [&_.aspect-video]:h-full [&_.aspect-video]:rounded-md"
          : "w-60 max-w-full shrink-0 overflow-hidden rounded-md [&_.aspect-video]:rounded-md"
      }
    >
      <InlineVideoPlayer url={url} sourceType="link" openLinkLabel="Open demo" flush />
    </div>
  );
}

function makeDefaultPhaseTemplatePayload() {
  return {
    name: "New Phase Template",
    goal: null,
    durationWeeks: 4,
    movementCheckEnabled: false,
    sessions: [
      {
        id: crypto.randomUUID(),
        name: "Session 1",
        description: "",
        durationMinutes: null,
        sections: [{ id: crypto.randomUUID(), name: "A. Main", exercises: [] }],
      },
    ],
    schedule: [],
  };
}

function makeDefaultSessionTemplate() {
  return {
    name: "New Session Template",
    description: null,
    durationMinutes: null,
    sections: [{ id: crypto.randomUUID(), name: "Section 1", exercises: [] }],
  };
}

function makeDefaultSectionTemplate() {
  return {
    name: "New Section Template",
    description: null,
    exercises: [],
  };
}

function makeDefaultExerciseTemplate() {
  return {
    name: "New Exercise Template",
    targetMuscle: null,
    demoUrl: null,
    sets: "3",
    reps: "10",
    load: "",
    tempo: "3010",
    notes: null,
    goal: null,
    additionalInstructions: null,
    requiresMovementCheck: false,
    enableStructuredLogging: false,
  };
}

function toTemplateItem<
  T extends { id: string; name: string; folderId?: string | null; sortOrder?: number },
>(entries: T[]) {
  return entries.map((entry) => ({
    ...entry,
    folderId: entry.folderId ?? null,
    sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : 0,
  }));
}

type TemplateTab = "phases" | "sessions" | "sections" | "exercises";

type FolderStateByTab = Record<TemplateTab, string | null>;

const TEMPLATE_TAB_STORAGE_KEY = "admin.templates.activeTab";
const TEMPLATE_FOLDER_STORAGE_KEY = "admin.templates.folderByTab";

const DEFAULT_FOLDERS_BY_TAB: FolderStateByTab = {
  phases: null,
  sessions: null,
  sections: null,
  exercises: null,
};

function isTemplateTab(value: string | null): value is TemplateTab {
  return (
    value === "phases" || value === "sessions" || value === "sections" || value === "exercises"
  );
}

function buildTemplatesUrl(tab: TemplateTab, folderId: string | null) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (folderId) params.set("folder", folderId);
  return `/app/admin/templates?${params.toString()}`;
}

function readStoredFolderState(): FolderStateByTab {
  if (typeof window === "undefined") return DEFAULT_FOLDERS_BY_TAB;
  const raw = window.localStorage.getItem(TEMPLATE_FOLDER_STORAGE_KEY);
  if (!raw) return DEFAULT_FOLDERS_BY_TAB;
  try {
    const parsed = JSON.parse(raw) as Partial<FolderStateByTab>;
    return {
      phases: parsed.phases ?? null,
      sessions: parsed.sessions ?? null,
      sections: parsed.sections ?? null,
      exercises: parsed.exercises ?? null,
    };
  } catch {
    return DEFAULT_FOLDERS_BY_TAB;
  }
}

function resolveInitialTemplateState(): { tab: TemplateTab; folders: FolderStateByTab } {
  if (typeof window === "undefined") {
    return { tab: "phases", folders: DEFAULT_FOLDERS_BY_TAB };
  }
  const params = new URLSearchParams(window.location.search);
  const queryTab = params.get("tab");
  const queryFolder = params.get("folder");
  const storedTab = window.localStorage.getItem(TEMPLATE_TAB_STORAGE_KEY);
  const tab = isTemplateTab(queryTab) ? queryTab : isTemplateTab(storedTab) ? storedTab : "phases";

  const folders = readStoredFolderState();
  if (queryFolder && queryFolder.trim().length > 0) {
    folders[tab] = queryFolder.trim();
  }

  return { tab, folders };
}

function getNextSortOrder(
  items: Array<{ folderId: string | null; sortOrder: number }>,
  folderId: string | null,
) {
  let next = -1;
  for (const item of items) {
    if ((item.folderId ?? null) !== folderId) continue;
    next = Math.max(next, item.sortOrder ?? 0);
  }
  return next + 1;
}

function exercisePrescription(exercise: any) {
  return [
    exercise?.sets ? `${exercise.sets} sets` : null,
    exercise?.reps ? `${exercise.reps} reps` : null,
    exercise?.tempo || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function renderSectionTemplatePreview(item: any) {
  const exercises = ((item.exercises || []) as any[]).slice(0, 2);
  if (exercises.length === 0) {
    return <div className="text-xs text-slate-400">No exercises yet</div>;
  }
  return (
    <div className="space-y-0.5">
      {exercises.map((exercise, index) => (
        <div
          key={exercise.id || `${exercise.name}-${index}`}
          className="grid grid-cols-[28px_minmax(0,1fr)] rounded-md border border-slate-100 bg-slate-50 px-2 py-1"
        >
          <span className="text-xs font-semibold text-slate-500">A{index + 1}</span>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-slate-900">
              {exercise.name || "Untitled exercise"}
            </div>
            <div className="truncate text-xs text-slate-500">{exercisePrescription(exercise)}</div>
          </div>
        </div>
      ))}
      {(item.exercises || []).length > exercises.length ? (
        <div className="text-xs text-slate-400">
          +{(item.exercises || []).length - exercises.length} more
        </div>
      ) : null}
    </div>
  );
}

function renderExerciseTemplatePreview(item: any) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="truncate text-xs text-slate-500">{exercisePrescription(item)}</div>
      </div>
    </div>
  );
}

function ExerciseTemplateInlineTitle({ item }: { item: any }) {
  const updateExerciseTemplate = useUpdateExerciseTemplate();
  const [name, setName] = useState(item.name || "");

  useEffect(() => {
    setName(item.name || "");
  }, [item.id, item.name]);

  const saveName = async () => {
    const nextName = name.trim();
    if (!nextName || nextName === item.name) {
      setName(item.name || "");
      return;
    }
    await updateExerciseTemplate.mutateAsync({
      id: item.id,
      name: nextName,
      targetMuscle: item.targetMuscle || null,
      sets: item.sets || null,
      reps: item.reps || null,
      load: item.load || null,
      tempo: item.tempo || null,
      goal: item.goal || null,
      notes: item.notes || null,
      additionalInstructions: item.additionalInstructions || null,
      demoUrl: item.demoUrl || null,
      requiresMovementCheck: Boolean(item.requiresMovementCheck),
      enableStructuredLogging: Boolean(item.enableStructuredLogging),
    });
  };

  return (
    <Input
      value={name}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => void saveName()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setName(item.name || "");
          event.currentTarget.blur();
        }
      }}
      className="h-6 truncate border-transparent bg-transparent px-0 py-0 text-sm font-semibold text-slate-900 shadow-none focus-visible:border-slate-300 focus-visible:bg-white focus-visible:px-2 focus-visible:ring-1 focus-visible:ring-slate-200"
      onClick={(event) => event.stopPropagation()}
      draggable={false}
    />
  );
}

function ExerciseTemplateInlineDetails({ item }: { item: any }) {
  const { toast } = useToast();
  const updateExerciseTemplate = useUpdateExerciseTemplate();
  const [draft, setDraft] = useState({
    name: item.name || "",
    targetMuscle: item.targetMuscle || "",
    sets: item.sets || "",
    reps: item.reps || "",
    load: item.load || "",
    tempo: item.tempo || "",
    goal: item.goal || "",
    notes: item.notes || "",
    additionalInstructions: item.additionalInstructions || "",
    demoUrl: item.demoUrl || "",
    requiresMovementCheck: Boolean(item.requiresMovementCheck),
    enableStructuredLogging: Boolean(item.enableStructuredLogging),
  });

  useEffect(() => {
    setDraft({
      name: item.name || "",
      targetMuscle: item.targetMuscle || "",
      sets: item.sets || "",
      reps: item.reps || "",
      load: item.load || "",
      tempo: item.tempo || "",
      goal: item.goal || "",
      notes: item.notes || "",
      additionalInstructions: item.additionalInstructions || "",
      demoUrl: item.demoUrl || "",
      requiresMovementCheck: Boolean(item.requiresMovementCheck),
      enableStructuredLogging: Boolean(item.enableStructuredLogging),
    });
  }, [item]);

  const updateDraft = (field: keyof typeof draft, value: string | boolean) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const save = async () => {
    if (!draft.name.trim()) return;
    try {
      await updateExerciseTemplate.mutateAsync({
        id: item.id,
        name: draft.name.trim(),
        targetMuscle: draft.targetMuscle.trim() || null,
        sets: draft.sets.trim() || null,
        reps: draft.reps.trim() || null,
        load: draft.load.trim() || null,
        tempo: draft.tempo.trim() || null,
        goal: draft.goal.trim() || null,
        notes: draft.notes.trim() || null,
        additionalInstructions: draft.additionalInstructions.trim() || null,
        demoUrl: draft.demoUrl.trim() || null,
        requiresMovementCheck: draft.requiresMovementCheck,
        enableStructuredLogging: draft.enableStructuredLogging,
      });
      toast({ title: "Exercise template saved" });
    } catch {
      toast({ title: "Could not save exercise template", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Tags
          </Label>
          <Input
            value={draft.targetMuscle}
            onChange={(event) => updateDraft("targetMuscle", event.target.value)}
            placeholder="one-arm chin-up, bent arm, vertical pull..."
            className="h-8 bg-white"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Demo video URL
          </Label>
          <div className="flex min-w-0 items-center gap-2">
            <Video className="h-4 w-4 shrink-0 text-slate-400" />
            <Input
              value={draft.demoUrl}
              onChange={(event) => updateDraft("demoUrl", event.target.value)}
              placeholder="Paste video link"
              className="h-8 bg-white"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["sets", "Sets"],
            ["reps", "Reps"],
            ["tempo", "Tempo"],
          ] as const
        ).map(([field, label]) => (
          <div key={field} className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </Label>
            <Input
              value={draft[field]}
              onChange={(event) => updateDraft(field, event.target.value)}
              className="h-8 bg-white"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Goal
          </Label>
          <Input
            value={draft.goal}
            onChange={(event) => updateDraft("goal", event.target.value)}
            className="h-8 bg-white"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Notes
          </Label>
          <Input
            value={draft.notes}
            onChange={(event) => updateDraft("notes", event.target.value)}
            className="h-8 bg-white"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Instructions
        </Label>
        <Textarea
          value={draft.additionalInstructions}
          onChange={(event) => updateDraft("additionalInstructions", event.target.value)}
          className="min-h-[56px] resize-none bg-white"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
            <Label className="text-xs text-slate-500">Movement check</Label>
            <Switch
              checked={draft.requiresMovementCheck}
              onCheckedChange={(checked) => updateDraft("requiresMovementCheck", checked)}
            />
          </div>
        </div>
        <Button
          size="sm"
          className="bg-indigo-600 text-white hover:bg-indigo-700"
          disabled={updateExerciseTemplate.isPending || !draft.name.trim()}
          onClick={save}
        >
          <Save className="mr-1.5 h-4 w-4" />
          Save
        </Button>
      </div>

      {draft.demoUrl.trim() ? (
        <div className="rounded-md border border-slate-200 bg-white p-2">
          <DemoVideoPreview url={draft.demoUrl.trim()} size="inline" />
        </div>
      ) : null}
    </div>
  );
}

export default function AdminTemplatesPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const initialState = useMemo(resolveInitialTemplateState, []);
  const [activeTab, setActiveTab] = useState<TemplateTab>(initialState.tab);
  const [selectedFolderByTab, setSelectedFolderByTab] = useState<FolderStateByTab>(
    initialState.folders,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TEMPLATE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TEMPLATE_FOLDER_STORAGE_KEY, JSON.stringify(selectedFolderByTab));
  }, [selectedFolderByTab]);

  const phaseTemplatesState = useQuery(phaseTemplatesQuery);
  const sessionTemplatesState = useQuery(sessionTemplatesQuery);
  const sectionTemplatesState = useQuery(sectionTemplatesQuery);
  const exerciseTemplatesState = useQuery(exerciseTemplatesQuery);

  const phaseFoldersState = useQuery(templateFoldersQuery("phase"));
  const sessionFoldersState = useQuery(templateFoldersQuery("session"));
  const sectionFoldersState = useQuery(templateFoldersQuery("section"));
  const exerciseFoldersState = useQuery(templateFoldersQuery("exercise"));

  const phaseTemplates = toTemplateItem((phaseTemplatesState.data || []) as any[]);
  const sessionTemplates = toTemplateItem((sessionTemplatesState.data || []) as any[]);
  const sectionTemplates = toTemplateItem((sectionTemplatesState.data || []) as any[]);
  const exerciseTemplates = toTemplateItem((exerciseTemplatesState.data || []) as any[]);

  const phaseFolders = (phaseFoldersState.data || []) as any[];
  const sessionFolders = (sessionFoldersState.data || []) as any[];
  const sectionFolders = (sectionFoldersState.data || []) as any[];
  const exerciseFolders = (exerciseFoldersState.data || []) as any[];

  const createPhaseTemplate = useCreatePhaseTemplate();
  const deletePhaseTemplate = useDeletePhaseTemplate();
  const createSessionTemplate = useCreateSessionTemplate();
  const deleteSessionTemplate = useDeleteSessionTemplate();
  const createSectionTemplate = useCreateSectionTemplate();
  const deleteSectionTemplate = useDeleteSectionTemplate();
  const createExerciseTemplate = useCreateExerciseTemplate();
  const deleteExerciseTemplate = useDeleteExerciseTemplate();

  const createTemplateFolder = useCreateTemplateFolder();
  const updateTemplateFolder = useUpdateTemplateFolder();
  const deleteTemplateFolder = useDeleteTemplateFolder();
  const moveTemplateToFolder = useMoveTemplateToFolder();
  const reorderTemplates = useReorderTemplates();

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  const loadErrors = [
    phaseTemplatesState.error,
    sessionTemplatesState.error,
    sectionTemplatesState.error,
    exerciseTemplatesState.error,
    phaseFoldersState.error,
    sessionFoldersState.error,
    sectionFoldersState.error,
    exerciseFoldersState.error,
  ]
    .filter(Boolean)
    .map((error) => getErrorMessage(error, "Unknown templates API error"));

  const selectedFolderId = selectedFolderByTab[activeTab] ?? null;

  const setSelectedFolderForActiveTab = (folderId: string | null) => {
    setSelectedFolderByTab((previous) => {
      const next = { ...previous, [activeTab]: folderId };
      setLocation(buildTemplatesUrl(activeTab, folderId));
      return next;
    });
  };

  const setActiveTabWithPersistence = (tab: TemplateTab, options?: { resetFolder?: boolean }) => {
    const nextFolderId = options?.resetFolder ? null : (selectedFolderByTab[tab] ?? null);
    if (options?.resetFolder) {
      setSelectedFolderByTab((previous) => ({ ...previous, [tab]: null }));
    }
    setActiveTab(tab);
    setLocation(buildTemplatesUrl(tab, nextFolderId));
  };

  const handleCreateFolder = async (
    type: TemplateFolderType,
    name: string,
    parentId: string | null,
  ) => {
    try {
      await createTemplateFolder.mutateAsync({ type, name, parentId });
      toast({ title: "Folder created" });
    } catch (error) {
      toast({
        title: "Could not create folder",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const handleRenameFolder = async (type: TemplateFolderType, folderId: string, name: string) => {
    try {
      await updateTemplateFolder.mutateAsync({ id: folderId, type, name });
      toast({ title: "Folder renamed" });
    } catch (error) {
      toast({
        title: "Could not rename folder",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const handleMoveFolder = async (
    type: TemplateFolderType,
    folderId: string,
    parentId: string | null,
  ) => {
    try {
      await updateTemplateFolder.mutateAsync({ id: folderId, type, parentId });
      toast({ title: "Folder moved" });
    } catch (error) {
      toast({
        title: "Could not move folder",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteFolder = async (type: TemplateFolderType, folderId: string) => {
    if (
      !window.confirm(
        "Delete this folder? Child folders must be removed first. Templates inside this folder will move to the parent level.",
      )
    ) {
      return;
    }
    try {
      await deleteTemplateFolder.mutateAsync({ id: folderId, type });
      if (selectedFolderByTab[activeTab] === folderId) {
        setSelectedFolderForActiveTab(null);
      }
      toast({ title: "Folder deleted" });
    } catch (error) {
      toast({
        title: "Could not delete folder",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const handleMoveTemplate = async (
    type: TemplateFolderType,
    templateId: string,
    folderId: string | null,
  ) => {
    try {
      await moveTemplateToFolder.mutateAsync({ type, templateId, folderId });
    } catch (error) {
      toast({
        title: "Could not move template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const handleReorderTemplates = async (
    type: TemplateFolderType,
    items: Array<{ id: string; sortOrder: number; folderId: string | null }>,
  ) => {
    try {
      await reorderTemplates.mutateAsync({ type, items });
    } catch (error) {
      toast({
        title: "Could not reorder templates",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const createPhase = async (folderId: string | null) => {
    try {
      const created = await createPhaseTemplate.mutateAsync({
        ...makeDefaultPhaseTemplatePayload(),
        folderId,
        sortOrder: getNextSortOrder(phaseTemplates, folderId),
      });
      setLocation(`/app/admin/templates/phases/${created.id}?tab=phases`);
    } catch (error) {
      toast({
        title: "Could not create phase template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const duplicatePhase = async (item: any) => {
    try {
      const cloned = clonePhaseTemplate({
        sessions: (item.sessions || []) as any[],
        schedule: (item.schedule || []) as any[],
      });
      const created = await createPhaseTemplate.mutateAsync({
        name: `${item.name} (Copy)`,
        folderId: item.folderId ?? null,
        sortOrder: getNextSortOrder(phaseTemplates, item.folderId ?? null),
        goal: item.goal ?? null,
        durationWeeks: item.durationWeeks ?? 4,
        movementCheckEnabled: Boolean(item.movementCheckEnabled),
        sessions: cloned.sessions,
        schedule: cloned.schedule,
      });
      setLocation(`/app/admin/templates/phases/${created.id}?tab=phases`);
    } catch (error) {
      toast({
        title: "Could not duplicate phase template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const removePhase = async (item: any) => {
    if (!window.confirm("Delete this phase template?")) return;
    try {
      await deletePhaseTemplate.mutateAsync(item.id);
      toast({ title: "Phase template deleted" });
    } catch (error) {
      toast({
        title: "Could not delete phase template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const createSession = async (folderId: string | null) => {
    try {
      const created = await createSessionTemplate.mutateAsync({
        ...makeDefaultSessionTemplate(),
        folderId,
        sortOrder: getNextSortOrder(sessionTemplates, folderId),
      });
      setLocation(`/app/admin/templates/sessions/${created.id}?tab=sessions`);
    } catch (error) {
      toast({
        title: "Could not create session template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const duplicateSession = async (item: any) => {
    try {
      const cloned = cloneSessionFromTemplate(item, exerciseTemplates as any[]);
      const created = await createSessionTemplate.mutateAsync({
        name: `${item.name} (Copy)`,
        folderId: item.folderId ?? null,
        sortOrder: getNextSortOrder(sessionTemplates, item.folderId ?? null),
        description: item.description || null,
        durationMinutes:
          typeof item.durationMinutes === "number" &&
          Number.isFinite(item.durationMinutes) &&
          item.durationMinutes > 0
            ? Math.floor(item.durationMinutes)
            : null,
        sections: cloned.sections,
      });
      setLocation(`/app/admin/templates/sessions/${created.id}?tab=sessions`);
    } catch (error) {
      toast({
        title: "Could not duplicate session template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const removeSession = async (item: any) => {
    if (!window.confirm("Delete this session template?")) return;
    try {
      await deleteSessionTemplate.mutateAsync(item.id);
      toast({ title: "Session template deleted" });
    } catch (error) {
      toast({
        title: "Could not delete session template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const createSection = async (folderId: string | null) => {
    try {
      const created = await createSectionTemplate.mutateAsync({
        ...makeDefaultSectionTemplate(),
        folderId,
        sortOrder: getNextSortOrder(sectionTemplates, folderId),
      });
      setLocation(`/app/admin/templates/sections/${created.id}?tab=sections`);
    } catch (error) {
      toast({
        title: "Could not create section template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const duplicateSection = async (item: any) => {
    try {
      const cloned = cloneSectionFromTemplate(item, exerciseTemplates as any[]);
      const created = await createSectionTemplate.mutateAsync({
        name: `${item.name} (Copy)`,
        folderId: item.folderId ?? null,
        sortOrder: getNextSortOrder(sectionTemplates, item.folderId ?? null),
        description: item.description || null,
        exercises: cloned.exercises,
      });
      setLocation(`/app/admin/templates/sections/${created.id}?tab=sections`);
    } catch (error) {
      toast({
        title: "Could not duplicate section template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const removeSection = async (item: any) => {
    if (!window.confirm("Delete this section template?")) return;
    try {
      await deleteSectionTemplate.mutateAsync(item.id);
      toast({ title: "Section template deleted" });
    } catch (error) {
      toast({
        title: "Could not delete section template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const createExercise = async (folderId: string | null) => {
    try {
      const created = await createExerciseTemplate.mutateAsync({
        ...makeDefaultExerciseTemplate(),
        folderId,
        sortOrder: getNextSortOrder(exerciseTemplates, folderId),
      });
      setLocation(`/app/admin/templates/exercises/${created.id}?tab=exercises`);
    } catch (error) {
      toast({
        title: "Could not create exercise template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const duplicateExercise = async (item: any) => {
    try {
      const created = await createExerciseTemplate.mutateAsync({
        name: `${item.name} (Copy)`,
        folderId: item.folderId ?? null,
        sortOrder: getNextSortOrder(exerciseTemplates, item.folderId ?? null),
        targetMuscle: item.targetMuscle || null,
        demoUrl: item.demoUrl || null,
        sets: item.sets || null,
        reps: item.reps || null,
        load: item.load || null,
        tempo: item.tempo || null,
        notes: item.notes || null,
        goal: item.goal || null,
        additionalInstructions: item.additionalInstructions || null,
        requiresMovementCheck: Boolean(item.requiresMovementCheck),
        enableStructuredLogging: Boolean(item.enableStructuredLogging),
      });
      setLocation(`/app/admin/templates/exercises/${created.id}?tab=exercises`);
    } catch (error) {
      toast({
        title: "Could not duplicate exercise template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const removeExercise = async (item: any) => {
    if (!window.confirm("Delete this exercise template?")) return;
    try {
      await deleteExerciseTemplate.mutateAsync(item.id);
      toast({ title: "Exercise template deleted" });
    } catch (error) {
      toast({
        title: "Could not delete exercise template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const pageLoading = useMemo(
    () =>
      phaseTemplatesState.isLoading ||
      sessionTemplatesState.isLoading ||
      sectionTemplatesState.isLoading ||
      exerciseTemplatesState.isLoading,
    [
      phaseTemplatesState.isLoading,
      sectionTemplatesState.isLoading,
      sessionTemplatesState.isLoading,
      exerciseTemplatesState.isLoading,
    ],
  );

  const categories = useMemo(
    () => [
      {
        tab: "phases" as const,
        label: "Phases",
        icon: Layers,
        count: phaseTemplates.length,
      },
      {
        tab: "sessions" as const,
        label: "Sessions",
        icon: Library,
        count: sessionTemplates.length,
      },
      {
        tab: "sections" as const,
        label: "Sections",
        icon: Spline,
        count: sectionTemplates.length,
      },
      {
        tab: "exercises" as const,
        label: "Exercises",
        icon: Shapes,
        count: exerciseTemplates.length,
      },
    ],
    [
      exerciseTemplates.length,
      phaseTemplates.length,
      sectionTemplates.length,
      sessionTemplates.length,
    ],
  );

  return (
    <div className="w-full space-y-6 pb-16">
      <h1 className="sr-only">Templates</h1>

      {loadErrors.length > 0 ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          data-testid="templates-load-error"
        >
          <div className="font-semibold">Could not load templates from API</div>
          <div className="mt-1 break-words">{loadErrors[0]}</div>
        </div>
      ) : null}

      {activeTab === "phases" ? (
        <TemplateLibraryPane
          rootLabel="Phases"
          categoryItems={categories.map((category) => ({
            id: category.tab,
            label: category.label,
            count: category.count,
            icon: category.icon,
          }))}
          activeCategoryId={activeTab}
          onSelectCategory={(categoryId) => {
            if (isTemplateTab(categoryId))
              setActiveTabWithPersistence(categoryId, { resetFolder: true });
          }}
          allLabel="All Phases"
          searchPlaceholder="Search phase templates..."
          createButtonLabel="New Phase Template"
          items={phaseTemplates as any[]}
          folders={phaseFolders}
          selectedFolderId={selectedFolderId}
          isLoading={pageLoading}
          onSelectFolder={setSelectedFolderForActiveTab}
          onCreateTemplate={(folderId) => void createPhase(folderId)}
          onDuplicateTemplate={(item) => void duplicatePhase(item)}
          onDeleteTemplate={(item) => void removePhase(item)}
          onCreateFolder={(name, parentId) => void handleCreateFolder("phase", name, parentId)}
          onRenameFolder={(folderId, name) => void handleRenameFolder("phase", folderId, name)}
          onDeleteFolder={(folderId) => void handleDeleteFolder("phase", folderId)}
          onMoveFolder={(folderId, parentId) => void handleMoveFolder("phase", folderId, parentId)}
          onMoveTemplate={(templateId, folderId) =>
            void handleMoveTemplate("phase", templateId, folderId)
          }
          onReorderTemplates={(items) => void handleReorderTemplates("phase", items)}
          getTemplateSummary={(item) =>
            `${(item as any).sessions?.length || 0} session(s), ${(item as any).durationWeeks || 4} week(s)`
          }
          getTemplateOpenHref={(item) => `/app/admin/templates/phases/${item.id}?tab=phases`}
        />
      ) : null}

      {activeTab === "sessions" ? (
        <TemplateLibraryPane
          rootLabel="Sessions"
          categoryItems={categories.map((category) => ({
            id: category.tab,
            label: category.label,
            count: category.count,
            icon: category.icon,
          }))}
          activeCategoryId={activeTab}
          onSelectCategory={(categoryId) => {
            if (isTemplateTab(categoryId))
              setActiveTabWithPersistence(categoryId, { resetFolder: true });
          }}
          allLabel="All Sessions"
          searchPlaceholder="Search session templates..."
          createButtonLabel="New Session Template"
          items={sessionTemplates as any[]}
          folders={sessionFolders}
          selectedFolderId={selectedFolderId}
          isLoading={pageLoading}
          onSelectFolder={setSelectedFolderForActiveTab}
          onCreateTemplate={(folderId) => void createSession(folderId)}
          onDuplicateTemplate={(item) => void duplicateSession(item)}
          onDeleteTemplate={(item) => void removeSession(item)}
          onCreateFolder={(name, parentId) => void handleCreateFolder("session", name, parentId)}
          onRenameFolder={(folderId, name) => void handleRenameFolder("session", folderId, name)}
          onDeleteFolder={(folderId) => void handleDeleteFolder("session", folderId)}
          onMoveFolder={(folderId, parentId) =>
            void handleMoveFolder("session", folderId, parentId)
          }
          onMoveTemplate={(templateId, folderId) =>
            void handleMoveTemplate("session", templateId, folderId)
          }
          onReorderTemplates={(items) => void handleReorderTemplates("session", items)}
          getTemplateSummary={(item) => `${((item as any).sections || []).length} section(s)`}
          getTemplateOpenHref={(item) => `/app/admin/templates/sessions/${item.id}?tab=sessions`}
        />
      ) : null}

      {activeTab === "sections" ? (
        <TemplateLibraryPane
          rootLabel="Sections"
          categoryItems={categories.map((category) => ({
            id: category.tab,
            label: category.label,
            count: category.count,
            icon: category.icon,
          }))}
          activeCategoryId={activeTab}
          onSelectCategory={(categoryId) => {
            if (isTemplateTab(categoryId))
              setActiveTabWithPersistence(categoryId, { resetFolder: true });
          }}
          allLabel="All Sections"
          searchPlaceholder="Search section templates..."
          createButtonLabel="New Section Template"
          items={sectionTemplates as any[]}
          folders={sectionFolders}
          selectedFolderId={selectedFolderId}
          isLoading={pageLoading}
          onSelectFolder={setSelectedFolderForActiveTab}
          onCreateTemplate={(folderId) => void createSection(folderId)}
          onDuplicateTemplate={(item) => void duplicateSection(item)}
          onDeleteTemplate={(item) => void removeSection(item)}
          onCreateFolder={(name, parentId) => void handleCreateFolder("section", name, parentId)}
          onRenameFolder={(folderId, name) => void handleRenameFolder("section", folderId, name)}
          onDeleteFolder={(folderId) => void handleDeleteFolder("section", folderId)}
          onMoveFolder={(folderId, parentId) =>
            void handleMoveFolder("section", folderId, parentId)
          }
          onMoveTemplate={(templateId, folderId) =>
            void handleMoveTemplate("section", templateId, folderId)
          }
          onReorderTemplates={(items) => void handleReorderTemplates("section", items)}
          getTemplateSummary={(item) => `${((item as any).exercises || []).length} exercise(s)`}
          getTemplateSearchText={(item) =>
            ((item as any).exercises || [])
              .map((exercise: any) => `${exercise.name || ""} ${exercise.targetMuscle || ""}`)
              .join(" ")
          }
          renderTemplatePreview={(item) => renderSectionTemplatePreview(item)}
          getTemplateOpenHref={(item) => `/app/admin/templates/sections/${item.id}?tab=sections`}
          layout="rows"
        />
      ) : null}

      {activeTab === "exercises" ? (
        <TemplateLibraryPane
          rootLabel="Exercises"
          categoryItems={categories.map((category) => ({
            id: category.tab,
            label: category.label,
            count: category.count,
            icon: category.icon,
          }))}
          activeCategoryId={activeTab}
          onSelectCategory={(categoryId) => {
            if (isTemplateTab(categoryId))
              setActiveTabWithPersistence(categoryId, { resetFolder: true });
          }}
          allLabel="All Exercises"
          searchPlaceholder="Search exercise templates..."
          createButtonLabel="New Exercise Template"
          items={exerciseTemplates as any[]}
          folders={exerciseFolders}
          selectedFolderId={selectedFolderId}
          isLoading={pageLoading}
          onSelectFolder={setSelectedFolderForActiveTab}
          onCreateTemplate={(folderId) => void createExercise(folderId)}
          onDuplicateTemplate={(item) => void duplicateExercise(item)}
          onDeleteTemplate={(item) => void removeExercise(item)}
          onCreateFolder={(name, parentId) => void handleCreateFolder("exercise", name, parentId)}
          onRenameFolder={(folderId, name) => void handleRenameFolder("exercise", folderId, name)}
          onDeleteFolder={(folderId) => void handleDeleteFolder("exercise", folderId)}
          onMoveFolder={(folderId, parentId) =>
            void handleMoveFolder("exercise", folderId, parentId)
          }
          onMoveTemplate={(templateId, folderId) =>
            void handleMoveTemplate("exercise", templateId, folderId)
          }
          onReorderTemplates={(items) => void handleReorderTemplates("exercise", items)}
          getTemplateSummary={(item) => `${(item as any).targetMuscle || "No tags"}`}
          getTemplateSearchText={(item) => `${(item as any).targetMuscle || ""}`}
          renderTemplateTitle={(item) => <ExerciseTemplateInlineTitle item={item} />}
          renderTemplatePreview={(item) => renderExerciseTemplatePreview(item)}
          renderTemplateDetails={(item) => <ExerciseTemplateInlineDetails item={item} />}
          getTemplateOpenHref={(item) => `/app/admin/templates/exercises/${item.id}?tab=exercises`}
          layout="rows"
        />
      ) : null}
    </div>
  );
}
