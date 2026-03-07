import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { exerciseTemplatesQuery, useCreateExerciseTemplate, useDeleteExerciseTemplate } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Plus, Search, Trash2 } from "lucide-react";

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

export default function ExerciseTemplatesList() {
  const { toast } = useToast();
  const { data: templates = [] } = useQuery(exerciseTemplatesQuery);
  const createTemplate = useCreateExerciseTemplate();
  const deleteTemplate = useDeleteExerciseTemplate();

  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => templates.filter((item: any) => item.name.toLowerCase().includes(search.toLowerCase())),
    [templates, search],
  );

  const create = async () => {
    try {
      const created = await createTemplate.mutateAsync(makeDefaultExerciseTemplate());
      window.location.href = `/app/admin/templates/exercises/${created.id}`;
    } catch {
      toast({ title: "Could not create exercise template", variant: "destructive" });
    }
  };

  const duplicate = async (item: any) => {
    try {
      const created = await createTemplate.mutateAsync({
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
    } catch {
      toast({ title: "Could not duplicate exercise template", variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this exercise template?")) return;
    try {
      await deleteTemplate.mutateAsync(id);
      toast({ title: "Exercise template deleted" });
    } catch {
      toast({ title: "Could not delete exercise template", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/app/admin/templates">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Exercise Templates</h1>
            <p className="text-slate-500 text-sm">Full-page editor with all PhaseBuilder exercise fields.</p>
          </div>
        </div>
        <Button onClick={create}><Plus className="h-4 w-4 mr-2" /> New Exercise Template</Button>
      </div>

      <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 max-w-md">
        <Search className="h-4 w-4 text-slate-400 ml-2" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercise templates..." className="border-none shadow-none focus-visible:ring-0" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item: any) => (
          <Card key={item.id}>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-slate-900">{item.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{item.targetMuscle || "No target effect"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/app/admin/templates/exercises/${item.id}`}>
                  <Button size="sm" variant="outline">Open</Button>
                </Link>
                <Button size="sm" variant="outline" onClick={() => duplicate(item)}>
                  <Copy className="h-4 w-4 mr-2" /> Duplicate
                </Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => remove(item.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
