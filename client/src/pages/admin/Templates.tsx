import { useQuery } from "@tanstack/react-query";
import { exerciseTemplatesQuery } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Dumbbell, Folder, List, LayoutTemplate, MoreHorizontal, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminTemplates() {
  const { data: templates = [], isLoading } = useQuery(exerciseTemplatesQuery);

  return (
    <div className="space-y-8 animate-in fade-in max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight" data-testid="text-templates-title">Template Library</h1>
          <p className="text-slate-500 mt-1">Manage reusable components for faster programming.</p>
        </div>
      </div>

      <Tabs defaultValue="exercises" className="w-full">
        <TabsList className="bg-slate-200/50 p-1 rounded-xl w-full justify-start overflow-x-auto h-12">
          <TabsTrigger value="phases" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
            <LayoutTemplate className="w-4 h-4 mr-2" /> Phases
          </TabsTrigger>
          <TabsTrigger value="sessions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
            <Folder className="w-4 h-4 mr-2" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="sections" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
            <List className="w-4 h-4 mr-2" /> Sections
          </TabsTrigger>
          <TabsTrigger value="exercises" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
            <Dumbbell className="w-4 h-4 mr-2" /> Exercises
          </TabsTrigger>
        </TabsList>
        
        <div className="mt-8">
          <TabsContent value="exercises" className="space-y-6 m-0 outline-none">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full max-w-md">
                 <Search className="h-5 w-5 text-slate-400 ml-3 shrink-0" />
                 <Input 
                   type="search" 
                   placeholder="Search exercises..." 
                   className="border-none shadow-none focus-visible:ring-0 px-0 h-10 bg-transparent text-slate-900"
                   data-testid="input-search-exercises"
                 />
               </div>
               <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full" data-testid="button-new-exercise">
                 <Plus className="mr-2 h-4 w-4" /> New Exercise
               </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((ex: any) => (
                  <Card key={ex.id} className="border-slate-200 shadow-sm hover:border-slate-300 transition-colors bg-white rounded-xl" data-testid={`card-template-${ex.id}`}>
                    <CardContent className="p-4 flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-lg mb-1">{ex.name}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal text-xs">{ex.targetMuscle}</Badge>
                          {ex.demoUrl && <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-normal text-xs">Has Video</Badge>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="sessions" className="m-0 outline-none">
             <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <Folder className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">Session Templates</h3>
                <p className="text-slate-500 mt-1 mb-6 max-w-sm mx-auto">Create full workout templates you can drag and drop into any phase.</p>
                <Button variant="outline" className="rounded-full"><Plus className="mr-2 h-4 w-4" /> Create Session Template</Button>
              </div>
          </TabsContent>

          <TabsContent value="phases" className="m-0 outline-none">
             <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <LayoutTemplate className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">Phase Templates</h3>
                <p className="text-slate-500 mt-1 mb-6 max-w-sm mx-auto">Build complete multi-week programs.</p>
              </div>
          </TabsContent>
          
          <TabsContent value="sections" className="m-0 outline-none">
             <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <List className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">Section Templates</h3>
                <p className="text-slate-500 mt-1 mb-6 max-w-sm mx-auto">Reusable blocks like "Warm-ups" or "Core Finishers".</p>
              </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
