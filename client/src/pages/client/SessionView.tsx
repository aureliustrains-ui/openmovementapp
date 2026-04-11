import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  sessionsQuery,
  phasesQuery,
  useUpdatePhase,
  workoutLogsQuery,
  useCreateWorkoutLog,
  useCreateSessionCheckin,
  sessionCheckinsMeQuery,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Loader2, ExternalLink, ChevronDown, ChevronUp, Video } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExerciseStandardDetails } from "@/components/client/ExerciseStandardDetails";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";
import { normalizeVideoSource } from "@/lib/video";
import { requiresMovementCheckBeforeSession } from "@/lib/sessionEntry";

type SetLog = { weight: string; reps: string };

export default function ClientSessionView() {
  const [, params] = useRoute("/app/client/session/:sessionId");
  const [, setLocation] = useLocation();
  const sessionId = params?.sessionId;
  const { viewedUser, sessionUser, impersonating } = useAuth();
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
  const createSessionCheckin = useCreateSessionCheckin();

  const session = allSessions.find((s: any) => s.id === sessionId);
  const phase = allPhases.find((p: any) => p.id === session?.phaseId);
  const movementCheckBlocked = requiresMovementCheckBeforeSession(phase as any);
  const redirectedForMovementCheckRef = useRef(false);

  const { data: workoutLogs = [] } = useQuery({
    ...workoutLogsQuery(viewedUser?.id || ''),
    enabled: !!viewedUser?.id && !!phase,
  });

  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [setLogs, setSetLogs] = useState<Record<string, SetLog[]>>({});
  const [expandedNotesAndLogs, setExpandedNotesAndLogs] = useState<Record<string, boolean>>({});
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [afterSessionOpen, setAfterSessionOpen] = useState(false);
  const [afterSessionRpe, setAfterSessionRpe] = useState(6);
  const [afterSessionSleep, setAfterSessionSleep] = useState(6);
  const [afterSessionFeltOff, setAfterSessionFeltOff] = useState(false);
  const [afterSessionWhatFeltOff, setAfterSessionWhatFeltOff] = useState("");
  const [afterSessionOptionalNote, setAfterSessionOptionalNote] = useState("");
  const [savingAfterSession, setSavingAfterSession] = useState(false);
  const isClientSession = sessionUser?.role === "Client";
  const isClientContextMatch = Boolean(
    sessionUser?.id && viewedUser?.id && sessionUser.id === viewedUser.id,
  );
  const isCheckinReadOnly = impersonating || !isClientSession || !isClientContextMatch;

  useEffect(() => {
    if (
      isLoading ||
      !session ||
      !phase ||
      !movementCheckBlocked ||
      redirectedForMovementCheckRef.current
    ) {
      return;
    }
    redirectedForMovementCheckRef.current = true;
    toast({
      title: "Movement check required",
      description: "Complete your movement check before starting this session.",
    });
    setLocation("/app/client/my-phase");
  }, [isLoading, movementCheckBlocked, phase, session, setLocation, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-600)]" />
      </div>
    );
  }

  if (!session) return <div>Session not found</div>;
  if (session && phase && movementCheckBlocked) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  const instanceKey = `w${week}_${day}_${slot}_${session.id}`;
  const completedInstances: string[] = (phase?.completedScheduleInstances as string[]) || [];
  const isSessionComplete = completedInstances.includes(instanceKey);

  const schedule: any[] = (phase?.schedule as any[]) || [];
  const sessionDescription =
    typeof session.description === "string" ? session.description.trim() : "";
  const sessionDurationMinutes =
    typeof session.durationMinutes === "number" &&
    Number.isFinite(session.durationMinutes) &&
    session.durationMinutes > 0
      ? Math.floor(session.durationMinutes)
      : null;
  const sessionVideoUrl =
    typeof session.sessionVideoUrl === "string" ? session.sessionVideoUrl.trim() : "";
  const sessionSections = useMemo(() => (session.sections as any[]) || [], [session.sections]);

  useEffect(() => {
    if (sessionSections.length === 0) return;
    const sectionStillExists = selectedSectionId
      ? sessionSections.some((section: any) => section.id === selectedSectionId)
      : false;
    if (!sectionStillExists) {
      setSelectedSectionId(sessionSections[0].id);
    }
  }, [sessionSections, selectedSectionId]);

  const selectedSectionIndex = sessionSections.findIndex(
    (section: any) => section.id === selectedSectionId,
  );

  const jumpToSection = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    const target = document.getElementById(`section-${sectionId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
    if (isCheckinReadOnly) {
      toast({
        title: "Read-only client context",
        description:
          "Session writes are available only for a real client session viewing their own phase.",
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
      setAfterSessionSleep(6);
      setAfterSessionFeltOff(false);
      setAfterSessionWhatFeltOff("");
      setAfterSessionOptionalNote("");
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
    if (isCheckinReadOnly) {
      toast({
        title: "Read-only client context",
        description:
          "Session reviews can be submitted only in a real client session for this client.",
        variant: "destructive",
      });
      return;
    }
    if (!session || savingAfterSession) return;
    const payload = {
      sessionId: session.id,
      sessionRpe: afterSessionRpe,
      sleepLastNight: afterSessionSleep,
      feltOff: afterSessionFeltOff,
      whatFeltOff: afterSessionFeltOff ? afterSessionWhatFeltOff.trim() || null : null,
      optionalNote: afterSessionOptionalNote.trim() || null,
    };
    setSavingAfterSession(true);
    try {
      const created = await createSessionCheckin.mutateAsync(payload);
      const checkins = await queryClient.fetchQuery(sessionCheckinsMeQuery);
      const confirmed = Array.isArray(checkins)
        ? checkins.some((entry: any) => entry.id === created?.id || (entry.sessionId === session.id && entry.rpeOverall === afterSessionRpe))
        : false;
      if (!confirmed) {
        throw new Error("Session review write could not be verified");
      }

      toast({
        title: "Session review saved",
        description: "Your after-session review was saved successfully.",
      });
      setAfterSessionOpen(false);
      setLocation("/app/client/my-phase");
    } catch (error: any) {
      const message = error?.message || "Could not save session review";
      toast({
        title: "Could not save session review",
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
    <div className="mx-auto max-w-3xl space-y-4 pb-24 animate-in fade-in lg:max-w-6xl">
      {isCheckinReadOnly && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="banner-impersonation-read-only">
          Client check-ins are read-only unless you are logged in as this client account.
        </div>
      )}
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md py-4 -mx-6 px-6 md:-mx-8 md:px-8 flex items-center gap-4">
        <Link href="/app/client/my-phase">
          <Button variant="ghost" size="icon" className="rounded-full bg-white border border-slate-200 shadow-sm" data-testid="button-back-phase">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="space-y-1">
          <h1 className="font-display font-bold text-lg text-slate-900 leading-tight" data-testid="text-session-name">{session.name}</h1>
          <p className="text-xs text-slate-500">
            {phase?.name}
            {day ? ` \u2022 Week ${week} \u2022 ${day} ${slot}` : ""}
            {sessionDurationMinutes ? ` \u2022 ${sessionDurationMinutes} min` : ""}
          </p>
          {sessionDescription ? (
            <p className="mt-1 text-sm leading-relaxed text-slate-700" data-testid="text-session-description">
              {sessionDescription}
            </p>
          ) : null}
          {sessionVideoUrl ? (
            <div className="mt-3 max-w-lg" data-testid="session-header-video-wrap">
              <InlineVideoPlayer
                url={sessionVideoUrl}
                sourceType="link"
                openLinkLabel="Open session video"
                testId="session-header-video"
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-b border-slate-200" />

      <div className="space-y-1.5 lg:hidden" data-testid="list-session-sections-mobile">
        {sessionSections.map((section: any) => (
          <button
            key={section.id}
            onClick={() => jumpToSection(section.id)}
            className="w-full rounded-lg border border-slate-200/70 bg-slate-50/50 px-2.5 py-1.5 text-left text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100/70"
            data-testid={`button-section-list-${section.id}`}
          >
            {section.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-xl border border-slate-200/70 bg-slate-50/40 p-2.5" data-testid="rail-session-sections-desktop">
            <p className="px-2 text-[9px] font-medium uppercase tracking-wider text-slate-400">Session flow</p>
            <div className="mt-2 space-y-1.5">
              {sessionSections.map((section: any, index: number) => {
                const isCurrent = section.id === selectedSectionId;
                const isPrevious = selectedSectionIndex >= 0 && index < selectedSectionIndex;
                return (
                  <button
                    key={section.id}
                    onClick={() => jumpToSection(section.id)}
                    className={`w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${
                      isCurrent
                        ? "bg-[var(--color-brand-100)] text-[var(--color-brand-700)]"
                        : isPrevious
                          ? "bg-slate-100 text-slate-500"
                          : "bg-transparent text-slate-500 hover:bg-slate-100/70"
                    }`}
                    data-testid={`button-section-rail-${section.id}`}
                  >
                    {section.name}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          {sessionSections.map((section: any) => (
            <div
              key={section.id}
              id={`section-${section.id}`}
              className="space-y-3 scroll-mt-28"
              data-testid={`section-anchor-${section.id}`}
            >
              <h2 className="pl-1 text-lg font-semibold tracking-tight text-slate-900 md:text-xl">{section.name}</h2>

              {section.exercises.map((ex: any) => {
                const history = getExerciseHistory(ex.id);
                const hasHistory = history.length > 0;
                const totalSets = Number(ex.sets) || 3;
                const currentSetLog = getSetLog(ex.id, totalSets);
                const inlineVideo = ex.demoUrl && isValidUrl(ex.demoUrl) ? normalizeVideoSource(ex.demoUrl) : null;
                const isNotesOpen = !!expandedNotesAndLogs[ex.id];

                return (
                  <Card key={ex.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-testid={`card-exercise-${ex.id}`}>
                    <div className="space-y-0 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold leading-tight text-slate-900 md:text-lg">{ex.name}</h3>
                        </div>
                      </div>

                      {inlineVideo ? (
                        <div className="pt-3" data-testid={`inline-video-${ex.id}`}>
                          {inlineVideo.embedUrl ? (
                            <div className="aspect-video overflow-hidden rounded-md bg-black border border-slate-200">
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
                            <div className="flex items-center justify-between gap-3 border border-slate-200 rounded-md p-3">
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
                      ) : null}

                      <div className="pb-1 pt-2.5">
                        <ExerciseStandardDetails
                          exercise={ex}
                          showName={false}
                          showDemoLink={false}
                          integrated
                        />
                      </div>

                      <div className="mt-2 border-t border-slate-200/80" />

                      <Collapsible
                        open={isNotesOpen}
                        onOpenChange={(open) => setExpandedNotesAndLogs((prev) => ({ ...prev, [ex.id]: open }))}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            className="flex w-full items-center py-2.5 text-left text-sm font-semibold text-slate-700 hover:text-slate-900"
                            data-testid={`button-personal-notes-logs-${ex.id}`}
                          >
                            <span className="flex-1">Session notes</span>
                            {isNotesOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pb-1 space-y-3">
                          <Textarea
                            placeholder="Reps, weight, effort, or quick notes"
                            value={exerciseNotes[ex.id] || ""}
                            onChange={(e) => setExerciseNotes(prev => ({ ...prev, [ex.id]: e.target.value }))}
                            className="min-h-[80px] bg-white border-slate-200 text-sm resize-none rounded-md"
                            data-testid={`textarea-notes-${ex.id}`}
                          />

                          {ex.enableStructuredLogging && (
                            <div className="space-y-2 pt-2 border-t border-slate-200/70">
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
                                      className="h-10 text-center bg-white border-slate-200 rounded-md"
                                      value={currentSetLog[i]?.weight || ""}
                                      onChange={(e) => updateSetLog(ex.id, i, "weight", e.target.value, totalSets)}
                                      data-testid={`input-weight-${ex.id}-${i}`}
                                    />
                                  </div>
                                  <div className="col-span-5">
                                    <Input
                                      type="number"
                                      placeholder={String(ex.reps).split("-")[0] || "0"}
                                      className="h-10 text-center bg-white border-slate-200 rounded-md"
                                      value={currentSetLog[i]?.reps || ""}
                                      onChange={(e) => updateSetLog(ex.id, i, "reps", e.target.value, totalSets)}
                                      data-testid={`input-reps-${ex.id}-${i}`}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {hasHistory && (
                            <div className="space-y-2 pt-2 border-t border-slate-200/70" data-testid={`past-notes-logs-${ex.id}`}>
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                                Past session notes ({history.length})
                              </p>
                              <div className="divide-y divide-slate-200/70">
                                {history.map((h, hi) => (
                                  <div key={hi} className="py-3">
                                    <div className="mb-1.5">
                                      <span className="text-xs font-semibold text-slate-700">{formatOccurrenceLabel(h)}</span>
                                    </div>
                                    {h.sets && (h.sets as any[]).length > 0 && (
                                      <div className="flex gap-2 mt-1 flex-wrap">
                                        {(h.sets as any[]).map((s: any, si: number) => (
                                          <span key={si} className="text-[11px] border border-slate-200 rounded-sm px-2 py-0.5 text-slate-600 font-medium">
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
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4">
        <Button
          onClick={handleFinish}
          className={`w-full h-14 text-base font-semibold rounded-md ${isSessionComplete ? "border-slate-300 bg-slate-300 text-slate-700 hover:bg-slate-300" : ""}`}
          disabled={isSessionComplete || finishing || isCheckinReadOnly}
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
            <DialogTitle>Session review</DialogTitle>
            <DialogDescription>This takes about 10–20 seconds.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Session effort</div>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                  <button
                    key={`session-effort-${value}`}
                    type="button"
                    onClick={() => setAfterSessionRpe(value)}
                    className={`rounded-xl border px-2 py-3 text-sm font-semibold ${
                      afterSessionRpe === value
                        ? "border-[var(--color-brand-700)] bg-[var(--color-brand-700)] text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">1 Very easy · 10 Max effort</p>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Sleep last night</div>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                  <button
                    key={`sleep-last-night-${value}`}
                    type="button"
                    onClick={() => setAfterSessionSleep(value)}
                    className={`rounded-xl border px-2 py-3 text-sm font-semibold ${
                      afterSessionSleep === value
                        ? "border-[var(--color-brand-700)] bg-[var(--color-brand-700)] text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">1 Very poor · 10 Excellent</p>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Felt off?</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAfterSessionFeltOff(false)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    !afterSessionFeltOff
                      ? "border-[var(--color-brand-500)] bg-[var(--color-brand-100)] text-[var(--color-brand-700)]"
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
                      ? "border-[var(--color-brand-500)] bg-[var(--color-brand-100)] text-[var(--color-brand-700)]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Yes
                </button>
              </div>
              {afterSessionFeltOff && (
                <div className="space-y-2">
                  <Label htmlFor="after-session-what-felt-off">What felt off?</Label>
                  <Textarea
                    id="after-session-what-felt-off"
                    value={afterSessionWhatFeltOff}
                    onChange={(event) => setAfterSessionWhatFeltOff(event.target.value)}
                    placeholder="What felt off?"
                    className="min-h-[80px]"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="after-session-optional-note">Optional note</Label>
              <Textarea
                id="after-session-optional-note"
                value={afterSessionOptionalNote}
                onChange={(event) => setAfterSessionOptionalNote(event.target.value)}
                placeholder="Anything to add?"
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmitAfterSessionCheckin} disabled={savingAfterSession || isCheckinReadOnly}>
              {savingAfterSession ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
