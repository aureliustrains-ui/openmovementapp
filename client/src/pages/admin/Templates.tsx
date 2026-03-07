import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  exerciseTemplatesQuery,
  phaseTemplatesQuery,
  sectionTemplatesQuery,
  sessionTemplatesQuery,
  useCreateExerciseTemplate,
  useCreatePhaseTemplate,
  useCreateSectionTemplate,
  useCreateSessionTemplate,
  useDeleteExerciseTemplate,
  useDeletePhaseTemplate,
  useDeleteSectionTemplate,
  useDeleteSessionTemplate,
} from "@/lib/api";
import {
  clonePhaseTemplate,
  cloneSectionFromTemplate,
  cloneSessionFromTemplate,
} from "@/lib/blueprintClone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, Search, Trash2 } from "lucide-react";

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

function ListSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 max-w-md w-full">
      <Search className="h-4 w-4 text-slate-400 ml-2" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="border-none shadow-none focus-visible:ring-0" />
    </div>
  );
}

export default function AdminTemplatesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const phaseTemplatesState = useQuery(phaseTemplatesQuery);
  const sessionTemplatesState = useQuery(sessionTemplatesQuery);
  const sectionTemplatesState = useQuery(sectionTemplatesQuery);
  const exerciseTemplatesState = useQuery(exerciseTemplatesQuery);
  const phaseTemplates = phaseTemplatesState.data || [];
  const sessionTemplates = sessionTemplatesState.data || [];
  const sectionTemplates = sectionTemplatesState.data || [];
  const exerciseTemplates = exerciseTemplatesState.data || [];
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  const loadErrors = [
    phaseTemplatesState.error,
    sessionTemplatesState.error,
    sectionTemplatesState.error,
    exerciseTemplatesState.error,
  ]
    .filter(Boolean)
    .map((error) => getErrorMessage(error, "Unknown templates API error"));

  const createPhaseTemplate = useCreatePhaseTemplate();
  const deletePhaseTemplate = useDeletePhaseTemplate();
  const createSessionTemplate = useCreateSessionTemplate();
  const deleteSessionTemplate = useDeleteSessionTemplate();
  const createSectionTemplate = useCreateSectionTemplate();
  const deleteSectionTemplate = useDeleteSectionTemplate();
  const createExerciseTemplate = useCreateExerciseTemplate();
  const deleteExerciseTemplate = useDeleteExerciseTemplate();

  const filteredPhases = useMemo(
    () => phaseTemplates.filter((item: any) => item.name.toLowerCase().includes(search.toLowerCase())),
    [phaseTemplates, search],
  );
  const filteredSessions = useMemo(
    () => sessionTemplates.filter((item: any) => item.name.toLowerCase().includes(search.toLowerCase())),
    [sessionTemplates, search],
  );
  const filteredSections = useMemo(
    () => sectionTemplates.filter((item: any) => item.name.toLowerCase().includes(search.toLowerCase())),
    [sectionTemplates, search],
  );
  const filteredExercises = useMemo(
    () => exerciseTemplates.filter((item: any) => item.name.toLowerCase().includes(search.toLowerCase())),
    [exerciseTemplates, search],
  );

  const createPhase = async () => {
    try {
      const created = await createPhaseTemplate.mutateAsync(makeDefaultPhaseTemplatePayload());
      window.location.href = `/app/admin/templates/phases/${created.id}`;
    } catch (error) {
      toast({ title: "Could not create phase template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
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
        goal: item.goal ?? null,
        durationWeeks: item.durationWeeks ?? 4,
        movementCheckEnabled: Boolean(item.movementCheckEnabled),
        sessions: cloned.sessions,
        schedule: cloned.schedule,
      });
      window.location.href = `/app/admin/templates/phases/${created.id}`;
    } catch (error) {
      toast({ title: "Could not duplicate phase template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
    }
  };

  const removePhase = async (id: string) => {
    if (!window.confirm("Delete this phase template?")) return;
    try {
      await deletePhaseTemplate.mutateAsync(id);
      toast({ title: "Phase template deleted" });
    } catch (error) {
      toast({ title: "Could not delete phase template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
    }
  };

  const createSession = async () => {
    try {
      const created = await createSessionTemplate.mutateAsync(makeDefaultSessionTemplate());
      window.location.href = `/app/admin/templates/sessions/${created.id}`;
    } catch (error) {
      toast({ title: "Could not create session template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
    }
  };

  const duplicateSession = async (item: any) => {
    try {
      const cloned = cloneSessionFromTemplate(item);
      const created = await createSessionTemplate.mutateAsync({
        name: `${item.name} (Copy)`,
        description: item.description || null,
        sections: cloned.sections,
      });
      window.location.href = `/app/admin/templates/sessions/${created.id}`;
    } catch (error) {
      toast({ title: "Could not duplicate session template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
    }
  };

  const removeSession = async (id: string) => {
    if (!window.confirm("Delete this session template?")) return;
    try {
      await deleteSessionTemplate.mutateAsync(id);
      toast({ title: "Session template deleted" });
    } catch (error) {
      toast({ title: "Could not delete session template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
    }
  };

  const createSection = async () => {
    try {
      const created = await createSectionTemplate.mutateAsync(makeDefaultSectionTemplate());
      window.location.href = `/app/admin/templates/sections/${created.id}`;
    } catch (error) {
      toast({ title: "Could not create section template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
    }
  };

  const duplicateSection = async (item: any) => {
    try {
      const cloned = cloneSectionFromTemplate(item);
      const created = await createSectionTemplate.mutateAsync({
        name: `${item.name} (Copy)`,
        description: item.description || null,
        exercises: cloned.exercises,
      });
      window.location.href = `/app/admin/templates/sections/${created.id}`;
    } catch (error) {
      toast({ title: "Could not duplicate section template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
    }
  };

  const removeSection = async (id: string) => {
    if (!window.confirm("Delete this section template?")) return;
    try {
      await deleteSectionTemplate.mutateAsync(id);
      toast({ title: "Section template deleted" });
    } catch (error) {
      toast({ title: "Could not delete section template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
    }
  };

  const createExercise = async () => {
    try {
      const created = await createExerciseTemplate.mutateAsync(makeDefaultExerciseTemplate());
      window.location.href = `/app/admin/templates/exercises/${created.id}`;
    } catch (error) {
      toast({ title: "Could not create exercise template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
    }
  };

  const duplicateExercise = async (item: any) => {
    try {
      const created = await createExerciseTemplate.mutateAsync({
        name: `${item.name} (Copy)`,
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
      window.location.href = `/app/admin/templates/exercises/${created.id}`;
    } catch (error) {
      toast({ title: "Could not duplicate exercise template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
    }
  };

  const removeExercise = async (id: string) => {
    if (!window.confirm("Delete this exercise template?")) return;
    try {
      await deleteExerciseTemplate.mutateAsync(id);
      toast({ title: "Exercise template deleted" });
    } catch (error) {
      toast({ title: "Could not delete exercise template", description: getErrorMessage(error, "Unknown error"), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <div className="bg-slate-900 text-white rounded-2xl p-6">
        <h1 className="text-3xl font-display font-bold">Templates</h1>
        <p className="text-slate-300 mt-1">Manage all template types in one place.</p>
      </div>

      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          {loadErrors.length > 0 && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="templates-load-error">
              <div className="font-semibold">Could not load templates from API</div>
              <div className="mt-1 break-words">{loadErrors[0]}</div>
            </div>
          )}
          <Tabs defaultValue="phases" className="w-full" onValueChange={() => setSearch("") }>
            <TabsList className="bg-slate-200/50 p-1 rounded-xl w-full justify-start overflow-x-auto h-12">
              <TabsTrigger value="phases" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-5">Phase Templates</TabsTrigger>
              <TabsTrigger value="sessions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-5">Session Templates</TabsTrigger>
              <TabsTrigger value="sections" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-5">Section Templates</TabsTrigger>
              <TabsTrigger value="exercises" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-5">Exercise Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="phases" className="m-0 pt-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <ListSearch value={search} onChange={setSearch} placeholder="Search phase templates..." />
                <Button onClick={createPhase}><Plus className="h-4 w-4 mr-2" /> New Phase Template</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPhases.map((item: any) => (
                  <Card key={item.id}>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{item.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">{(item.sessions || []).length} session(s), {item.durationWeeks || 4} week(s)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/app/admin/templates/phases/${item.id}`}><Button size="sm" variant="outline">Open</Button></Link>
                        <Button size="sm" variant="outline" onClick={() => duplicatePhase(item)}><Copy className="h-4 w-4 mr-2" /> Duplicate</Button>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => removePhase(item.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="sessions" className="m-0 pt-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <ListSearch value={search} onChange={setSearch} placeholder="Search session templates..." />
                <Button onClick={createSession}><Plus className="h-4 w-4 mr-2" /> New Session Template</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSessions.map((item: any) => (
                  <Card key={item.id}>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{item.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">{(item.sections || []).length} section(s)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/app/admin/templates/sessions/${item.id}`}><Button size="sm" variant="outline">Open</Button></Link>
                        <Button size="sm" variant="outline" onClick={() => duplicateSession(item)}><Copy className="h-4 w-4 mr-2" /> Duplicate</Button>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => removeSession(item.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="sections" className="m-0 pt-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <ListSearch value={search} onChange={setSearch} placeholder="Search section templates..." />
                <Button onClick={createSection}><Plus className="h-4 w-4 mr-2" /> New Section Template</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSections.map((item: any) => (
                  <Card key={item.id}>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{item.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">{(item.exercises || []).length} exercise(s)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/app/admin/templates/sections/${item.id}`}><Button size="sm" variant="outline">Open</Button></Link>
                        <Button size="sm" variant="outline" onClick={() => duplicateSection(item)}><Copy className="h-4 w-4 mr-2" /> Duplicate</Button>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => removeSection(item.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="exercises" className="m-0 pt-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <ListSearch value={search} onChange={setSearch} placeholder="Search exercise templates..." />
                <Button onClick={createExercise}><Plus className="h-4 w-4 mr-2" /> New Exercise Template</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredExercises.map((item: any) => (
                  <Card key={item.id}>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{item.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">{item.targetMuscle || "No target effect"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/app/admin/templates/exercises/${item.id}`}><Button size="sm" variant="outline">Open</Button></Link>
                        <Button size="sm" variant="outline" onClick={() => duplicateExercise(item)}><Copy className="h-4 w-4 mr-2" /> Duplicate</Button>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => removeExercise(item.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
