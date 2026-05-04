import { useQuery } from "@tanstack/react-query";
import {
  phasesQuery,
  sessionsQuery,
  useUpdatePhase,
  weeklyCheckinsMeQuery,
  weeklyCheckinsCurrentOrDueQuery,
  useCreateWeeklyCheckin,
  useCreateClientVideoUploadTarget,
  uploadClientVideoToObjectStorage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, Calendar as CalIcon, UploadCloud, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getTrainingWeekLifecycle,
  type TrainingScheduleEntry,
} from "@/lib/trainingWeek";
import { pickDefaultVisiblePhase } from "@/lib/clientPhase";
import { isScheduleEntryCompleted } from "@/lib/clientSchedule";
import { resolveClientSessionEntryDestination } from "@/lib/sessionEntry";
import { ExerciseStandardDetails } from "@/components/client/ExerciseStandardDetails";
import { VideoUploadField } from "@/components/client/VideoUploadField";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const ALLOWED_CLIENT_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/3gpp",
]);
const MAX_CLIENT_VIDEO_BYTES = 250 * 1024 * 1024;

function hasValidHttpVideoLink(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export default function ClientMyPhase() {
  const { viewedUser, sessionUser, impersonating } = useAuth();
  const isClientSession = sessionUser?.role === "Client";
  const isClientContextMatch = Boolean(
    sessionUser?.id && viewedUser?.id && sessionUser.id === viewedUser.id,
  );
  const isCheckinReadOnly = impersonating || !isClientSession || !isClientContextMatch;
  const { data: allPhases = [], isLoading: loadingPhases } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);
  const { data: weeklyCheckins = [] } = useQuery({
    ...weeklyCheckinsMeQuery,
    enabled: !!sessionUser && !impersonating,
  });
  const { data: weeklyCheckinStatus } = useQuery({
    ...weeklyCheckinsCurrentOrDueQuery,
    enabled: !!sessionUser && !isCheckinReadOnly,
  });
  const updatePhase = useUpdatePhase();
  const createWeeklyCheckin = useCreateWeeklyCheckin();
  const createClientVideoUploadTarget = useCreateClientVideoUploadTarget();
  const { toast } = useToast();
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [uploadPhaseId, setUploadPhaseId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [movementUploadFile, setMovementUploadFile] = useState<File | null>(null);
  const [clientNote, setClientNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [weeklyCheckinOpen, setWeeklyCheckinOpen] = useState(false);
  const [weeklyCheckinStep, setWeeklyCheckinStep] = useState<1 | 2>(1);
  const [weeklySleep, setWeeklySleep] = useState(3);
  const [weeklyEnergy, setWeeklyEnergy] = useState(3);
  const [weeklyInjuryAffected, setWeeklyInjuryAffected] = useState(false);
  const [weeklyInjuryImpact, setWeeklyInjuryImpact] = useState<number | null>(null);
  const [weeklyNote, setWeeklyNote] = useState("");
  const [submittingWeeklyCheckin, setSubmittingWeeklyCheckin] = useState(false);
  const previousRecommendedWeekRef = useRef<number | null>(null);
  const weeklyCheckinQueryHandledRef = useRef(false);
  const movementLinkDraft = videoUrl.trim();
  const movementFileReady = movementUploadFile
    ? ALLOWED_CLIENT_VIDEO_TYPES.has(movementUploadFile.type) &&
      movementUploadFile.size <= MAX_CLIENT_VIDEO_BYTES
    : false;
  const movementLinkReady = hasValidHttpVideoLink(movementLinkDraft);
  const movementDraftReady = movementFileReady || movementLinkReady;

  if (!viewedUser) return null;

  const visiblePhases = allPhases.filter((p: any) =>
    p.clientId === viewedUser.id && (p.status === 'Active' || p.status === 'Waiting for Movement Check')
  );
  const visiblePhaseSignature = visiblePhases
    .map((phase: any) => `${phase.id}:${phase.status}:${phase.startDate || ""}`)
    .join(",");

  useEffect(() => {
    const defaultVisiblePhase = pickDefaultVisiblePhase(visiblePhases);
    if (defaultVisiblePhase && !selectedPhaseId) {
      setSelectedPhaseId(defaultVisiblePhase.id);
    }
    if (selectedPhaseId && !visiblePhases.find((p: any) => p.id === selectedPhaseId)) {
      setSelectedPhaseId(defaultVisiblePhase?.id || null);
    }
  }, [visiblePhaseSignature, selectedPhaseId]);

  const currentPhase =
    visiblePhases.find((p: any) => p.id === selectedPhaseId) || pickDefaultVisiblePhase(visiblePhases);
  const phaseScheduleSignature = currentPhase ? JSON.stringify(currentPhase.schedule || []) : "";
  const completedInstancesSignature = currentPhase
    ? JSON.stringify(currentPhase.completedScheduleInstances || [])
    : "";

  useEffect(() => {
    previousRecommendedWeekRef.current = null;
  }, [currentPhase?.id]);

  useEffect(() => {
    if (!currentPhase) return;
    const schedule = ((currentPhase.schedule as any[]) || []) as TrainingScheduleEntry[];
    const completedInstances = ((currentPhase.completedScheduleInstances as string[]) || []) as string[];
    const lifecycle = getTrainingWeekLifecycle(
      currentPhase.durationWeeks || 1,
      schedule,
      completedInstances,
      currentPhase.id,
      weeklyCheckins as Array<{ phaseId?: string | null; phaseWeekNumber?: number | null }>,
    );
    const dueWeek = lifecycle.weeks.find((status) => status.state === "ready_for_checkin");
    const serverPhaseWeek =
      weeklyCheckinStatus &&
      weeklyCheckinStatus.phaseId === currentPhase.id &&
      typeof weeklyCheckinStatus.phaseWeekNumber === "number" &&
      Number.isFinite(weeklyCheckinStatus.phaseWeekNumber)
        ? weeklyCheckinStatus.phaseWeekNumber
        : null;
    const recommendedWeek = dueWeek?.week ?? serverPhaseWeek ?? lifecycle.currentWeek;
    const selectedStatus = lifecycle.weeks.find((status) => status.week === selectedWeek);
    const selectedWeekOutOfRange = selectedWeek < 1 || selectedWeek > lifecycle.weeks.length;
    const previousRecommendedWeek = previousRecommendedWeekRef.current;
    const shouldInitializeToRecommended = previousRecommendedWeek === null;
    const shouldAdvanceWithProgress =
      previousRecommendedWeek !== null &&
      recommendedWeek !== previousRecommendedWeek &&
      selectedWeek === previousRecommendedWeek;

    if (
      selectedWeekOutOfRange ||
      !selectedStatus ||
      shouldInitializeToRecommended ||
      shouldAdvanceWithProgress
    ) {
      setSelectedWeek(recommendedWeek);
    }
    previousRecommendedWeekRef.current = recommendedWeek;

  }, [
    currentPhase?.id,
    currentPhase?.durationWeeks,
    phaseScheduleSignature,
    completedInstancesSignature,
    JSON.stringify(
      (weeklyCheckins as Array<{ id?: string; phaseId?: string | null; phaseWeekNumber?: number | null }>).map(
        (entry) => `${entry.id || ""}:${entry.phaseId || ""}:${entry.phaseWeekNumber ?? ""}`,
      ),
    ),
    weeklyCheckinStatus?.phaseId,
    weeklyCheckinStatus?.phaseWeekNumber,
    selectedWeek,
  ]);

  const handleOpenUpload = (phaseId: string, exerciseId: string) => {
    setUploadPhaseId(phaseId);
    setSelectedExerciseId(exerciseId);
    setVideoUrl("");
    setMovementUploadFile(null);
    setClientNote("");
    setIsUploadOpen(true);
  };

  const handleSubmitVideo = async () => {
    if (!uploadPhaseId || !selectedExerciseId) return;
    const phase = allPhases.find((p: any) => p.id === uploadPhaseId);
    if (!phase) return;
    const normalizedVideoUrl = videoUrl.trim();
    const hasUploadFile = Boolean(movementUploadFile);
    if (!hasUploadFile && !normalizedVideoUrl) {
      toast({
        title: "Add video",
        description: "Upload a video file or paste a valid link.",
        variant: "destructive",
      });
      return;
    }
    if (movementUploadFile) {
      if (!ALLOWED_CLIENT_VIDEO_TYPES.has(movementUploadFile.type)) {
        toast({
          title: "Invalid file type",
          description: "Use mp4, mov, webm, mkv, or 3gp.",
          variant: "destructive",
        });
        return;
      }
      if (movementUploadFile.size > MAX_CLIENT_VIDEO_BYTES) {
        toast({
          title: "Video is too large",
          description: "Maximum file size is 250MB.",
          variant: "destructive",
        });
        return;
      }
    } else {
      try {
        const parsed = new URL(normalizedVideoUrl);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          throw new Error("invalid protocol");
        }
      } catch {
        toast({
          title: "Invalid video link",
          description: "Please provide a valid http(s) video URL.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setIsSubmitting(true);
    try {
      let uploadPayload: {
        source: "link" | "upload";
        videoUrl: string | null;
        objectKey: string | null;
        mimeType: string | null;
        originalFilename: string | null;
      } = {
        source: "link",
        videoUrl: normalizedVideoUrl || null,
        objectKey: null,
        mimeType: null,
        originalFilename: null,
      };

      if (movementUploadFile) {
        const uploadTarget = await createClientVideoUploadTarget.mutateAsync({
          purpose: "movement_check",
          fileName: movementUploadFile.name,
          fileSize: movementUploadFile.size,
          contentType: movementUploadFile.type,
        });
        await uploadClientVideoToObjectStorage({
          uploadUrl: uploadTarget.uploadUrl,
          file: movementUploadFile,
        });
        uploadPayload = {
          source: "upload",
          videoUrl: null,
          objectKey: uploadTarget.objectKey,
          mimeType: movementUploadFile.type || null,
          originalFilename: movementUploadFile.name || null,
        };
      }

      const updatedChecks = (phase.movementChecks as any[]).map((mc: any) => {
        if (mc.exerciseId !== selectedExerciseId) return mc;
        return { 
          ...mc, 
          status: 'Pending', 
          videoUrl: uploadPayload.videoUrl,
          videoSource: uploadPayload.source,
          videoObjectKey: uploadPayload.objectKey,
          videoMimeType: uploadPayload.mimeType,
          videoOriginalFilename: uploadPayload.originalFilename,
          submittedAt: new Date().toISOString(),
          clientNote: clientNote.trim(),
        };
      });

      await updatePhase.mutateAsync({
        id: uploadPhaseId,
        movementChecks: updatedChecks,
      });

      toast({
        title: "Submission received",
        description: "Your coach will review your movement shortly.",
      });
      setIsUploadOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not submit your video link.";
      toast({
        title: "Submission Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitWeeklyCheckin = async () => {
    if (isCheckinReadOnly) {
      toast({
        title: "Read-only client context",
        description:
          "Weekly check-ins can be submitted only in a real client session for this client.",
        variant: "destructive",
      });
      return;
    }
    if (weeklyInjuryAffected && weeklyInjuryImpact === null) {
      toast({
        title: "Select injury impact",
        description: "Choose how much pain/injury affected training before submitting.",
        variant: "destructive",
      });
      return;
    }
    if (submittingWeeklyCheckin) return;
    setSubmittingWeeklyCheckin(true);
    try {
      await createWeeklyCheckin.mutateAsync({
        recoveryThisTrainingWeek: weeklySleep,
        stressOutsideTrainingThisWeek: weeklyEnergy,
        injuryAffectedTraining: weeklyInjuryAffected,
        injuryImpact: weeklyInjuryAffected ? weeklyInjuryImpact : null,
        optionalNote: weeklyNote.trim() || null,
        phaseId: currentPhase.id,
        phaseWeekNumber: weeklyCheckinWeek,
      });
      toast({
        title: "Weekly check-in submitted",
        description: "Thanks, your coach can now review your weekly trends.",
      });
      setWeeklyCheckinOpen(false);
    } catch (error: any) {
      toast({
        title: "Could not submit weekly check-in",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingWeeklyCheckin(false);
    }
  };

  if (loadingPhases) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-600)]" />
      </div>
    );
  }

  if (visiblePhases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <CalIcon className="h-10 w-10 text-slate-300" />
        </div>
        <h2 className="text-2xl font-display font-bold text-slate-900" data-testid="text-no-phase">No Active Plan</h2>
        <p className="text-slate-500 mt-2 max-w-md">You don't have an active training plan right now. Your coach is likely building your next block.</p>
      </div>
    );
  }

  if (!currentPhase) return null;

  const isMovementCheckPhase = currentPhase.status === 'Waiting for Movement Check';
  const movementChecks = (currentPhase.movementChecks as any[]) || [];
  const phaseSessions = allSessions.filter((s: any) => s.phaseId === currentPhase.id) as any[];
  const movementCheckExerciseById = new Map<string, any>();
  for (const session of phaseSessions) {
    const sections = (session.sections as any[]) || [];
    for (const section of sections) {
      const exercises = (section?.exercises as any[]) || [];
      for (const exercise of exercises) {
        if (exercise?.id) {
          movementCheckExerciseById.set(exercise.id, exercise);
        }
      }
    }
  }
  const schedule = ((currentPhase.schedule as any[]) || []) as TrainingScheduleEntry[];
  const weekSchedule = schedule.filter((s: any) => s.week === selectedWeek);
  const completedInstances: string[] = (currentPhase.completedScheduleInstances as string[]) || [];
  const weekLifecycle = getTrainingWeekLifecycle(
    currentPhase.durationWeeks || 1,
    schedule,
    completedInstances,
    currentPhase.id,
    (weeklyCheckins as Array<{ phaseId?: string | null; phaseWeekNumber?: number | null }>) || [],
  );
  const weekStatuses = weekLifecycle.weeks;
  const selectedWeekStatus =
    weekStatuses.find((status) => status.week === selectedWeek) ||
    ({
      week: selectedWeek,
      scheduledCount: 0,
      completedCount: 0,
      isCompleted: false,
      hasWeeklyCheckin: false,
      state: "future",
    } as const);
  const weeklyCheckinStatusForPhase =
    weeklyCheckinStatus && weeklyCheckinStatus.phaseId === currentPhase.id
      ? weeklyCheckinStatus
      : null;
  const weeklyCheckinStatusWeek =
    typeof weeklyCheckinStatusForPhase?.phaseWeekNumber === "number" &&
    Number.isFinite(weeklyCheckinStatusForPhase.phaseWeekNumber)
      ? weeklyCheckinStatusForPhase.phaseWeekNumber
      : null;
  const dueWeekStatus =
    weekStatuses.find((status) => status.state === "ready_for_checkin") || null;
  const currentTrainingWeek =
    dueWeekStatus?.week ?? weeklyCheckinStatusWeek ?? weekLifecycle.currentWeek;
  const currentWeekStatus = weekStatuses.find((status) => status.week === currentTrainingWeek);
  const weeklyCheckinWeek =
    dueWeekStatus?.week ?? weeklyCheckinStatusWeek ?? currentTrainingWeek;
  const weeklyCheckinDue =
    Boolean(dueWeekStatus) ||
    Boolean(weeklyCheckinStatusForPhase?.due) ||
    currentWeekStatus?.state === "ready_for_checkin";

  useEffect(() => {
    if (weeklyCheckinQueryHandledRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("weeklyCheckin") !== "1") return;

    weeklyCheckinQueryHandledRef.current = true;
    if (!isMovementCheckPhase && !isCheckinReadOnly && weeklyCheckinDue) {
      setWeeklyCheckinStep(1);
      setWeeklySleep(3);
      setWeeklyEnergy(3);
      setWeeklyInjuryAffected(false);
      setWeeklyInjuryImpact(null);
      setWeeklyNote("");
      setWeeklyCheckinOpen(true);
    }

    params.delete("weeklyCheckin");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [isCheckinReadOnly, isMovementCheckPhase, weeklyCheckinDue]);

  const isEntryCompleted = (entry: any, session: any) => {
    return isScheduleEntryCompleted(
      completedInstances,
      selectedWeek,
      entry.day,
      entry.slot || "AM",
      session.id,
    );
  };

  const buildSessionUrl = (sessionId: string, day: string, slotVal: string) => {
    return resolveClientSessionEntryDestination({
      phase: currentPhase as any,
      sessionId,
      week: selectedWeek,
      day,
      slot: slotVal || "AM",
    }).href;
  };

  const formatSessionDuration = (session: any) => {
    const minutes =
      typeof session?.durationMinutes === "number" &&
      Number.isFinite(session.durationMinutes) &&
      session.durationMinutes > 0
        ? Math.floor(session.durationMinutes)
        : null;
    return minutes ? `${minutes} min` : null;
  };

  const sessionsById = new Map(phaseSessions.map((session: any) => [session.id, session]));
  const scheduleRows = weekSchedule
    .map((entry: any, index: number) => {
      const sessionId = typeof entry?.sessionId === "string" ? entry.sessionId : "";
      const session = sessionsById.get(sessionId);
      if (!session) return null;
      const day = typeof entry?.day === "string" && entry.day.length > 0 ? entry.day : "Monday";
      const slot = entry?.slot === "PM" ? "PM" : "AM";
      const dayIndex = WEEKDAYS.indexOf(day);
      return {
        key: `${day}-${slot}-${session.id}-${index}`,
        day,
        dayIndex,
        dayNumber: dayIndex >= 0 ? dayIndex + 1 : null,
        slot,
        session,
        isCompleted: isEntryCompleted({ day, slot }, session),
        href: buildSessionUrl(session.id, day, slot),
      };
    })
    .filter(
      (
        item,
      ): item is {
        key: string;
        day: string;
        dayIndex: number;
        dayNumber: number | null;
        slot: "AM" | "PM";
        session: any;
        isCompleted: boolean;
        href: string;
      } => Boolean(item),
    )
    .sort((a, b) => {
      const leftDay = a.dayIndex >= 0 ? a.dayIndex : Number.MAX_SAFE_INTEGER;
      const rightDay = b.dayIndex >= 0 ? b.dayIndex : Number.MAX_SAFE_INTEGER;
      if (leftDay !== rightDay) return leftDay - rightDay;
      if (a.slot !== b.slot) return a.slot === "AM" ? -1 : 1;
      return a.session.name.localeCompare(b.session.name);
    });
  const groupedSchedule = scheduleRows.reduce<
    Array<{
      day: string;
      dayIndex: number;
      dayNumber: number | null;
      entries: typeof scheduleRows;
    }>
  >((groups, item) => {
    const existing = groups.find((group) => group.day === item.day);
    if (existing) {
      existing.entries.push(item);
      return groups;
    }
    groups.push({
      day: item.day,
      dayIndex: item.dayIndex,
      dayNumber: item.dayNumber,
      entries: [item],
    });
    return groups;
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-5 md:space-y-6 animate-in fade-in">
      {isCheckinReadOnly && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm rounded-xl" data-testid="card-impersonation-read-only">
          <CardContent className="p-4 text-sm text-amber-800">
            Client check-ins are read-only unless you are logged in as this client account.
          </CardContent>
        </Card>
      )}
      {visiblePhases.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-semibold text-slate-500 uppercase tracking-wider shrink-0">Plans</Label>
          <Select value={selectedPhaseId || ''} onValueChange={(val) => { setSelectedPhaseId(val); setSelectedWeek(1); }}>
            <SelectTrigger className="w-full max-w-xs bg-white border-slate-200 shadow-sm" data-testid="select-phase">
              <SelectValue placeholder="Select a plan" />
            </SelectTrigger>
            <SelectContent>
              {visiblePhases.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2 w-full">
                    <span>{p.name}</span>
                    {p.status === 'Active' && <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Active</Badge>}
                    {p.status === 'Waiting for Movement Check' && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Pending</Badge>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isMovementCheckPhase ? (
        <div id="movement-checks" className="animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-3 mt-1">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 tracking-tight" data-testid="text-movement-check-title">
              Movement check
            </h1>
            <p className="mt-2 text-[15px] leading-6 text-slate-600">
              To unlock your new phase, complete the movement check. Watch the reference video closely and match the movement quality, tempo, and execution. Trim the video so the whole person is visible and walking in or out of frame is not included.
            </p>
          </div>

          <div className="space-y-4">
            {movementChecks.map((mc: any, i: number) => (
              <Card
                key={i}
                className={`border-2 shadow-sm rounded-xl overflow-hidden transition-colors ${
                  isUploadOpen &&
                  selectedExerciseId === mc.exerciseId &&
                  movementDraftReady &&
                  mc.status !== "Approved" &&
                  mc.status !== "Pending"
                    ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)]/20"
                    : "border-slate-200 bg-white"
                }`}
                data-testid={`card-movement-check-${i}`}
              >
                <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex-1">
                    {(() => {
                      const exercise = movementCheckExerciseById.get(mc.exerciseId);
                      return (
                        <>
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className={
                        mc.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                        mc.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        mc.status === 'Needs Resubmission' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }>
                        {mc.status || 'Not Submitted'}
                      </Badge>
                      {isUploadOpen &&
                      selectedExerciseId === mc.exerciseId &&
                      movementDraftReady &&
                      mc.status !== "Approved" &&
                      mc.status !== "Pending" ? (
                        <Badge
                          variant="outline"
                          className="bg-[var(--color-brand-100)] text-[var(--color-brand-700)] border-[var(--color-brand-400)]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Ready
                        </Badge>
                      ) : null}
                    </div>
                    <ExerciseStandardDetails exercise={{ ...exercise, name: exercise?.name || mc.name }} />
                    {mc.approvedNote && mc.status === 'Approved' && (
                      <div className="mt-3 bg-green-50 border border-green-100 p-4 rounded-xl">
                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Coach's Note</p>
                        <p className="text-slate-700">"{mc.approvedNote}"</p>
                      </div>
                    )}
                    {mc.resubmitFeedback && mc.status === 'Needs Resubmission' && (
                      <div className="mt-3 bg-red-50 border border-red-100 p-4 rounded-xl">
                        <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1">Coach Feedback</p>
                        <p className="text-slate-700 italic">"{mc.resubmitFeedback}"</p>
                      </div>
                    )}
                    {mc.clientNote && mc.status === 'Pending' && (
                      <p className="text-sm text-slate-500 mt-2 italic">Note: {mc.clientNote}</p>
                    )}
                        </>
                      );
                    })()}
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
                        className="w-full md:w-auto"
                        onClick={() => handleOpenUpload(currentPhase.id, mc.exerciseId)}
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
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm" data-testid="card-phase-hero">
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-slate-900 leading-tight" data-testid="text-phase-name">
              {currentPhase.name}
            </h1>
            {currentPhase.goal ? (
              <p className="text-sm md:text-base text-slate-600 mt-1.5 max-w-2xl leading-relaxed whitespace-pre-line break-words">
                {currentPhase.goal}
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              {currentPhase.durationWeeks > 1 && (
                <div className="self-start md:self-auto inline-flex flex-wrap rounded-lg border border-slate-200 bg-[var(--color-ui-surface)] p-1 gap-1.5">
                  {Array.from({ length: currentPhase.durationWeeks }, (_, i) => i + 1).map((w) => {
                    const weekStatus =
                      weekStatuses.find((status) => status.week === w) ||
                      ({ isCompleted: false, state: "future" } as const);
                    const isSelected = selectedWeek === w;
                    const isCurrent = w === currentTrainingWeek;
                    return (
                    <button
                      key={w}
                      onClick={() => setSelectedWeek(w)}
                      className={`min-h-8 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
                        isSelected
                          ? "bg-[var(--color-brand-600)] text-white shadow-sm"
                          : weekStatus.state === "ready_for_checkin"
                            ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                            : weekStatus.state === "completed"
                              ? "bg-slate-200 text-slate-600 hover:bg-slate-300"
                              : isCurrent
                                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                      }`}
                      data-testid={`button-week-${w}`}
                    >
                      W{w}
                      {weekStatus.state === "ready_for_checkin" && (
                        <span className="text-[10px] font-bold">!</span>
                      )}
                      {isCurrent && !isSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-600)]" />
                      )}
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mb-4 px-3" data-testid="text-week-progress">
              {selectedWeekStatus.scheduledCount > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs md:text-sm text-slate-600">
                    {selectedWeekStatus.completedCount}/{selectedWeekStatus.scheduledCount} sessions completed
                  </p>
                  {selectedWeekStatus.state !== "current" ? (
                    <p className="text-xs font-semibold text-slate-700">
                      {selectedWeekStatus.state === "completed"
                        ? "Completed"
                        : selectedWeekStatus.state === "ready_for_checkin"
                          ? "Ready for weekly check-in"
                          : "Future"}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No scheduled sessions</p>
              )}
            </div>

            {groupedSchedule.length === 0 ? (
              <p className="text-sm text-slate-500 px-3 py-2">No scheduled sessions</p>
            ) : (
              <div className="space-y-2" data-testid="card-schedule-grid">
                {groupedSchedule.map((group) => (
                  <div
                    key={group.day}
                    className="pb-2 border-b border-slate-100 last:border-b-0 last:pb-0"
                  >
                    <div className="px-3 py-1.5">
                      <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-800">
                        {group.dayNumber !== null ? `Day ${group.dayNumber}` : group.day}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {group.entries.map((item, index) => {
                        const durationLabel = formatSessionDuration(item.session);
                        const showSlot = group.entries.length > 1;
                        const metadataLabel = durationLabel
                          ? showSlot
                            ? `${durationLabel} · ${item.slot}`
                            : durationLabel
                          : showSlot
                            ? item.slot
                            : "";
                        return (
                          <Link
                            key={item.key}
                            href={item.href}
                            className="block"
                            data-testid={`sched-session-${group.day}-${item.slot}-${index}`}
                          >
                            <div
                              className={`rounded-lg border bg-white px-3 py-2.5 transition-colors ${
                                item.isCompleted
                                  ? "border-slate-200 bg-slate-100 text-slate-600"
                                  : "border-slate-200 bg-slate-50/40 hover:bg-[var(--color-ui-surface)]"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-sm font-semibold leading-tight truncate ${
                                      item.isCompleted ? "line-through" : "text-slate-900"
                                    }`}
                                  >
                                    {item.session.name}
                                  </p>
                                  {metadataLabel && !item.isCompleted ? (
                                    <p className="mt-1 text-xs text-slate-500">{metadataLabel}</p>
                                  ) : null}
                                </div>
                                {item.isCompleted ? (
                                  <span className="inline-flex shrink-0 items-center text-[var(--color-done-foreground)]">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </>
      )}

      <Dialog open={weeklyCheckinOpen} onOpenChange={setWeeklyCheckinOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Weekly check-in</DialogTitle>
            <DialogDescription>
              Step {weeklyCheckinStep}/2
            </DialogDescription>
          </DialogHeader>

          {weeklyCheckinStep === 1 ? (
            <div className="space-y-5 py-2">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Recovery this training week</p>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={`sleep-${value}`}
                      type="button"
                      onClick={() => setWeeklySleep(value)}
                      className={`rounded-xl border px-2 py-3 text-sm font-semibold ${
                        weeklySleep === value
                          ? "border-[var(--color-brand-500)] bg-[var(--color-brand-100)] text-[var(--color-brand-600)]"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">1 Very poor · 2 Poor · 3 OK · 4 Good · 5 Excellent</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Stress outside training this week</p>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={`energy-${value}`}
                      type="button"
                      onClick={() => setWeeklyEnergy(value)}
                      className={`rounded-xl border px-2 py-3 text-sm font-semibold ${
                        weeklyEnergy === value
                          ? "border-[var(--color-brand-500)] bg-[var(--color-brand-100)] text-[var(--color-brand-600)]"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">1 Very low · 2 Low · 3 Moderate · 4 High · 5 Very high</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Did pain or injury affect training this week?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWeeklyInjuryAffected(false)}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                      !weeklyInjuryAffected
                        ? "border-[var(--color-brand-500)] bg-[var(--color-brand-100)] text-[var(--color-brand-600)]"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeeklyInjuryAffected(true)}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                      weeklyInjuryAffected
                        ? "border-[var(--color-brand-500)] bg-[var(--color-brand-100)] text-[var(--color-brand-600)]"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Yes
                  </button>
                </div>
              </div>

              {weeklyInjuryAffected && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">How much did it affect training?</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={`impact-${value}`}
                        type="button"
                        onClick={() => setWeeklyInjuryImpact(value)}
                        className={`rounded-xl border px-2 py-3 text-sm font-semibold ${
                          weeklyInjuryImpact === value
                            ? "border-[var(--color-brand-500)] bg-[var(--color-brand-100)] text-[var(--color-brand-600)]"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    1 Very low impact · 2 Low impact · 3 Moderate impact · 4 High impact · 5 Very high impact
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="weekly-note">Optional note</Label>
                <Textarea
                  id="weekly-note"
                  value={weeklyNote}
                  onChange={(event) => setWeeklyNote(event.target.value)}
                  placeholder="Anything to add?"
                  className="min-h-[90px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {weeklyCheckinStep === 2 && (
              <Button variant="outline" onClick={() => setWeeklyCheckinStep(1)} disabled={submittingWeeklyCheckin}>
                Back
              </Button>
            )}
            {weeklyCheckinStep === 1 ? (
              <Button onClick={() => setWeeklyCheckinStep(2)} disabled={isCheckinReadOnly}>Continue</Button>
            ) : (
              <Button
                onClick={handleSubmitWeeklyCheckin}
                disabled={
                  submittingWeeklyCheckin ||
                  isCheckinReadOnly ||
                  (weeklyInjuryAffected && weeklyInjuryImpact === null)
                }
              >
                {submittingWeeklyCheckin ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Submit weekly check-in
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Submit Movement Check Video</DialogTitle>
            <DialogDescription>
              Upload your video directly. If upload does not work, you can paste a link as fallback.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {movementDraftReady ? (
              <div className="rounded-lg border border-[var(--color-brand-400)] bg-[var(--color-brand-100)] px-3 py-2 text-sm text-[var(--color-brand-700)] font-medium">
                <CheckCircle2 className="h-4 w-4 inline mr-1.5 align-text-bottom" />
                Ready to submit
              </div>
            ) : null}
            <VideoUploadField
              fileInputId="video-file"
              linkInputId="video-url"
              file={movementUploadFile}
              linkValue={videoUrl}
              onFileChange={(nextFile) => setMovementUploadFile(nextFile)}
              onLinkChange={(nextValue) => setVideoUrl(nextValue)}
              disabled={isSubmitting}
              fileTestId="input-video-file"
              linkTestId="input-video-url"
            />
            <div className="grid gap-2">
              <Label htmlFor="note">Optional Note</Label>
              <Textarea 
                id="note" 
                placeholder="Anything we should know?" 
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
              disabled={isSubmitting}
              data-testid="button-submit-video"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
              {isSubmitting ? "Submitting..." : "Submit for Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
