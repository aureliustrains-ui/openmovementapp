import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layers, Library, Shapes, Spline } from "lucide-react";
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
  useUpdateTemplateFolder,
  type TemplateFolderType,
} from "@/lib/api";
import {
  clonePhaseTemplate,
  cloneSectionFromTemplate,
  cloneSessionFromTemplate,
} from "@/lib/blueprintClone";
import { TemplateListPane } from "@/components/admin/TemplateListPane";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SectionTemplateEditorBody } from "@/pages/admin/SectionTemplateEditor";
import { useToast } from "@/hooks/use-toast";
import { formatReps, formatSets } from "@/lib/prescription";
import { ExerciseLibrary } from "@/components/admin/exercise/ExerciseLibrary";
import { EMPTY_EXERCISE_STANDARD_NULL, exerciseStandardToPayload } from "@/lib/exerciseStandard";

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
    sets: "",
    reps: "",
    load: "",
    tempo: "",
    notes: null,
    goal: null,
    additionalInstructions: null,
    ...EMPTY_EXERCISE_STANDARD_NULL,
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
    formatSets(exercise?.sets),
    formatReps(exercise?.reps, exercise?.repsMode),
    exercise?.tempo || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function AdminTemplatesPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const initialState = useMemo(resolveInitialTemplateState, []);
  const [activeTab, setActiveTab] = useState<TemplateTab>(initialState.tab);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
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
      setOpenSectionId(created.id);
      return created.id as string;
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

  const createExercise = async (folderId: string | null): Promise<string | void> => {
    try {
      const created = await createExerciseTemplate.mutateAsync({
        ...makeDefaultExerciseTemplate(),
        folderId,
        sortOrder: getNextSortOrder(exerciseTemplates, folderId),
      });
      toast({ title: "Exercise template added" });
      return created.id;
    } catch (error) {
      toast({
        title: "Could not create exercise template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const duplicateExercise = async (item: any): Promise<string | void> => {
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
        ...exerciseStandardToPayload(item),
        requiresMovementCheck: Boolean(item.requiresMovementCheck),
        enableStructuredLogging: Boolean(item.enableStructuredLogging),
        facets: item.facets ?? {},
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        needsVideo: Boolean(item.needsVideo),
      } as any);
      toast({ title: "Exercise duplicated" });
      return created.id as string;
    } catch (error) {
      toast({
        title: "Could not duplicate exercise template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const removeExercise = async (item: any): Promise<boolean> => {
    if (
      !window.confirm(
        `Delete "${item.name}" from the library? Plans that already use it keep their copy.`,
      )
    )
      return false;
    try {
      await deleteExerciseTemplate.mutateAsync(item.id);
      toast({ title: "Exercise deleted" });
      return true;
    } catch (error) {
      toast({
        title: "Could not delete exercise template",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
      return false;
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

      <nav
        className="flex gap-1 overflow-x-auto border-b border-slate-200"
        aria-label="Template types"
        data-testid="templates-tabbar"
      >
        {categories.map((category) => {
          const Icon = category.icon;
          const active = category.tab === activeTab;
          return (
            <button
              key={category.tab}
              type="button"
              onClick={() => setActiveTabWithPersistence(category.tab, { resetFolder: true })}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm ${
                active
                  ? "border-slate-900 font-semibold text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              data-testid={`templates-tab-${category.tab}`}
            >
              <Icon className="h-4 w-4" />
              {category.label}
              <span className="text-xs font-normal text-slate-400">{category.count}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === "phases" ? (
        <TemplateListPane
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
          onMoveTemplate={(templateId, folderId) =>
            void handleMoveTemplate("phase", templateId, folderId)
          }
          onReorderTemplates={(items) => void handleReorderTemplates("phase", items)}
          getTemplateSummary={(item) =>
            `${(item as any).sessions?.length || 0} session(s), ${(item as any).durationWeeks || 4} week(s)`
          }
          getTemplateOpenHref={(item) => `/app/admin/templates/phases/${item.id}?tab=phases`}
          icon={<Layers className="h-4 w-4" />}
        />
      ) : null}

      {activeTab === "sessions" ? (
        <TemplateListPane
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
          onMoveTemplate={(templateId, folderId) =>
            void handleMoveTemplate("session", templateId, folderId)
          }
          onReorderTemplates={(items) => void handleReorderTemplates("session", items)}
          getTemplateSummary={(item) => `${((item as any).sections || []).length} section(s)`}
          getTemplateOpenHref={(item) => `/app/admin/templates/sessions/${item.id}?tab=sessions`}
          icon={<Library className="h-4 w-4" />}
        />
      ) : null}

      {activeTab === "sections" ? (
        <TemplateListPane
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
          getTemplateOpenHref={(item) => `/app/admin/templates/sections/${item.id}?tab=sections`}
          icon={<Spline className="h-4 w-4" />}
          onOpenTemplate={(item) => setOpenSectionId(item.id)}
        />
      ) : null}

      {activeTab === "exercises" ? (
        <ExerciseLibrary
          exercises={exerciseTemplates as any[]}
          folders={exerciseFolders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderForActiveTab}
          isLoading={pageLoading}
          onCreateExercise={createExercise}
          onDuplicateExercise={duplicateExercise}
          onDeleteExercise={removeExercise}
          onCreateFolder={(name, parentId) => void handleCreateFolder("exercise", name, parentId)}
          onRenameFolder={(folderId, name) => void handleRenameFolder("exercise", folderId, name)}
          onDeleteFolder={(folderId) => void handleDeleteFolder("exercise", folderId)}
          onMoveExercise={(templateId, folderId) =>
            void handleMoveTemplate("exercise", templateId, folderId)
          }
          onReorderExercises={(items) => void handleReorderTemplates("exercise", items)}
        />
      ) : null}

      <Sheet open={Boolean(openSectionId)} onOpenChange={(open) => !open && setOpenSectionId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-slate-50 sm:max-w-6xl">
          <SheetTitle className="sr-only">Section template</SheetTitle>
          {openSectionId ? (
            <SectionTemplateEditorBody
              key={openSectionId}
              templateId={openSectionId}
              embedded
              onClose={() => setOpenSectionId(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
