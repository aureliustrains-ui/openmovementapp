import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { sessionsQuery, phasesQuery, useUpdatePhase } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Circle, PlayCircle, Loader2, ExternalLink, ChevronDown, ChevronUp, Video } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";

export default function ClientSessionView() {
  const [, params] = useRoute("/app/client/session/:sessionId");
  const [, setLocation] = useLocation();
  const sessionId = params?.sessionId;
  const { user } = useAuth();

  const searchParams = new URLSearchParams(window.location.search);
  const week = searchParams.get("week") || "1";
  const day = searchParams.get("day") || "";
  const slot = searchParams.get("slot") || "AM";

  const { data: allSessions = [], isLoading } = useQuery(sessionsQuery);
  const { data: allPhases = [] } = useQuery(phasesQuery);
  const updatePhase = useUpdatePhase();

  const session = allSessions.find((s: any) => s.id === sessionId);
  const phase = allPhases.find((p: any) => p.id === session?.phaseId);

  const [completedExercises, setCompletedExercises] = useState<Record<string, boolean>>({});
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [videoDialogUrl, setVideoDialogUrl] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!session) return <div>Session not found</div>;

  const instanceKey = `w${week}_${day}_${slot}_${session.id}`;
  const completedInstances: string[] = (phase?.completedScheduleInstances as string[]) || [];
  const isSessionComplete = completedInstances.includes(instanceKey);

  const toggleExercise = (id: string) => {
    setCompletedExercises(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleFinish = () => {
    if (!isSessionComplete && phase) {
      const updated = [...completedInstances, instanceKey];
      updatePhase.mutate({
        id: phase.id,
        completedScheduleInstances: updated,
      });
    }
    setLocation("/app/client/my-phase");
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const getYouTubeEmbedUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtube.com")) {
        const v = parsed.searchParams.get("v");
        if (v) return `https://www.youtube.com/embed/${v}`;
      }
      if (parsed.hostname.includes("youtu.be")) {
        return `https://www.youtube.com/embed${parsed.pathname}`;
      }
    } catch {}
    return null;
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
            <p className="text-xs text-slate-500">{phase?.name}{day ? ` \u2022 ${day} ${slot}` : ''}</p>
          </div>
        </div>
        <Button
          onClick={handleFinish}
          className={isSessionComplete ? "bg-slate-400 text-white rounded-full" : "bg-green-600 hover:bg-green-700 text-white rounded-full"}
          disabled={isSessionComplete}
          data-testid="button-finish-session"
        >
          {isSessionComplete ? "Completed" : "Finish Session"}
        </Button>
      </div>

      <div className="space-y-8 mt-6">
        {(session.sections as any[]).map((section: any) => (
          <div key={section.id} className="space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-2">{section.name}</h2>
            
            {section.exercises.map((ex: any) => (
              <Card key={ex.id} className={`border-2 transition-colors overflow-hidden rounded-2xl ${completedExercises[ex.id] ? 'border-green-500 bg-green-50/30' : 'border-slate-200 bg-white shadow-sm'}`} data-testid={`card-exercise-${ex.id}`}>
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <button onClick={() => toggleExercise(ex.id)} className="mt-1 shrink-0 transition-colors" data-testid={`button-toggle-${ex.id}`}>
                        {completedExercises[ex.id] ? 
                          <CheckCircle2 className="h-7 w-7 text-green-500" /> : 
                          <Circle className="h-7 w-7 text-slate-300 hover:text-indigo-500" />
                        }
                      </button>
                      <div className="min-w-0">
                        <h3 className="text-xl font-bold text-slate-900 leading-tight">{ex.name}</h3>
                      </div>
                    </div>
                    {ex.demoUrl && isValidUrl(ex.demoUrl) && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 shrink-0"
                        onClick={() => setVideoDialogUrl(ex.demoUrl)}
                        data-testid={`button-view-video-${ex.id}`}
                      >
                        <PlayCircle className="h-4 w-4 mr-1.5" /> View Video
                      </Button>
                    )}
                  </div>

                  <div className="ml-11 grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Sets</div>
                      <div className="text-lg font-bold text-slate-900">{ex.sets}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Reps</div>
                      <div className="text-lg font-bold text-slate-900">{ex.reps}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Tempo</div>
                      <div className="text-lg font-bold text-slate-900">{ex.tempo || "\u2014"}</div>
                    </div>
                  </div>

                  {(ex.goal || ex.additionalInstructions) && (
                    <div className="ml-11 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ex.goal && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Goal</div>
                          <div className="text-sm font-medium text-slate-900 leading-relaxed">{ex.goal}</div>
                        </div>
                      )}
                      {ex.additionalInstructions && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Additional Instructions</div>
                          <div className="text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">{ex.additionalInstructions}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {ex.notes && (
                    <div className="ml-11 p-3 bg-slate-50 rounded-xl text-sm text-slate-600 border border-slate-100 italic leading-relaxed">
                      {ex.notes}
                    </div>
                  )}

                  <div className="ml-11 space-y-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Notes & Logs</div>
                      <Textarea
                        placeholder="Add your notes for this exercise..."
                        value={exerciseNotes[ex.id] || ""}
                        onChange={(e) => setExerciseNotes(prev => ({ ...prev, [ex.id]: e.target.value }))}
                        className="min-h-[80px] bg-slate-50 border-slate-200 text-sm resize-none rounded-xl"
                        data-testid={`textarea-notes-${ex.id}`}
                      />
                    </div>

                    {ex.enableStructuredLogging && (
                      <>
                        <button
                          className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                          onClick={() => setExpandedLogs(prev => ({ ...prev, [ex.id]: !prev[ex.id] }))}
                          data-testid={`button-toggle-logs-${ex.id}`}
                        >
                          {expandedLogs[ex.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {expandedLogs[ex.id] ? "Hide set log" : "Log sets"}
                        </button>

                        {expandedLogs[ex.id] && (
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
                              <div className="col-span-2 text-center">Set</div>
                              <div className="col-span-5 text-center">Weight (lbs)</div>
                              <div className="col-span-5 text-center">Reps</div>
                            </div>
                            
                            {Array.from({ length: Number(ex.sets) || 3 }).map((_, i) => (
                              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-2 text-center font-medium text-slate-500 text-sm">{i + 1}</div>
                                <div className="col-span-5">
                                  <Input type="number" placeholder="--" className="h-10 text-center bg-white border-slate-200 rounded-lg" data-testid={`input-weight-${ex.id}-${i}`} />
                                </div>
                                <div className="col-span-5">
                                  <Input type="number" placeholder={String(ex.reps).split('-')[0] || "0"} className="h-10 text-center bg-white border-slate-200 rounded-lg" data-testid={`input-reps-${ex.id}-${i}`} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>

      <Dialog open={videoDialogUrl !== null} onOpenChange={(open) => { if (!open) setVideoDialogUrl(null); }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Exercise Demo</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {videoDialogUrl && getYouTubeEmbedUrl(videoDialogUrl) ? (
              <div className="aspect-video rounded-xl overflow-hidden bg-black">
                <iframe
                  src={getYouTubeEmbedUrl(videoDialogUrl)!}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : videoDialogUrl ? (
              <div className="text-center py-8">
                <Video className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">Demo video available</p>
                <a href={videoDialogUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="border-indigo-200 text-indigo-700">
                    <ExternalLink className="h-4 w-4 mr-2" /> Open Video
                  </Button>
                </a>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
