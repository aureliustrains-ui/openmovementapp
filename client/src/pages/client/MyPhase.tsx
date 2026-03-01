import { useQuery } from "@tanstack/react-query";
import { phasesQuery, sessionsQuery, useUpdatePhase } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, Lock, Calendar as CalIcon, UploadCloud, Loader2 } from "lucide-react";

export default function ClientMyPhase() {
  const { data: allPhases = [], isLoading: loadingPhases } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);
  const { user } = useAuth();
  const updatePhase = useUpdatePhase();
  
  if (!user) return null;

  const activePhase = allPhases.find((p: any) => p.clientId === user.id && p.status === 'Active');
  const pendingPhase = allPhases.find((p: any) => p.clientId === user.id && p.status === 'Waiting for Movement Check');

  const handleUploadVideo = (exerciseId: string) => {
    if (!pendingPhase) return;
    
    const updatedChecks = (pendingPhase.movementChecks as any[]).map((mc: any) => {
      if (mc.exerciseId !== exerciseId) return mc;
      return { ...mc, status: 'Pending', videoUrl: 'https://example.com/demo.mp4' };
    });

    updatePhase.mutate({
      id: pendingPhase.id,
      movementChecks: updatedChecks,
    });
  };

  if (loadingPhases) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (pendingPhase) {
    return (
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4">
        <div className="text-center mb-10 mt-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-6">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight" data-testid="text-movement-check-title">Movement Check Required</h1>
          <p className="text-slate-600 mt-3 text-lg">Your coach needs to review your form before unlocking your new phase: <span className="font-semibold text-slate-900">{pendingPhase.name}</span></p>
        </div>

        <div className="space-y-4">
          {(pendingPhase.movementChecks as any[]).map((mc: any, i: number) => (
            <Card key={i} className="border-2 border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white" data-testid={`card-movement-check-${i}`}>
              <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className={
                      mc.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }>
                      {mc.status}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{mc.name}</h3>
                  {mc.feedback && (
                    <div className="mt-3 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Coach Feedback</p>
                      <p className="text-slate-700 italic">"{mc.feedback}"</p>
                    </div>
                  )}
                </div>
                
                <div className="w-full md:w-auto shrink-0">
                  {mc.status === 'Approved' ? (
                    <div className="flex items-center text-green-600 font-medium bg-green-50 px-4 py-2 rounded-lg border border-green-100">
                      <CheckCircle2 className="mr-2 h-5 w-5" /> Approved
                    </div>
                  ) : mc.status === 'Pending' ? (
                    <div className="flex items-center text-amber-600 font-medium bg-amber-50 px-4 py-2 rounded-lg border border-amber-100">
                      <UploadCloud className="mr-2 h-5 w-5" /> Submitted
                    </div>
                  ) : (
                    <Button 
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 px-6"
                      onClick={() => handleUploadVideo(mc.exerciseId)}
                      data-testid={`button-upload-video-${i}`}
                    >
                      <UploadCloud className="mr-2 h-5 w-5" /> Upload Video
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!activePhase) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <CalIcon className="h-10 w-10 text-slate-300" />
        </div>
        <h2 className="text-2xl font-display font-bold text-slate-900" data-testid="text-no-phase">No Active Phase</h2>
        <p className="text-slate-500 mt-2 max-w-md">You don't have an active training phase right now. Your coach is likely building your next block.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div className="bg-slate-900 rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <div className="w-64 h-64 border-8 border-indigo-500 rounded-full blur-3xl mix-blend-screen" />
        </div>
        <div className="relative z-10">
          <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md mb-6 py-1.5 px-3" data-testid="badge-active-phase">
            Active Phase • Week 1 / {activePhase.durationWeeks}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4" data-testid="text-phase-name">{activePhase.name}</h1>
          <p className="text-slate-300 text-lg max-w-xl leading-relaxed">{activePhase.goal}</p>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-6">This Week's Schedule</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(activePhase.schedule as any[]).filter((s: any) => s.week === 1).map((sched: any, i: number) => {
            const session = allSessions.find((s: any) => s.id === sched.sessionId);
            const isCompleted = (session?.completedInstances as any[])?.includes('w1_' + session?.id); 
            
            return (
              <Link key={i} href={`/app/client/session/${session?.id}`}>
                <Card className="border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group bg-white rounded-2xl overflow-hidden h-full" data-testid={`card-session-${i}`}>
                  <CardContent className="p-0 h-full">
                    <div className="flex items-stretch h-full">
                      <div className={`w-3 shrink-0 ${isCompleted ? 'bg-green-500' : 'bg-indigo-600'}`} />
                      <div className="p-6 flex-1 flex justify-between items-center">
                        <div>
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{sched.day}</div>
                          <h3 className={`text-xl font-bold ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-900 group-hover:text-indigo-700 transition-colors'}`}>{session?.name}</h3>
                          <p className="text-sm text-slate-500 mt-1">{(session?.sections as any[])?.length} Blocks • {session?.description}</p>
                        </div>
                        <div className="shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-slate-50 group-hover:bg-indigo-50 group-hover:shadow-inner transition-all ml-4">
                           {isCompleted ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <ChevronRight className="h-6 w-6 text-indigo-600 group-hover:translate-x-0.5 transition-transform" />}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
