import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
} from "@/lib/api";
import { clonePhaseTemplate, cloneSectionFromTemplate, cloneSessionFromTemplate } from "@/lib/blueprintClone";
import { TemplateLibraryPane } from "@/components/admin/TemplateLibraryPane";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

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
    load: "Auto",
    tempo: "3010",
    notes: null,
    goal: null,
    additionalInstructions: null,
    requiresMovementCheck: false,
    enableStructuredLogging: false,
  };
}

function toTemplateItem<T extends { id: string; name: string; folderId?: string | null; sortOrder?: number }>(
  entries: T[],
) {
  return entries.map((entry) => ({
    ...entry,
    folderId: entry.folderId ?? null,
    sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : 0,
  }));
}

type TemplateTab = "phases" | "sessions" | "sections" | "exercises";
const TEMPLATE_TAB_STORAGE_KEY = "admin.templates.activeTab";

function isTemplateTab(value: string | null): value is TemplateTab {
  return value === "phases" || value === "sessions" || value === "sections" || value === "exercises";
}

function resolveInitialTemplateTab(): TemplateTab {
  if (typeof window !== "undefined") {
    const queryTab = new URLSearchParams(window.location.search).get("tab");
    if (isTemplateTab(queryTab)) return queryTab;
    const stored = window.localStorage.getItem(TEMPLATE_TAB_STORAGE_KEY);
    if (isTemplateTab(stored)) return stored;
  }
  return "phases";
}

function tabToQueryParam(tab: TemplateTab): string {
  return `?tab=${tab}`;
}

