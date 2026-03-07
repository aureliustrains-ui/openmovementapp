import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  sessionsQuery,
  phasesQuery,
  useUpdatePhase,
  workoutLogsQuery,
  useCreateWorkoutLog,
  sessionCheckinsMeQuery,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Circle, PlayCircle, Loader2, ExternalLink, ChevronDown, ChevronUp, Video, NotebookPen } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

type SetLog = { weight: string; reps: string };

type VideoSource = { kind: "youtube" | "drive" | "link"; href: string; embedUrl?: string };

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/]+)/);
      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      }
    }
    if (host.includes("youtu.be")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function getDriveEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().includes("drive.google.com")) return null;
    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    const id = fileMatch?.[1] || parsed.searchParams.get("id");
    if (!id) return null;
    return `https://drive.google.com/file/d/${id}/preview`;
  } catch {
    return null;
  }
}

function normalizeVideoSource(url: string): VideoSource | null {
  try {
    new URL(url);
  } catch {
    return null;
  }
  const youtubeEmbed = getYouTubeEmbedUrl(url);
  if (youtubeEmbed) return { kind: "youtube", href: url, embedUrl: youtubeEmbed };
  const driveEmbed = getDriveEmbedUrl(url);
  if (driveEmbed) return { kind: "drive", href: url, embedUrl: driveEmbed };
  return { kind: "link", href: url };
}

