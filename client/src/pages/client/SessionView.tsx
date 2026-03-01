import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { sessionsQuery, phasesQuery, useUpdateSession } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle2, Circle, MessageSquare, PlayCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ClientSessionView() {
  const [, params] = useRoute("/app/client/session/:sessionId");
  const [, setLocation] = useLocation();
  const sessionId = params?.sessionId;
  
  const { data: allSessions = [], isLoading } = useQuery(sessionsQuery);
  const { data: allPhases = [] } = useQuery(phasesQuery);
  const updateSession = useUpdateSession();

  const session = allSessions.find((s: any) => s.id === sessionId);
  const phase = allPhases.find((p: any) => p.id === session?.phaseId);

  const [completedExercises, setCompletedExercises] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!session) return <div>Session not found</div>;

  const instanceId = 'w1_' + session.id;
  const isSessionComplete = (session.completedInstances as any[])?.includes(instanceId);

  const toggleExercise = (id: string) => {
    setCompletedExercises(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleFinish = () => {
    if (!isSessionComplete) {
      const updatedInstances = [...((session.completedInstances as any[]) || []), instanceId];
      updateSession.mutate({
        id: session.id,
        completedInstances: updatedInstances,
      });
    }
    setLocation("/app/client/my-phase");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 animate-in fade-in">
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md border-b border-slate-200 py-4 -mx-6 px-6 md:-mx-8 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/client/my-phase">
            <Button variant="ghost" size="icon" className="rounded-full bg-white border border-slate-200 shadow-sm" data-testid="button-back-phase">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-display font-bold text-lg text-slate-900 leading-tight" data-testid="text-session-name">{session.name}</h1>
            <p className="text-xs text-slate-500">{phase?.name}</p>
          </div>
        </div>
        <Button onClick={handleFinish} className="bg-green-600 hover:bg-green-700 text-white rounded-full" data-testid="button-finish-session">
          Finish Session
        </Button>
      </div>

      <div className="space-y-8 mt-6">
        {(session.sections as any[]).map((section: any) => (
          <div key={section.id} className="space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-2">{section.name}</h2>
            
            {section.exercises.map((ex: any) => (
              <Card key={ex.id} className={`border-2 transition-colors overflow-hidden rounded-2xl ${completedExercises[ex.id] ? 'border-green-500 bg-green-50/30' : 'border-slate-200 bg-white shadow-sm'}`} data-testid={`card-exercise-${ex.id}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-4">
                      <button onClick={() => toggleExercise(ex.id)} className="mt-0.5 shrink-0 transition-colors" data-testid={`button-toggle-${ex.id}`}>
                        {completedExercises[ex.id] ? 
                          <CheckCircle2 className="h-7 w-7 text-green-500" /> : 
                          <Circle className="h-7 w-7 text-slate-300 hover:text-indigo-500" />
                        }
                      </button>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{ex.name}</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-medium">{ex.sets} Sets × {ex.reps} Reps</Badge>
                          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 font-medium">Target: {ex.load}</Badge>
                          {ex.rpe && <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-medium">RPE {ex.rpe}</Badge>}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-indigo-600 shrink-0 bg-slate-50 rounded-full">
                      <PlayCircle className="h-6 w-6" />
                    </Button>
                  </div>

                  {ex.notes && (
                    <div className="ml-11 mb-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-600 border border-slate-100 italic">
                      " {ex.notes} "
                    </div>
                  )}

                  <div className="ml-11 space-y-3 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
                       <div className="col-span-2 text-center">Set</div>
                       <div className="col-span-5 text-center">Weight (lbs)</div>
                       <div className="col-span-5 text-center">Reps</div>
                    </div>
                    
                    {Array.from({ length: Number(ex.sets) || 3 }).map((_, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-2 text-center font-medium text-slate-500">{i + 1}</div>
                        <div className="col-span-5">
                          <Input type="number" placeholder="--" className="h-10 text-center bg-slate-50 border-slate-200" data-testid={`input-weight-${ex.id}-${i}`} />
                        </div>
                        <div className="col-span-5">
                          <Input type="number" placeholder={String(ex.reps).split('-')[0] || "0"} className="h-10 text-center bg-slate-50 border-slate-200" data-testid={`input-reps-${ex.id}-${i}`} />
                        </div>
                      </div>
                    ))}
                    
                    <div className="pt-2">
                       <Button variant="ghost" size="sm" className="text-slate-500 text-xs hover:text-indigo-600">
                         <MessageSquare className="h-3 w-3 mr-2" /> Add Note / Upload Video
                       </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
