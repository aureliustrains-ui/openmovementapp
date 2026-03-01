import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  exerciseTemplatesQuery, 
  useCreateExerciseTemplate, 
  useUpdateExerciseTemplate, 
  useDeleteExerciseTemplate 
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Dumbbell, Folder, List, LayoutTemplate, MoreHorizontal, Loader2, Edit2, Copy, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExerciseTemplateSchema, type ExerciseTemplate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function AdminTemplates() {
  const { toast } = useToast();
  const { data: templates = [], isLoading } = useQuery(exerciseTemplatesQuery);
  const createMutation = useCreateExerciseTemplate();
  const updateMutation = useUpdateExerciseTemplate();
  const deleteMutation = useDeleteExerciseTemplate();

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExerciseTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<ExerciseTemplate | null>(null);

  const form = useForm({
    resolver: zodResolver(insertExerciseTemplateSchema),
    defaultValues: {
      name: "",
      targetMuscle: "",
      demoUrl: "",
    },
  });

  const filteredTemplates = useMemo(() => {
    return templates.filter((t: ExerciseTemplate) => 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.targetMuscle?.toLowerCase().includes(search.toLowerCase())
    );
  }, [templates, search]);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    form.reset({
      name: "",
      targetMuscle: "",
      demoUrl: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (template: ExerciseTemplate) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      targetMuscle: template.targetMuscle || "",
      demoUrl: template.demoUrl || "",
    });
    setIsDialogOpen(true);
  };

  const handleDuplicate = async (template: ExerciseTemplate) => {
    try {
      await createMutation.mutateAsync({
        name: `${template.name} (Copy)`,
        targetMuscle: template.targetMuscle,
        demoUrl: template.demoUrl,
      });
      toast({
        title: "Template duplicated",
        description: `Created a copy of ${template.name}`,
      });
    } catch (error) {
      toast({
        title: "Error duplicating template",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    try {
      await deleteMutation.mutateAsync(deletingTemplate.id);
      toast({
        title: "Template deleted",
        description: `${deletingTemplate.name} has been removed.`,
      });
      setDeletingTemplate(null);
    } catch (error) {
      toast({
        title: "Error deleting template",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: any) => {
    try {
      if (editingTemplate) {
        await updateMutation.mutateAsync({ id: editingTemplate.id, ...values });
        toast({
          title: "Template updated",
          description: "Changes have been saved successfully.",
        });
      } else {
        await createMutation.mutateAsync(values);
        toast({
          title: "Template created",
          description: "New exercise template added to library.",
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error saving template",
        variant: "destructive",
      });
    }
  };

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
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                 />
               </div>
               <Button 
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full" 
                data-testid="button-new-exercise"
                onClick={handleOpenCreate}
               >
                 <Plus className="mr-2 h-4 w-4" /> New Exercise
               </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <Dumbbell className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">No exercises found</h3>
                <p className="text-slate-500 mt-1 mb-6 max-w-sm mx-auto">
                  {search ? "Try adjusting your search terms." : "Create your first exercise to start building your library."}
                </p>
                {!search && (
                  <Button 
                    variant="outline" 
                    className="rounded-full"
                    onClick={handleOpenCreate}
                    data-testid="button-create-first-exercise"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Create your first exercise
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((ex: ExerciseTemplate) => (
                  <Card key={ex.id} className="border-slate-200 shadow-sm hover:border-slate-300 transition-colors bg-white rounded-xl" data-testid={`card-template-${ex.id}`}>
                    <CardContent className="p-4 flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-900 text-lg mb-1 truncate">{ex.name}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          {ex.targetMuscle && (
                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal text-xs">
                              {ex.targetMuscle}
                            </Badge>
                          )}
                          {ex.demoUrl && (
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-normal text-xs">
                              Has Video
                            </Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 shrink-0" data-testid={`button-template-actions-${ex.id}`}>
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleOpenEdit(ex)} data-testid={`menu-item-edit-${ex.id}`}>
                            <Edit2 className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(ex)} data-testid={`menu-item-duplicate-${ex.id}`}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeletingTemplate(ex)} 
                            className="text-red-600 focus:text-red-600"
                            data-testid={`menu-item-delete-${ex.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Exercise" : "New Exercise"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exercise Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Back Squat" {...field} data-testid="input-exercise-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetMuscle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Muscle</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Quads" {...field} data-testid="input-target-muscle" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="demoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Demo URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://youtube.com/..." {...field} data-testid="input-demo-url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel-template"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-template"
                >
                  {editingTemplate ? "Save Changes" : "Create Exercise"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the exercise template "{deletingTemplate?.name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
