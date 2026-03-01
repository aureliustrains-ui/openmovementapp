import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  exerciseTemplatesQuery, useCreateExerciseTemplate, useUpdateExerciseTemplate, useDeleteExerciseTemplate,
  sectionTemplatesQuery, useCreateSectionTemplate, useUpdateSectionTemplate, useDeleteSectionTemplate,
  sessionTemplatesQuery, useCreateSessionTemplate, useUpdateSessionTemplate, useDeleteSessionTemplate,
  phaseTemplatesQuery, useCreatePhaseTemplate, useUpdatePhaseTemplate, useDeletePhaseTemplate,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Dumbbell, Folder, List, LayoutTemplate, MoreHorizontal, Loader2, Edit2, Copy, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

function TemplateList({ items, search, icon: Icon, label, onEdit, onDuplicate, onDelete, renderBadges }: any) {
  const filtered = useMemo(() => items.filter((t: any) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  ), [items, search]);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
        <Icon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900">No {label.toLowerCase()} found</h3>
        <p className="text-slate-500 mt-1 max-w-sm mx-auto">
          {search ? "Try adjusting your search terms." : `Create your first ${label.toLowerCase().slice(0, -1)} to get started.`}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((item: any) => (
        <Card key={item.id} className="border-slate-200 shadow-sm hover:border-slate-300 transition-colors bg-white rounded-xl" data-testid={`card-template-${item.id}`}>
          <CardContent className="p-4 flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900 text-lg mb-1 truncate">{item.name}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {renderBadges?.(item)}
              </div>
              {item.description && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 shrink-0" data-testid={`button-template-actions-${item.id}`}>
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onEdit(item)}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(item)}><Copy className="mr-2 h-4 w-4" /> Duplicate</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(item)} className="text-red-600 focus:text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AdminTemplates() {
  const { toast } = useToast();

  const { data: exerciseTemps = [], isLoading: loadingEx } = useQuery(exerciseTemplatesQuery);
  const { data: sectionTemps = [], isLoading: loadingSec } = useQuery(sectionTemplatesQuery);
  const { data: sessionTemps = [], isLoading: loadingSess } = useQuery(sessionTemplatesQuery);
  const { data: phaseTemps = [], isLoading: loadingPh } = useQuery(phaseTemplatesQuery);

  const createEx = useCreateExerciseTemplate();
  const updateEx = useUpdateExerciseTemplate();
  const deleteEx = useDeleteExerciseTemplate();
  const createSec = useCreateSectionTemplate();
  const updateSec = useUpdateSectionTemplate();
  const deleteSec = useDeleteSectionTemplate();
  const createSess = useCreateSessionTemplate();
  const updateSess = useUpdateSessionTemplate();
  const deleteSess = useDeleteSessionTemplate();
  const createPh = useCreatePhaseTemplate();
  const updatePh = useUpdatePhaseTemplate();
  const deletePh = useDeletePhaseTemplate();

  const [search, setSearch] = useState("");
  const [dialogType, setDialogType] = useState<"exercise" | "section" | "session" | "phase" | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [deletingType, setDeletingType] = useState<string>("");

  const [formName, setFormName] = useState("");
  const [formTargetMuscle, setFormTargetMuscle] = useState("");
  const [formDemoUrl, setFormDemoUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSets, setFormSets] = useState("");
  const [formReps, setFormReps] = useState("");
  const [formLoad, setFormLoad] = useState("");
  const [formTempo, setFormTempo] = useState("");
  const [formGoal, setFormGoal] = useState("");
  const [formDuration, setFormDuration] = useState("4");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const openCreate = (type: "exercise" | "section" | "session" | "phase") => {
    setEditing(null);
    setFormName("");
    setFormTargetMuscle("");
    setFormDemoUrl("");
    setFormDescription("");
    setFormSets("3");
    setFormReps("10");
    setFormLoad("Auto");
    setFormTempo("3010");
    setFormGoal("");
    setFormDuration("4");
    setDialogType(type);
  };

  const openEdit = (type: "exercise" | "section" | "session" | "phase", item: any) => {
    setEditing(item);
    setFormName(item.name || "");
    setFormTargetMuscle(item.targetMuscle || "");
    setFormDemoUrl(item.demoUrl || "");
    setFormDescription(item.description || item.goal || "");
    setFormSets(item.sets || "3");
    setFormReps(item.reps || "10");
    setFormLoad(item.load || "Auto");
    setFormTempo(item.tempo || "3010");
    setFormGoal(item.goal || "");
    setFormDuration(String(item.durationWeeks || 4));
    setDialogType(type);
  };

  const handleSave = async () => {
    if (!formName.trim() || !dialogType) return;
    try {
      if (dialogType === "exercise") {
        const data = { name: formName, targetMuscle: formTargetMuscle || null, demoUrl: formDemoUrl || null, sets: formSets || null, reps: formReps || null, load: formLoad || null, tempo: formTempo || null, goal: formGoal || null };
        if (editing) await updateEx.mutateAsync({ id: editing.id, ...data });
        else await createEx.mutateAsync(data);
      } else if (dialogType === "section") {
        const data = { name: formName, description: formDescription || null, exercises: editing?.exercises || [] };
        if (editing) await updateSec.mutateAsync({ id: editing.id, ...data });
        else await createSec.mutateAsync(data);
      } else if (dialogType === "session") {
        const data = { name: formName, description: formDescription || null, sections: editing?.sections || [] };
        if (editing) await updateSess.mutateAsync({ id: editing.id, ...data });
        else await createSess.mutateAsync(data);
      } else if (dialogType === "phase") {
        const data = { name: formName, goal: formGoal || null, durationWeeks: parseInt(formDuration) || 4, sessions: editing?.sessions || [], schedule: editing?.schedule || [] };
        if (editing) await updatePh.mutateAsync({ id: editing.id, ...data });
        else await createPh.mutateAsync(data);
      }
      toast({ title: editing ? "Template updated" : "Template created" });
      setDialogType(null);
    } catch {
      toast({ title: "Error saving template", variant: "destructive" });
    }
  };

  const handleDuplicate = async (type: string, item: any) => {
    try {
      const copy = { ...item, name: `${item.name} (Copy)` };
      delete copy.id;
      if (type === "exercise") await createEx.mutateAsync(copy);
      else if (type === "section") await createSec.mutateAsync(copy);
      else if (type === "session") await createSess.mutateAsync(copy);
      else if (type === "phase") await createPh.mutateAsync(copy);
      toast({ title: "Template duplicated" });
    } catch {
      toast({ title: "Error duplicating", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      if (deletingType === "exercise") await deleteEx.mutateAsync(deleting.id);
      else if (deletingType === "section") await deleteSec.mutateAsync(deleting.id);
      else if (deletingType === "session") await deleteSess.mutateAsync(deleting.id);
      else if (deletingType === "phase") await deletePh.mutateAsync(deleting.id);
      toast({ title: "Template deleted" });
      setDeleting(null);
    } catch {
      toast({ title: "Error deleting", variant: "destructive" });
    }
  };

  const startDelete = (type: string, item: any) => {
    setDeletingType(type);
    setDeleting(item);
  };

  const countExercises = (item: any) => {
    if (item.exercises) return (item.exercises as any[]).length;
    if (item.sections) return (item.sections as any[]).reduce((sum: number, s: any) => sum + (s.exercises?.length || 0), 0);
    if (item.sessions) return (item.sessions as any[]).reduce((sum: number, sess: any) => sum + (sess.sections || []).reduce((ss: number, sec: any) => ss + (sec.exercises?.length || 0), 0), 0);
    return 0;
  };

  const isLoading = loadingEx || loadingSec || loadingSess || loadingPh;

  return (
    <div className="space-y-8 animate-in fade-in max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight" data-testid="text-templates-title">Template Library</h1>
        <p className="text-slate-500 mt-1">Manage reusable components for faster programming.</p>
      </div>

      <Tabs defaultValue="exercises" className="w-full">
        <TabsList className="bg-slate-200/50 p-1 rounded-xl w-full justify-start overflow-x-auto h-12">
          <TabsTrigger value="phases" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
            <LayoutTemplate className="w-4 h-4 mr-2" /> Phases
            {phaseTemps.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px] h-5">{phaseTemps.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="sessions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
            <Folder className="w-4 h-4 mr-2" /> Sessions
            {sessionTemps.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px] h-5">{sessionTemps.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="sections" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
            <List className="w-4 h-4 mr-2" /> Sections
            {sectionTemps.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px] h-5">{sectionTemps.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="exercises" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
            <Dumbbell className="w-4 h-4 mr-2" /> Exercises
            {exerciseTemps.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px] h-5">{exerciseTemps.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <div className="mt-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
          ) : (
            <>
              <TabsContent value="exercises" className="space-y-6 m-0 outline-none">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full max-w-md">
                    <Search className="h-5 w-5 text-slate-400 ml-3 shrink-0" />
                    <Input type="search" placeholder="Search exercises..." className="border-none shadow-none focus-visible:ring-0 px-0 h-10 bg-transparent" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-exercises" />
                  </div>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full" onClick={() => openCreate("exercise")} data-testid="button-new-exercise"><Plus className="mr-2 h-4 w-4" /> New Exercise</Button>
                </div>
                <TemplateList
                  items={exerciseTemps}
                  search={search}
                  icon={Dumbbell}
                  label="Exercises"
                  onEdit={(item: any) => openEdit("exercise", item)}
                  onDuplicate={(item: any) => handleDuplicate("exercise", item)}
                  onDelete={(item: any) => startDelete("exercise", item)}
                  renderBadges={(ex: any) => (
                    <>
                      {ex.targetMuscle && <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal text-xs">{ex.targetMuscle}</Badge>}
                      {ex.demoUrl && <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-normal text-xs">Has Video</Badge>}
                      {ex.sets && <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal text-xs">{ex.sets}x{ex.reps}</Badge>}
                    </>
                  )}
                />
              </TabsContent>

              <TabsContent value="sections" className="space-y-6 m-0 outline-none">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full max-w-md">
                    <Search className="h-5 w-5 text-slate-400 ml-3 shrink-0" />
                    <Input type="search" placeholder="Search sections..." className="border-none shadow-none focus-visible:ring-0 px-0 h-10 bg-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full" onClick={() => openCreate("section")}><Plus className="mr-2 h-4 w-4" /> New Section</Button>
                </div>
                <TemplateList
                  items={sectionTemps}
                  search={search}
                  icon={List}
                  label="Sections"
                  onEdit={(item: any) => openEdit("section", item)}
                  onDuplicate={(item: any) => handleDuplicate("section", item)}
                  onDelete={(item: any) => startDelete("section", item)}
                  renderBadges={(s: any) => (
                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal text-xs">{countExercises(s)} exercises</Badge>
                  )}
                />
              </TabsContent>

              <TabsContent value="sessions" className="space-y-6 m-0 outline-none">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full max-w-md">
                    <Search className="h-5 w-5 text-slate-400 ml-3 shrink-0" />
                    <Input type="search" placeholder="Search sessions..." className="border-none shadow-none focus-visible:ring-0 px-0 h-10 bg-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full" onClick={() => openCreate("session")}><Plus className="mr-2 h-4 w-4" /> New Session</Button>
                </div>
                <TemplateList
                  items={sessionTemps}
                  search={search}
                  icon={Folder}
                  label="Sessions"
                  onEdit={(item: any) => openEdit("session", item)}
                  onDuplicate={(item: any) => handleDuplicate("session", item)}
                  onDelete={(item: any) => startDelete("session", item)}
                  renderBadges={(s: any) => (
                    <>
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal text-xs">{(s.sections as any[])?.length || 0} sections</Badge>
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal text-xs">{countExercises(s)} exercises</Badge>
                    </>
                  )}
                />
              </TabsContent>

              <TabsContent value="phases" className="space-y-6 m-0 outline-none">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full max-w-md">
                    <Search className="h-5 w-5 text-slate-400 ml-3 shrink-0" />
                    <Input type="search" placeholder="Search phases..." className="border-none shadow-none focus-visible:ring-0 px-0 h-10 bg-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full" onClick={() => openCreate("phase")}><Plus className="mr-2 h-4 w-4" /> New Phase</Button>
                </div>
                <TemplateList
                  items={phaseTemps}
                  search={search}
                  icon={LayoutTemplate}
                  label="Phases"
                  onEdit={(item: any) => openEdit("phase", item)}
                  onDuplicate={(item: any) => handleDuplicate("phase", item)}
                  onDelete={(item: any) => startDelete("phase", item)}
                  renderBadges={(p: any) => (
                    <>
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal text-xs">{p.durationWeeks}w</Badge>
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal text-xs">{(p.sessions as any[])?.length || 0} sessions</Badge>
                      {p.goal && <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-normal text-xs truncate max-w-[150px]">{p.goal}</Badge>}
                    </>
                  )}
                />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>

      <Dialog open={!!dialogType} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "New"} {dialogType === "exercise" ? "Exercise" : dialogType === "section" ? "Section" : dialogType === "session" ? "Session" : "Phase"} Template</DialogTitle>
            <DialogDescription>
              {editing ? "Update this template's details." : "Create a new reusable template."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Template name" data-testid="input-template-name" />
            </div>

            {dialogType === "exercise" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Target Muscle</Label>
                    <Input value={formTargetMuscle} onChange={e => setFormTargetMuscle(e.target.value)} placeholder="e.g. Quads" />
                  </div>
                  <div className="space-y-2">
                    <Label>Demo URL</Label>
                    <Input value={formDemoUrl} onChange={e => setFormDemoUrl(e.target.value)} placeholder="https://..." />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-2">
                    <Label>Sets</Label>
                    <Input value={formSets} onChange={e => setFormSets(e.target.value)} placeholder="3" />
                  </div>
                  <div className="space-y-2">
                    <Label>Reps</Label>
                    <Input value={formReps} onChange={e => setFormReps(e.target.value)} placeholder="10" />
                  </div>
                  <div className="space-y-2">
                    <Label>Load</Label>
                    <Input value={formLoad} onChange={e => setFormLoad(e.target.value)} placeholder="Auto" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo</Label>
                    <Input value={formTempo} onChange={e => setFormTempo(e.target.value)} placeholder="3010" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Goal</Label>
                  <Input value={formGoal} onChange={e => setFormGoal(e.target.value)} placeholder="e.g. Progressive overload" />
                </div>
              </>
            )}

            {(dialogType === "section" || dialogType === "session") && (
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Brief description" />
              </div>
            )}

            {dialogType === "phase" && (
              <>
                <div className="space-y-2">
                  <Label>Goal</Label>
                  <Input value={formGoal} onChange={e => setFormGoal(e.target.value)} placeholder="Phase goal" />
                </div>
                <div className="space-y-2">
                  <Label>Duration (weeks)</Label>
                  <Input type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)} min="1" max="52" />
                </div>
              </>
            )}

            {editing && (dialogType === "section" || dialogType === "session" || dialogType === "phase") && (
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <p className="text-xs text-slate-500 font-medium mb-1">
                  {dialogType === "section" && `Contains ${countExercises(editing)} exercise(s)`}
                  {dialogType === "session" && `Contains ${(editing.sections as any[])?.length || 0} section(s), ${countExercises(editing)} exercise(s)`}
                  {dialogType === "phase" && `Contains ${(editing.sessions as any[])?.length || 0} session(s)`}
                </p>
                <p className="text-[10px] text-slate-400">Structure is preserved from the original save. Edit in the Phase Builder for detailed changes.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formName.trim()} data-testid="button-save-template">{editing ? "Save Changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleting?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
