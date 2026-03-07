import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { sectionTemplatesQuery, useCreateSectionTemplate, useDeleteSectionTemplate } from "@/lib/api";
import { cloneSectionFromTemplate } from "@/lib/blueprintClone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Plus, Search, Trash2 } from "lucide-react";

function makeDefaultSectionTemplate() {
  return {
    name: "New Section Template",
    description: null,
    exercises: [],
  };
}

export default function SectionTemplatesList() {
  const { toast } = useToast();
  const { data: templates = [] } = useQuery(sectionTemplatesQuery);
  const createTemplate = useCreateSectionTemplate();
  const deleteTemplate = useDeleteSectionTemplate();

  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => templates.filter((item: any) => item.name.toLowerCase().includes(search.toLowerCase())),
    [templates, search],
  );

  const create = async () => {
    try {
      const created = await createTemplate.mutateAsync(makeDefaultSectionTemplate());
      window.location.href = `/app/admin/templates/sections/${created.id}`;
    } catch {
      toast({ title: "Could not create section template", variant: "destructive" });
    }
  };

  const duplicate = async (item: any) => {
    try {
      const cloned = cloneSectionFromTemplate(item);
      const created = await createTemplate.mutateAsync({
        name: `${item.name} (Copy)`,
        description: item.description || null,
        exercises: cloned.exercises,
      });
      window.location.href = `/app/admin/templates/sections/${created.id}`;
    } catch {
      toast({ title: "Could not duplicate section template", variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this section template?")) return;
    try {
      await deleteTemplate.mutateAsync(id);
      toast({ title: "Section template deleted" });
    } catch {
      toast({ title: "Could not delete section template", variant: "destructive" });
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
            <h1 className="text-2xl font-bold text-slate-900">Section Templates</h1>
            <p className="text-slate-500 text-sm">Full-page editor for exercise blocks.</p>
          </div>
        </div>
        <Button onClick={create}><Plus className="h-4 w-4 mr-2" /> New Section Template</Button>
      </div>

      <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 max-w-md">
        <Search className="h-4 w-4 text-slate-400 ml-2" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search section templates..." className="border-none shadow-none focus-visible:ring-0" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item: any) => (
          <Card key={item.id}>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-slate-900">{item.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{(item.exercises || []).length} exercise(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/app/admin/templates/sections/${item.id}`}>
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