export default function ClientSessionView() {
  const [, params] = useRoute("/app/client/session/:sessionId");
  const [, setLocation] = useLocation();
  const sessionId = params?.sessionId;
  const { viewedUser, impersonating } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const searchParams = new URLSearchParams(window.location.search);
  const week = searchParams.get("week") || "1";
  const day = searchParams.get("day") || "";
  const slot = searchParams.get("slot") || "AM";

  const { data: allSessions = [], isLoading } = useQuery(sessionsQuery);
  const { data: allPhases = [] } = useQuery(phasesQuery);
  const updatePhase = useUpdatePhase();
  const createWorkoutLog = useCreateWorkoutLog();

  const session = allSessions.find((s: any) => s.id === sessionId);
  const phase = allPhases.find((p: any) => p.id === session?.phaseId);

  const { data: workoutLogs = [] } = useQuery({
    ...workoutLogsQuery(viewedUser?.id || ''),
    enabled: !!viewedUser?.id && !!phase,
  });

  const [completedExercises, setCompletedExercises] = useState<Record<string, boolean>>({});
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [setLogs, setSetLogs] = useState<Record<string, SetLog[]>>({});
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [expandedNotesAndLogs, setExpandedNotesAndLogs] = useState<Record<string, boolean>>({});
  const [openVideoByExercise, setOpenVideoByExercise] = useState<Record<string, boolean>>({});
  const [finishing, setFinishing] = useState(false);
  const [afterSessionOpen, setAfterSessionOpen] = useState(false);
  const [afterSessionRpe, setAfterSessionRpe] = useState(6);
  const [afterSessionFeltOff, setAfterSessionFeltOff] = useState(false);
  const [afterSessionFeltOffNote, setAfterSessionFeltOffNote] = useState("");
  const [savingAfterSession, setSavingAfterSession] = useState(false);
  const isImpersonationReadOnly = impersonating;

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

  const schedule: any[] = (phase?.schedule as any[]) || [];

  const getExerciseHistory = (exerciseId: string) => {
    const pastLogs = (workoutLogs as any[]).filter(
      (log: any) => log.exerciseId === exerciseId && log.phaseId === phase?.id
    );

    const pastCompletions: { week: number; day: string; slot: string; notes?: string; sets?: any[]; instanceId: string }[] = [];

    for (const entry of schedule) {
      if (entry.sessionId !== session.id) continue;
      const entryWeek = entry.week;
      const entryDay = entry.day;
      const entrySlot = entry.slot || "AM";
      const key = `w${entryWeek}_${entryDay}_${entrySlot}_${session.id}`;

      if (key === instanceKey) continue;
      if (!completedInstances.includes(key)) continue;

      const matchingLog = pastLogs.find((l: any) => l.instanceId === key);
      pastCompletions.push({
        week: entryWeek,
        day: entryDay,
        slot: entrySlot,
        notes: matchingLog?.clientNotes || undefined,
        sets: matchingLog?.sets as any[] || undefined,
        instanceId: key,
      });
    }

    pastCompletions.sort((a, b) => b.week - a.week || b.day.localeCompare(a.day));
    return pastCompletions;
  };

  const toggleExercise = (id: string) => {
    setCompletedExercises(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getSetLog = (exerciseId: string, setCount: number): SetLog[] => {
    if (setLogs[exerciseId]) return setLogs[exerciseId];
    return Array.from({ length: setCount }, () => ({ weight: "", reps: "" }));
  };

  const updateSetLog = (exerciseId: string, setIndex: number, field: 'weight' | 'reps', value: string, totalSets: number) => {
    setSetLogs(prev => {
      const current = prev[exerciseId] || Array.from({ length: totalSets }, () => ({ weight: "", reps: "" }));
      const updated = [...current];
      updated[setIndex] = { ...updated[setIndex], [field]: value };
      return { ...prev, [exerciseId]: updated };
    });
  };

  const handleFinish = async () => {
    if (isImpersonationReadOnly) {
      toast({
        title: "Read-only in impersonation mode",
        description: "Client session writes are disabled while impersonating.",
        variant: "destructive",
      });
      return;
    }
    if (isSessionComplete || !phase || !viewedUser || finishing) return;
    setFinishing(true);

    try {
      const allExercises: { id: string; sets: string }[] = [];
      for (const sec of (session.sections as any[])) {
        for (const ex of sec.exercises) {
          allExercises.push({ id: ex.id, sets: ex.sets });
        }
      }

      for (const ex of allExercises) {
        const notes = exerciseNotes[ex.id] || "";
        const setsData = setLogs[ex.id] || [];
        const hasData = notes.trim() || setsData.some(s => s.weight || s.reps);

        if (hasData) {
          await createWorkoutLog.mutateAsync({
            clientId: viewedUser.id,
            phaseId: phase.id,
            instanceId: instanceKey,
            exerciseId: ex.id,
            date: new Date().toISOString().split('T')[0],
            sets: setsData.filter(s => s.weight || s.reps).map(s => ({
              weight: s.weight || "",
              reps: s.reps || "",
            })),
            clientNotes: notes || null,
          });
        }
      }

      const updated = [...completedInstances, instanceKey];
      await updatePhase.mutateAsync({
        id: phase.id,
        completedScheduleInstances: updated,
      });

      toast({
        title: "Session Complete",
        description: "Your workout has been saved.",
      });
      setAfterSessionRpe(6);
      setAfterSessionFeltOff(false);
      setAfterSessionFeltOffNote("");
      setAfterSessionOpen(true);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to save session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setFinishing(false);
    }
  };

  const handleSubmitAfterSessionCheckin = async () => {
    if (isImpersonationReadOnly) {
      return;
    }
    if (!session || savingAfterSession) return;
    const payload = {
      sessionId: session.id,
      rpeOverall: afterSessionRpe,
      feltOff: afterSessionFeltOff,
      feltOffNote: afterSessionFeltOff ? afterSessionFeltOffNote.trim() || null : null,
    };
    setSavingAfterSession(true);
    try {
      const authRes = await fetch("/api/auth/me", {
        credentials: "include",
      });
      const authBodyText = await authRes.text();
      const authContentType = authRes.headers.get("content-type") || "unknown";
      if (!authRes.ok) {
        throw new Error("Not authenticated in server session. Please sign in again.");
      }
      if (!authContentType.includes("application/json")) {
        throw new Error(`Expected JSON from /api/auth/me but received ${authContentType}.`);
      }

      let authBody: { user?: { id?: string; role?: string } } | null = null;
      try {
        authBody = JSON.parse(authBodyText) as { user?: { id?: string; role?: string } };
      } catch {
        throw new Error("Invalid JSON returned by /api/auth/me.");
      }

      if (authBody?.user?.role !== "Client") {
        throw new Error(
          `Server session role is ${authBody?.user?.role || "unknown"}; after-session check-in is client-only. Stop impersonation and log in as the client account.`,
        );
      }
      if (!authBody?.user?.id || authBody.user.id !== phase?.clientId) {
        throw new Error("Server session user does not match this client phase.");
      }

      const res = await fetch("/api/session-checkins", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get("content-type") || "unknown";
      const responseText = await res.text();

      if (!res.ok) {
        let message = `Request failed with status ${res.status}`;
        if (contentType.includes("application/json")) {
          try {
            const body = JSON.parse(responseText) as { message?: string };
            if (body.message) message = body.message;
          } catch {
            // keep status-based fallback
          }
        }
        throw new Error(message);
      }

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Expected JSON from /api/session-checkins but received ${contentType}.`,
        );
      }

      const created = JSON.parse(responseText) as { id?: string };
      await queryClient.invalidateQueries({ queryKey: ["sessionCheckins"] });
      await queryClient.invalidateQueries({ queryKey: ["clientCheckinsSummary"] });
      await queryClient.invalidateQueries({ queryKey: ["clientCheckinsTrends"] });
      await queryClient.invalidateQueries({ queryKey: ["clientCheckinsRecent"] });
      const checkins = await queryClient.fetchQuery(sessionCheckinsMeQuery);
      const confirmed = Array.isArray(checkins)
        ? checkins.some((entry: any) => entry.id === created?.id || (entry.sessionId === session.id && entry.rpeOverall === afterSessionRpe))
        : false;
      if (!confirmed) {
        throw new Error("Check-in write could not be verified");
      }

      toast({
        title: "Check-in saved",
        description: "Your after-session check-in was saved successfully.",
      });
      setAfterSessionOpen(false);
      setLocation("/app/client/my-phase");
    } catch (error: any) {
      const message = error?.message || "Could not save check-in";
      toast({
        title: "Could not save check-in",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingAfterSession(false);
    }
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const formatOccurrenceLabel = (h: { week: number; day: string; slot: string }) => {
    return `Week ${h.week} • ${h.day} • ${h.slot}`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 animate-in fade-in">
      {isImpersonationReadOnly && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="banner-impersonation-read-only">
          You are viewing this as an admin in impersonation mode. Client check-ins are read-only.
        </div>
      )}
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md border-b border-slate-200 py-4 -mx-6 px-6 md:-mx-8 md:px-8 flex items-center gap-4">
        <Link href="/app/client/my-phase">
          <Button variant="ghost" size="icon" className="rounded-full bg-white border border-slate-200 shadow-sm" data-testid="button-back-phase">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-display font-bold text-lg text-slate-900 leading-tight" data-testid="text-session-name">{session.name}</h1>
          <p className="text-xs text-slate-500">{phase?.name}{day ? ` \u2022 Week ${week} \u2022 ${day} ${slot}` : ''}</p>
        </div>
      </div>

      <div className="space-y-8 mt-6">
        {(session.sections as any[]).map((section: any) => (
          <div key={section.id} className="space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-2">{section.name}</h2>
            
            {section.exercises.map((ex: any) => {
              const history = getExerciseHistory(ex.id);
              const hasHistory = history.length > 0;
              const isHistoryOpen = expandedHistory[ex.id] ?? false;
              const totalSets = Number(ex.sets) || 3;
              const currentSetLog = getSetLog(ex.id, totalSets);
              const inlineVideo = ex.demoUrl && isValidUrl(ex.demoUrl) ? normalizeVideoSource(ex.demoUrl) : null;
              const isVideoOpen = !!openVideoByExercise[ex.id];

              return (
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
                      {inlineVideo && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 shrink-0"
                          onClick={() =>
                            setOpenVideoByExercise((prev) => ({ ...prev, [ex.id]: !prev[ex.id] }))
                          }
                          data-testid={`button-view-video-${ex.id}`}
                        >
                          <PlayCircle className="h-4 w-4 mr-1.5" /> {isVideoOpen ? "Hide Video" : "Watch Video"}
                        </Button>
                      )}
                    </div>

                    {inlineVideo && (
                      <Collapsible open={isVideoOpen} onOpenChange={(open) => setOpenVideoByExercise((prev) => ({ ...prev, [ex.id]: open }))}>
                        <CollapsibleContent className="ml-11 mt-2">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            {inlineVideo.embedUrl ? (
                              <div className="aspect-video overflow-hidden rounded-lg bg-black">
                                <iframe
                                  src={inlineVideo.embedUrl}
                                  className="h-full w-full border-0"
                                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                  allowFullScreen
                                  referrerPolicy="strict-origin-when-cross-origin"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                                <div className="flex items-center gap-2 text-sm text-slate-700">
                                  <Video className="h-4 w-4 text-slate-500" />
                                  Video link available
                                </div>
                                <a href={inlineVideo.href} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm">
                                    <ExternalLink className="h-4 w-4 mr-1.5" />
                                    Open link
                                  </Button>
                                </a>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

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
                      <Collapsible
                        open={!!expandedNotesAndLogs[ex.id]}
                        onOpenChange={(open) => setExpandedNotesAndLogs((prev) => ({ ...prev, [ex.id]: open }))}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            data-testid={`button-notes-logs-${ex.id}`}
                          >
                            <NotebookPen className="h-4 w-4 text-slate-500 shrink-0" />
                            <span className="flex-1">Add note / log sets</span>
                            {expandedNotesAndLogs[ex.id] ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Notes & logs</div>
                            <Textarea
                              placeholder="Add your notes for this exercise..."
                              value={exerciseNotes[ex.id] || ""}
                              onChange={(e) => setExerciseNotes(prev => ({ ...prev, [ex.id]: e.target.value }))}
                              className="min-h-[80px] bg-slate-50 border-slate-200 text-sm resize-none rounded-xl"
                              data-testid={`textarea-notes-${ex.id}`}
                            />
                          </div>

                          {ex.enableStructuredLogging && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
                                <div className="col-span-2 text-center">Set</div>
                                <div className="col-span-5 text-center">Weight (lbs)</div>
                                <div className="col-span-5 text-center">Reps</div>
                              </div>

                              {Array.from({ length: totalSets }).map((_, i) => (
                                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-2 text-center font-medium text-slate-500 text-sm">{i + 1}</div>
                                  <div className="col-span-5">
                                    <Input
                                      type="number"
                                      placeholder="--"
                                      className="h-10 text-center bg-white border-slate-200 rounded-lg"
                                      value={currentSetLog[i]?.weight || ""}
                                      onChange={(e) => updateSetLog(ex.id, i, "weight", e.target.value, totalSets)}
                                      data-testid={`input-weight-${ex.id}-${i}`}
                                    />
                                  </div>
                                  <div className="col-span-5">
                                    <Input
                                      type="number"
                                      placeholder={String(ex.reps).split("-")[0] || "0"}
                                      className="h-10 text-center bg-white border-slate-200 rounded-lg"
                                      value={currentSetLog[i]?.reps || ""}
                                      onChange={(e) => updateSetLog(ex.id, i, "reps", e.target.value, totalSets)}
                                      data-testid={`input-reps-${ex.id}-${i}`}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>

                      {hasHistory && (
                        <Collapsible
                          open={isHistoryOpen}
                          onOpenChange={(open) => setExpandedHistory((prev) => ({ ...prev, [ex.id]: open }))}
                        >
                          <CollapsibleTrigger asChild>
                            <button
                              className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                              data-testid={`button-past-notes-${ex.id}`}
                            >
                              <NotebookPen className="h-4 w-4 text-slate-500 shrink-0" />
                              <span className="flex-1">Past notes & logs ({history.length})</span>
                              {isHistoryOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <div className="border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 overflow-hidden">
                              {history.map((h, hi) => (
                                <div key={hi} className="px-4 py-3">
                                  <div className="mb-1.5">
                                    <span className="text-xs font-semibold text-slate-700">{formatOccurrenceLabel(h)}</span>
                                  </div>
                                  {h.sets && (h.sets as any[]).length > 0 && (
                                    <div className="flex gap-2 mt-1 flex-wrap">
                                      {(h.sets as any[]).map((s: any, si: number) => (
                                        <span key={si} className="text-[11px] bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-slate-600 font-medium">
                                          Set {si + 1}: {s.weight || "--"}lbs × {s.reps || "--"}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {h.notes && (
                                    <p className="text-xs text-slate-600 leading-relaxed mt-1">"{h.notes}"</p>
                                  )}
                                  {!h.notes && (!h.sets || (h.sets as any[]).length === 0) && (
                                    <p className="text-[11px] text-slate-400 italic mt-0.5">Completed, no details logged</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ))}
      </div>

      <div className="pt-4">
        <Button
          onClick={handleFinish}
          className={`w-full h-14 text-base font-semibold rounded-2xl ${isSessionComplete ? "bg-slate-400 text-white" : "bg-green-600 hover:bg-green-700 text-white shadow-lg"}`}
          disabled={isSessionComplete || finishing || isImpersonationReadOnly}
          data-testid="button-finish-session"
        >
          {finishing ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Saving...</>
          ) : isSessionComplete ? (
            <><CheckCircle2 className="h-5 w-5 mr-2" /> Session Completed</>
          ) : (
            "Finish Session"
          )}
        </Button>
      </div>

      <Dialog
        open={afterSessionOpen}
        onOpenChange={(open) => {
          if (savingAfterSession) return;
          setAfterSessionOpen(open);
          if (!open) {
            setLocation("/app/client/my-phase");
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Quick session check-in</DialogTitle>
            <DialogDescription>This takes about 10–20 seconds.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">How hard was this session overall?</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-500">Session RPE</span>
                  <span className="text-2xl font-bold text-slate-900">{afterSessionRpe}</span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={1}
                  value={[afterSessionRpe]}
                  onValueChange={(value) => setAfterSessionRpe(value[0] ?? 6)}
                />
                <div className="mt-3 grid grid-cols-5 text-[10px] text-slate-500">
                  <span>0 Rest</span>
                  <span>2 Very easy</span>
                  <span>4 Moderate</span>
                  <span>6 Hard</span>
                  <span className="text-right">10 Max</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Did anything feel off today?</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAfterSessionFeltOff(false)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    !afterSessionFeltOff
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setAfterSessionFeltOff(true)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    afterSessionFeltOff
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Yes
                </button>
              </div>
              {afterSessionFeltOff && (
                <Textarea
                  value={afterSessionFeltOffNote}
                  onChange={(event) => setAfterSessionFeltOffNote(event.target.value)}
                  placeholder="What felt off?"
                  className="min-h-[80px]"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmitAfterSessionCheckin} disabled={savingAfterSession || isImpersonationReadOnly}>
              {savingAfterSession ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save check-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