export default function AdminTemplatesPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TemplateTab>(resolveInitialTemplateTab);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TEMPLATE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

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

  const handleCreateFolder = async (
    type: "phase" | "session" | "section" | "exercise",
    name: string,
  ) => {
    try {
      await createTemplateFolder.mutateAsync({ type, name, parentId: null });
      toast({ title: "Folder created" });
    } catch (error) {
      toast({
        title: "Could not create folder",
        description: getErrorMessage(error, "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const handleRenameFolder = async (
    type: "phase" | "session" | "section" | "exercise",
    folderId: string,
    name: string,
  ) => {
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

  const handleDeleteFolder = async (
    type: "phase" | "session" | "section" | "exercise",
    folderId: string,
  ) => {
    if (
      !window.confirm(
        "Delete this folder? Templates inside it will be removed from this folder.",
      )
    )
      return;
    try {
      await deleteTemplateFolder.mutateAsync({ id: folderId, type });
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
    type: "phase" | "session" | "section" | "exercise",
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
    type: "phase" | "session" | "section" | "exercise",
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

  const createPhase = async () => {
    try {
      const created = await createPhaseTemplate.mutateAsync(makeDefaultPhaseTemplatePayload());
      setLocation(`/app/admin/templates/phases/${created.id}${tabToQueryParam("phases")}`);
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
        sortOrder: (item.sortOrder ?? 0) + 1,
        goal: item.goal ?? null,
        durationWeeks: item.durationWeeks ?? 4,
        movementCheckEnabled: Boolean(item.movementCheckEnabled),
        sessions: cloned.sessions,
        schedule: cloned.schedule,
      });
      setLocation(`/app/admin/templates/phases/${created.id}${tabToQueryParam("phases")}`);
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

  const createSession = async () => {
    try {
      const created = await createSessionTemplate.mutateAsync(makeDefaultSessionTemplate());
      setLocation(`/app/admin/templates/sessions/${created.id}${tabToQueryParam("sessions")}`);
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
      const cloned = cloneSessionFromTemplate(item);
      const created = await createSessionTemplate.mutateAsync({
        name: `${item.name} (Copy)`,
        folderId: item.folderId ?? null,
        sortOrder: (item.sortOrder ?? 0) + 1,
        description: item.description || null,
        sections: cloned.sections,
      });
      setLocation(`/app/admin/templates/sessions/${created.id}${tabToQueryParam("sessions")}`);
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

  const createSection = async () => {
    try {
      const created = await createSectionTemplate.mutateAsync(makeDefaultSectionTemplate());
      setLocation(`/app/admin/templates/sections/${created.id}${tabToQueryParam("sections")}`);
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
      const cloned = cloneSectionFromTemplate(item);
      const created = await createSectionTemplate.mutateAsync({
        name: `${item.name} (Copy)`,
        folderId: item.folderId ?? null,
        sortOrder: (item.sortOrder ?? 0) + 1,
        description: item.description || null,
        exercises: cloned.exercises,
      });
      setLocation(`/app/admin/templates/sections/${created.id}${tabToQueryParam("sections")}`);
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

  const createExercise = async () => {
    try {
      const created = await createExerciseTemplate.mutateAsync(makeDefaultExerciseTemplate());
      setLocation(`/app/admin/templates/exercises/${created.id}${tabToQueryParam("exercises")}`);
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
        sortOrder: (item.sortOrder ?? 0) + 1,
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
      setLocation(`/app/admin/templates/exercises/${created.id}${tabToQueryParam("exercises")}`);
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

  return (
    <div className="space-y-6 w-full pb-16">
      <div className="bg-slate-900 text-white rounded-2xl p-6">
        <h1 className="text-3xl font-display font-bold">Templates</h1>
        <p className="text-slate-300 mt-1">Organize template libraries with shared folders.</p>
      </div>

      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          {loadErrors.length > 0 && (
            <div
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              data-testid="templates-load-error"
            >
              <div className="font-semibold">Could not load templates from API</div>
              <div className="mt-1 break-words">{loadErrors[0]}</div>
            </div>
          )}
          <Tabs
            className="w-full"
            onValueChange={(value) => {
              if (!isTemplateTab(value)) return;
              const next = value;
              setActiveTab(next);
              setLocation(`/app/admin/templates${tabToQueryParam(next)}`);
            }}
            value={activeTab}
          >
            <TabsList className="bg-slate-200/50 p-1 rounded-xl w-full justify-start overflow-x-auto h-12">
              <TabsTrigger
                value="phases"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-5"
              >
                Phase Templates
              </TabsTrigger>
              <TabsTrigger
                value="sessions"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-5"
              >
                Session Templates
              </TabsTrigger>
              <TabsTrigger
                value="sections"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-5"
              >
                Section Templates
              </TabsTrigger>
              <TabsTrigger
                value="exercises"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-5"
              >
                Exercise Templates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="phases" className="m-0 pt-6">
              <TemplateLibraryPane
                title="Phase"
                allLabel="All Phases"
                searchPlaceholder="Search phase templates..."
                createButtonLabel="New Phase Template"
                items={phaseTemplates as any[]}
                folders={phaseFolders}
                isLoading={pageLoading}
                onCreateTemplate={createPhase}
                onDuplicateTemplate={(item) => void duplicatePhase(item)}
                onDeleteTemplate={(item) => void removePhase(item)}
                onCreateFolder={(name) => void handleCreateFolder("phase", name)}
                onRenameFolder={(folderId, name) =>
                  void handleRenameFolder("phase", folderId, name)
                }
                onDeleteFolder={(folderId) => void handleDeleteFolder("phase", folderId)}
                onMoveTemplate={(templateId, folderId) =>
                  void handleMoveTemplate("phase", templateId, folderId)
                }
                onReorderTemplates={(items) => void handleReorderTemplates("phase", items)}
                getTemplateSummary={(item) =>
                  `${(item as any).sessions?.length || 0} session(s), ${
                    (item as any).durationWeeks || 4
                  } week(s)`
                }
                getTemplateOpenHref={(item) =>
                  `/app/admin/templates/phases/${item.id}${tabToQueryParam("phases")}`
                }
              />
            </TabsContent>

            <TabsContent value="sessions" className="m-0 pt-6">
              <TemplateLibraryPane
                title="Session"
                allLabel="All Sessions"
                searchPlaceholder="Search session templates..."
                createButtonLabel="New Session Template"
                items={sessionTemplates as any[]}
                folders={sessionFolders}
                isLoading={pageLoading}
                onCreateTemplate={createSession}
                onDuplicateTemplate={(item) => void duplicateSession(item)}
                onDeleteTemplate={(item) => void removeSession(item)}
                onCreateFolder={(name) => void handleCreateFolder("session", name)}
                onRenameFolder={(folderId, name) =>
                  void handleRenameFolder("session", folderId, name)
                }
                onDeleteFolder={(folderId) => void handleDeleteFolder("session", folderId)}
                onMoveTemplate={(templateId, folderId) =>
                  void handleMoveTemplate("session", templateId, folderId)
                }
                onReorderTemplates={(items) => void handleReorderTemplates("session", items)}
                getTemplateSummary={(item) =>
                  `${((item as any).sections || []).length} section(s)`
                }
                getTemplateOpenHref={(item) =>
                  `/app/admin/templates/sessions/${item.id}${tabToQueryParam("sessions")}`
                }
              />
            </TabsContent>

            <TabsContent value="sections" className="m-0 pt-6">
              <TemplateLibraryPane
                title="Section"
                allLabel="All Sections"
                searchPlaceholder="Search section templates..."
                createButtonLabel="New Section Template"
                items={sectionTemplates as any[]}
                folders={sectionFolders}
                isLoading={pageLoading}
                onCreateTemplate={createSection}
                onDuplicateTemplate={(item) => void duplicateSection(item)}
                onDeleteTemplate={(item) => void removeSection(item)}
                onCreateFolder={(name) => void handleCreateFolder("section", name)}
                onRenameFolder={(folderId, name) =>
                  void handleRenameFolder("section", folderId, name)
                }
                onDeleteFolder={(folderId) => void handleDeleteFolder("section", folderId)}
                onMoveTemplate={(templateId, folderId) =>
                  void handleMoveTemplate("section", templateId, folderId)
                }
                onReorderTemplates={(items) => void handleReorderTemplates("section", items)}
                getTemplateSummary={(item) =>
                  `${((item as any).exercises || []).length} exercise(s)`
                }
                getTemplateOpenHref={(item) =>
                  `/app/admin/templates/sections/${item.id}${tabToQueryParam("sections")}`
                }
              />
            </TabsContent>

            <TabsContent value="exercises" className="m-0 pt-6">
              <TemplateLibraryPane
                title="Exercise"
                allLabel="All Exercises"
                searchPlaceholder="Search exercise templates..."
                createButtonLabel="New Exercise Template"
                items={exerciseTemplates as any[]}
                folders={exerciseFolders}
                isLoading={pageLoading}
                onCreateTemplate={createExercise}
                onDuplicateTemplate={(item) => void duplicateExercise(item)}
                onDeleteTemplate={(item) => void removeExercise(item)}
                onCreateFolder={(name) => void handleCreateFolder("exercise", name)}
                onRenameFolder={(folderId, name) =>
                  void handleRenameFolder("exercise", folderId, name)
                }
                onDeleteFolder={(folderId) => void handleDeleteFolder("exercise", folderId)}
                onMoveTemplate={(templateId, folderId) =>
                  void handleMoveTemplate("exercise", templateId, folderId)
                }
                onReorderTemplates={(items) => void handleReorderTemplates("exercise", items)}
                getTemplateSummary={(item) =>
                  `${(item as any).targetMuscle || "No target muscle"}`
                }
                getTemplateOpenHref={(item) =>
                  `/app/admin/templates/exercises/${item.id}${tabToQueryParam("exercises")}`
                }
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
