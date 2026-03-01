import { useQuery } from "@tanstack/react-query";
import { phasesQuery, sessionsQuery, useUpdatePhase } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, Lock, Calendar as CalIcon, UploadCloud, Loader2, CalendarDays } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ClientMyPhase() {
  const { data: allPhases = [], isLoading: loadingPhases } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);
  const { user } = useAuth();
  const updatePhase = useUpdatePhase();
  const { toast } = useToast();
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(1);

  if (!user) return null;

  const activePhase = allPhases.find((p: any) => p.clientId === user.id && p.status === 'Active');
  const pendingPhase = allPhases.find((p: any) => p.clientId === user.id && p.status === 'Waiting for Movement Check');

  const handleOpenUpload = (exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
    setVideoUrl("");
    setClientNote("");
    setIsUploadOpen(true);
  };

  const handleSubmitVideo = async () => {
    if (!pendingPhase || !selectedExerciseId) return;
    
    setIsSubmitting(true);
    try {
      const updatedChecks = (pendingPhase.movementChecks as any[]).map((mc: any) => {
        if (mc.exerciseId !== selectedExerciseId) return mc;
        return { 
          ...mc, 
          status: 'Pending', 
          videoUrl: videoUrl || 'https://example.com/demo.mp4',
          submittedAt: new Date().toISOString(),
          clientNote: clientNote
        };
      });

      await updatePhase.mutateAsync({
        id: pendingPhase.id,
        movementChecks: updatedChecks,
      });

      toast({
        title: "Video Submitted",
        description: "Your coach will review your movement shortly.",
      });
      setIsUploadOpen(false);
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your video.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className={
                      mc.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                      mc.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      mc.status === 'Needs Resubmission' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }>
                      {mc.status || 'Not Submitted'}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{mc.name}</h3>
                  {mc.feedback && (
                    <div className="mt-3 bg-red-50 border border-red-100 p-4 rounded-xl">
                      <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1">Coach Feedback</p>
                      <p className="text-slate-700 italic">"{mc.feedback}"</p>
                    </div>
                  )}
                  {mc.clientNote && mc.status === 'Pending' && (
                    <p className="text-sm text-slate-500 mt-2 italic">Note: {mc.clientNote}</p>
                  )}
                </div>
                
                <div className="w-full md:w-auto shrink-0">
                  {mc.status === 'Approved' ? (
                    <div className="flex items-center text-green-600 font-medium bg-green-50 px-4 py-2 rounded-lg border border-green-100">
                      <CheckCircle2 className="mr-2 h-5 w-5" /> Approved
                    </div>
                  ) : mc.status === 'Pending' ? (
                    <div className="flex items-center text-amber-600 font-medium bg-amber-50 px-4 py-2 rounded-lg border border-amber-100">
                      <UploadCloud className="mr-2 h-5 w-5" /> Awaiting Review
                    </div>
                  ) : (
                    <Button 
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 px-6"
                      onClick={() => handleOpenUpload(mc.exerciseId)}
                      data-testid={`button-upload-video-${i}`}
                    >
                      <UploadCloud className="mr-2 h-5 w-5" /> {mc.status === 'Needs Resubmission' ? 'Re-upload Video' : 'Upload Video'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Submit Movement Check</DialogTitle>
              <DialogDescription>
                Upload a video of your performance or provide a link (YouTube, Drive, etc.)
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="video-file">Video File</Label>
                <Input id="video-file" type="file" accept="video/*" className="cursor-pointer" />
                <p className="text-[10px] text-slate-500 italic">Files are simulated in this prototype. Use the URL field below for direct links.</p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or use a URL</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="video-url">Video URL</Label>
                <Input 
                  id="video-url" 
                  placeholder="https://youtube.com/..." 
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  data-testid="input-video-url"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="note">Optional Note</Label>
                <Textarea 
                  id="note" 
                  placeholder="Anything the coach should know?" 
                  value={clientNote}
                  onChange={(e) => setClientNote(e.target.value)}
                  data-testid="input-client-note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsUploadOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitVideo}
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={isSubmitting}
                data-testid="button-submit-video"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                Submit for Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

  const phaseSessions = allSessions.filter((s: any) => s.phaseId === activePhase.id);
  const schedule = (activePhase.schedule as any[]) || [];
  const weekSchedule = schedule.filter((s: any) => s.week === selectedWeek);
  const hasGridSchedule = schedule.some((s: any) => s.slot);
  const completedInstances: string[] = (activePhase.completedScheduleInstances as string[]) || [];

  const isEntryCompleted = (entry: any, session: any) => {
    const key = `w${selectedWeek}_${entry.day}_${entry.slot || "AM"}_${session.id}`;
    return completedInstances.includes(key);
  };

  const buildSessionUrl = (sessionId: string, day: string, slotVal: string) => {
    return `/app/client/session/${sessionId}?week=${selectedWeek}&day=${encodeURIComponent(day)}&slot=${encodeURIComponent(slotVal)}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div className="bg-slate-900 rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <div className="w-64 h-64 border-8 border-indigo-500 rounded-full blur-3xl mix-blend-screen" />
        </div>
        <div className="relative z-10">
          <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md mb-6 py-1.5 px-3" data-testid="badge-active-phase">
            Active Phase &bull; Week {selectedWeek} / {activePhase.durationWeeks}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4" data-testid="text-phase-name">{activePhase.name}</h1>
          <p className="text-slate-300 text-lg max-w-xl leading-relaxed">{activePhase.goal}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-indigo-600" />
            Weekly Schedule
          </h2>
          {activePhase.durationWeeks > 1 && (
            <div className="flex bg-slate-100 rounded-lg p-1 gap-0.5">
              {Array.from({ length: activePhase.durationWeeks }, (_, i) => i + 1).map(w => (
                <button
                  key={w}
                  onClick={() => setSelectedWeek(w)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${selectedWeek === w ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                  data-testid={`button-week-${w}`}
                >
                  W{w}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasGridSchedule ? (
          <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden" data-testid="card-schedule-grid">
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="grid grid-cols-[100px_1fr_1fr] border-b border-slate-200 bg-slate-50">
                  <div className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200">Day</div>
                  <div className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center border-r border-slate-200">AM</div>
                  <div className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">PM</div>
                </div>
                {WEEKDAYS.map((day, dayIdx) => {
                  const amEntries = weekSchedule.filter((e: any) => e.day === day && (e.slot || "AM") === "AM");
                  const pmEntries = weekSchedule.filter((e: any) => e.day === day && e.slot === "PM");
                  const hasEntries = amEntries.length > 0 || pmEntries.length > 0;

                  return (
                    <div key={day} className={`grid grid-cols-[100px_1fr_1fr] border-b border-slate-100 last:border-b-0 ${hasEntries ? '' : 'opacity-40'} ${dayIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <div className="p-3 text-sm font-medium text-slate-600 border-r border-slate-100 flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono w-4">{dayIdx + 1}</span>
                        {day.slice(0, 3)}
                      </div>
                      {["AM", "PM"].map(slotVal => {
                        const entries = slotVal === "AM" ? amEntries : pmEntries;
                        return (
                          <div key={slotVal} className="p-2 border-r last:border-r-0 border-slate-100 min-h-[52px] flex flex-wrap items-center gap-1.5">
                            {entries.map((entry: any, i: number) => {
                              const session = phaseSessions.find((s: any) => s.id === entry.sessionId);
                              if (!session) return null;
                              const completed = isEntryCompleted(entry, session);
                              return (
                                <Link key={i} href={buildSessionUrl(session.id, day, slotVal)}>
                                  <Badge
                                    variant="outline"
                                    className={`cursor-pointer transition-colors text-xs font-medium ${
                                      completed
                                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                    }`}
                                    data-testid={`sched-session-${day}-${slotVal}-${i}`}
                                  >
                                    {completed && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                    {session.name}
                                  </Badge>
                                </Link>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(() => {
              const displayItems = weekSchedule.length > 0
                ? weekSchedule.map((sched: any, i: number) => {
                    const session = allSessions.find((s: any) => s.id === sched.sessionId);
                    return { session, day: sched.day, slot: sched.slot || "AM", key: i };
                  })
                : phaseSessions.map((session: any, i: number) => ({
                    session,
                    day: WEEKDAYS[i % 7],
                    slot: "AM",
                    key: i,
                  }));

              return displayItems.map(({ session, day, slot: slotVal, key }: any) => {
                if (!session) return null;
                const instanceKey = `w${selectedWeek}_${day}_${slotVal}_${session.id}`;
                const isCompleted = completedInstances.includes(instanceKey);
                
                return (
                  <Link key={key} href={buildSessionUrl(session.id, day, slotVal)}>
                    <Card className="border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group bg-white rounded-2xl overflow-hidden h-full" data-testid={`card-session-${key}`}>
                      <CardContent className="p-0 h-full">
                        <div className="flex items-stretch h-full">
                          <div className={`w-3 shrink-0 ${isCompleted ? 'bg-green-500' : 'bg-indigo-600'}`} />
                          <div className="p-6 flex-1 flex justify-between items-center">
                            <div>
                              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{day}</div>
                              <h3 className={`text-xl font-bold ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-900 group-hover:text-indigo-700 transition-colors'}`}>{session?.name}</h3>
                              <p className="text-sm text-slate-500 mt-1">{(session?.sections as any[])?.length} Blocks</p>
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
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
