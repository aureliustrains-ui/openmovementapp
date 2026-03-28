import { useQuery } from "@tanstack/react-query";
import {
  phasesQuery,
  sessionsQuery,
  useUpdatePhase,
  weeklyCheckinsMeQuery,
  weeklyCheckinsCurrentOrDueQuery,
  useCreateWeeklyCheckin,
  myActivePhaseProgressReportsQuery,
  useCreateClientVideoUploadTarget,
  uploadClientVideoToObjectStorage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, Lock, Calendar as CalIcon, UploadCloud, Loader2, CalendarDays, ChevronDown } from "lucide-react";
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
import { getWeekSchedulePreview, isScheduleEntryCompleted } from "@/lib/clientSchedule";
import { resolveClientSessionEntryDestination } from "@/lib/sessionEntry";
import { getSessionAccentColor } from "@/lib/sessionAccent";
import { ExerciseStandardDetails } from "@/components/client/ExerciseStandardDetails";
import { ActionRequiredCard } from "@/components/client/ActionRequiredCard";
import { VideoUploadField } from "@/components/client/VideoUploadField";
import { buildActionRequiredItems, pickLatestProgressReportForPhase } from "@/lib/actionRequired";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const ALLOWED_CLIENT_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/3gpp",
]);
const MAX_CLIENT_VIDEO_BYTES = 250 * 1024 * 1024;

function getProgressReportStatusMeta(status: string): {
  label: string;
  tone: "info" | "success" | "neutral" | "warning";
  ctaLabel: string;
  description: string;
} {
  if (status === "resubmission_requested") {
    return {
      label: "Resubmission requested",
      tone: "warning",
      ctaLabel: "Update progress report",
      description: "Coach requested an updated submission. Please resubmit with improvements.",
    };
  }
  if (status === "submitted") {
    return {
      label: "Submitted",
      tone: "success",
      ctaLabel: "View progress report",
      description: "Your submission is in. Keep training while your coach reviews it.",
    };
  }
  if (status === "approved") {
    return {
      label: "Approved",
      tone: "success",
      ctaLabel: "View progress report",
      description: "Coach approved this progress report for your active phase.",
    };
  }
  if (status === "reviewed") {
    return {
      label: "Reviewed",
      tone: "neutral",
      ctaLabel: "View progress report",
      description: "Coach review is completed for this phase report.",
    };
  }
  return {
    label: "Requested",
    tone: "info",
    ctaLabel: "Open progress report",
    description: "Submit quick links for selected exercises while continuing normal training.",
  };
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
  const { data: activePhaseProgressReports = [] } = useQuery({
    ...myActivePhaseProgressReportsQuery,
    enabled: !!sessionUser && !impersonating && sessionUser.role === "Client",
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

  const openWeeklyCheckin = () => {
    if (isCheckinReadOnly) {
      toast({
        title: "Read-only client context",
        description:
          "Weekly check-ins can be submitted only in a real client session for this client.",
        variant: "destructive",
      });
      return;
    }
    setWeeklyCheckinStep(1);
    setWeeklySleep(3);
    setWeeklyEnergy(3);
    setWeeklyInjuryAffected(false);
    setWeeklyInjuryImpact(null);
    setWeeklyNote("");
    setWeeklyCheckinOpen(true);
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
        <h2 className="text-2xl font-display font-bold text-slate-900" data-testid="text-no-phase">No Active Phases</h2>
        <p className="text-slate-500 mt-2 max-w-md">You don't have any active training phases right now. Your coach is likely building your next block.</p>
      </div>
    );
  }

  if (!currentPhase) return null;

  const isMovementCheckPhase = currentPhase.status === 'Waiting for Movement Check';
  const movementChecks = (currentPhase.movementChecks as any[]) || [];
  const phaseSessions = allSessions.filter((s: any) => s.phaseId === currentPhase.id);
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
  const hasGridSchedule = schedule.some((s: any) => s.slot);
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
  const latestPhaseProgressReport = currentPhase
    ? pickLatestProgressReportForPhase(
        activePhaseProgressReports as Array<{
          id: string;
          phaseId: string;
          status: "requested" | "submitted" | "approved" | "resubmission_requested" | "reviewed";
          createdAt: string;
        }>,
        currentPhase.id,
      )
    : null;
  const progressStatusMeta = latestPhaseProgressReport
    ? getProgressReportStatusMeta(latestPhaseProgressReport.status)
    : null;
  const progressNeedsAction =
    latestPhaseProgressReport &&
    (latestPhaseProgressReport.status === "requested" ||
      latestPhaseProgressReport.status === "resubmission_requested");
  const progressSecondaryStatus =
    latestPhaseProgressReport && !progressNeedsAction ? latestPhaseProgressReport.status : null;
  const actionRequiredItems = buildActionRequiredItems({
    weeklyDue: weeklyCheckinDue,
    weeklyWeekNumber: weeklyCheckinWeek,
    progressReport: progressNeedsAction ? latestPhaseProgressReport : null,
  });
  const hasActionRequiredSection = actionRequiredItems.length > 0;

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

  const { nextScheduleItem } = getWeekSchedulePreview(
    selectedWeek,
    schedule,
    phaseSessions as Array<{ id: string; name: string }>,
    completedInstances,
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5 md:space-y-6 animate-in fade-in">
      {isCheckinReadOnly && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm rounded-2xl" data-testid="card-impersonation-read-only">
          <CardContent className="p-4 text-sm text-amber-800">
            Client check-ins are read-only unless you are logged in as this client account.
          </CardContent>
        </Card>
      )}
      {visiblePhases.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-semibold text-slate-500 uppercase tracking-wider shrink-0">My Phases</Label>
          <Select value={selectedPhaseId || ''} onValueChange={(val) => { setSelectedPhaseId(val); setSelectedWeek(1); }}>
            <SelectTrigger className="w-full max-w-xs bg-white border-slate-200 shadow-sm" data-testid="select-phase">
              <SelectValue placeholder="Select a phase" />
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
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center mb-10 mt-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-6">
              <Lock className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight" data-testid="text-movement-check-title">Movement Check Required</h1>
            <p className="text-slate-600 mt-3 text-lg">Your coach needs to review your form before unlocking: <span className="font-semibold text-slate-900">{currentPhase.name}</span></p>
            {currentPhase.goal && <p className="text-slate-500 mt-2">{currentPhase.goal} &middot; {currentPhase.durationWeeks} weeks</p>}
          </div>

          <div className="space-y-4">
            {movementChecks.map((mc: any, i: number) => (
              <Card key={i} className="border-2 border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white" data-testid={`card-movement-check-${i}`}>
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
                        className="btn-primary-action w-full rounded-xl h-12 px-6"
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm" data-testid="card-phase-hero">
            <p className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Week {selectedWeek}/{currentPhase.durationWeeks}
            </p>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-slate-900 leading-tight" data-testid="text-phase-name">
              {currentPhase.name}
            </h1>
            {currentPhase.goal ? (
              <p className="text-sm md:text-base text-slate-600 mt-1.5 max-w-2xl leading-relaxed">{currentPhase.goal}</p>
            ) : null}
            {nextScheduleItem && (
              <div className="mt-4 border-t border-slate-100 pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3" data-testid="card-start-next-session">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{nextScheduleItem.session.name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Week {selectedWeek} · {nextScheduleItem.entry.day} {nextScheduleItem.entry.slot || "AM"}
                    {formatSessionDuration(nextScheduleItem.session)
                      ? ` · ${formatSessionDuration(nextScheduleItem.session)}`
                      : ""}
                  </p>
                </div>
                <Link href={buildSessionUrl(nextScheduleItem.session.id, nextScheduleItem.entry.day, nextScheduleItem.entry.slot || "AM")}>
                  <Button className="btn-primary-action rounded-xl w-full md:w-auto h-10 shadow-sm" data-testid="button-start-next-session">
                    Start next session <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {hasActionRequiredSection && (
            <section className="space-y-2.5" data-testid="section-action-required">
              <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900">Action Required</h2>
              <div className="space-y-3">
                {weeklyCheckinDue && (
                  <ActionRequiredCard
                    title={`Week ${weeklyCheckinWeek} closing check`}
                    ctaLabel="Complete check"
                    onCtaClick={openWeeklyCheckin}
                    ctaDisabled={isCheckinReadOnly}
                    testId="card-action-weekly-checkin"
                  />
                )}
                {progressNeedsAction && latestPhaseProgressReport && progressStatusMeta && (
                  <ActionRequiredCard
                    title="Progress report"
                    ctaLabel="Submit update"
                    ctaHref={`/app/client/progress-reports/${latestPhaseProgressReport.id}`}
                    testId="card-action-progress-report"
                  />
                )}
              </div>
            </section>
          )}

          <div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-slate-700" />
                Week
              </h2>
              {currentPhase.durationWeeks > 1 && (
                <div className="self-start md:self-auto inline-flex flex-wrap rounded-lg border border-slate-200 bg-[var(--color-ui-surface)] p-1 gap-1">
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
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                        isSelected
                          ? "bg-slate-700 text-white shadow-sm"
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
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                      )}
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mb-4" data-testid="text-week-progress">
              {selectedWeekStatus.scheduledCount > 0 ? (
                <p className="text-xs md:text-sm text-slate-600">
                  Week {selectedWeek}: {selectedWeekStatus.completedCount}/{selectedWeekStatus.scheduledCount} sessions completed{" "}
                  {selectedWeekStatus.state === "completed" ? (
                    <span className="font-semibold text-slate-700">· Completed</span>
                  ) : selectedWeekStatus.state === "ready_for_checkin" ? (
                    <span className="font-semibold text-slate-700">· Ready for weekly check-in</span>
                  ) : selectedWeekStatus.state === "future" ? (
                    <span className="text-slate-500 font-semibold">· Future week</span>
                  ) : (
                    <span className="font-semibold text-slate-700">· Current</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-slate-500">Week {selectedWeek}: No scheduled sessions</p>
              )}
            </div>

            {hasGridSchedule ? (
              <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden" data-testid="card-schedule-grid">
                <div>
                  <div className="grid grid-cols-[72px_1fr_1fr] border-b border-slate-200 bg-slate-50">
                    <div className="px-2 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200">Day</div>
                    <div className="px-2 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center border-r border-slate-200">AM</div>
                    <div className="px-2 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">PM</div>
                  </div>
                  {WEEKDAYS.map((day, dayIdx) => {
                    const amEntries = weekSchedule.filter((e: any) => e.day === day && (e.slot || "AM") === "AM");
                    const pmEntries = weekSchedule.filter((e: any) => e.day === day && e.slot === "PM");
                    const hasEntries = amEntries.length > 0 || pmEntries.length > 0;

                    return (
                      <div key={day} className={`grid grid-cols-[72px_1fr_1fr] border-b border-slate-100 last:border-b-0 ${hasEntries ? '' : 'opacity-50'} ${dayIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <div className="px-2 py-2 text-xs font-medium text-slate-600 border-r border-slate-100 flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-mono w-3">{dayIdx + 1}</span>
                          {day.slice(0, 3)}
                        </div>
                        {["AM", "PM"].map(slotVal => {
                          const entries = slotVal === "AM" ? amEntries : pmEntries;
                          return (
                            <div key={slotVal} className="px-1.5 py-1.5 border-r last:border-r-0 border-slate-100 min-h-[42px] flex flex-col items-stretch gap-1">
                              {entries.map((entry: any, i: number) => {
                                const session = phaseSessions.find((s: any) => s.id === entry.sessionId);
                                if (!session) return null;
                                const completed = isEntryCompleted(entry, session);
                                const accentColor = getSessionAccentColor({
                                  id: session.id,
                                  name: session.name,
                                });
                                return (
                                  <Link key={i} href={buildSessionUrl(session.id, day, slotVal)} className="block">
                                    <Badge
                                      variant="outline"
                                      className={`cursor-pointer transition-colors text-[11px] font-medium w-full justify-start ${
                                        completed
                                          ? "border-[var(--color-done-border)] bg-[var(--color-done-background)] text-[var(--color-done-foreground)] opacity-85"
                                          : "border-slate-200 bg-white text-slate-800 hover:bg-[var(--color-ui-surface)]"
                                      }`}
                                      style={{ borderLeftWidth: "3px", borderLeftColor: accentColor }}
                                      data-testid={`sched-session-${day}-${slotVal}-${i}`}
                                    >
                                      {completed ? <CheckCircle2 className="h-3 w-3 mr-1.5" /> : null}
                                      <span className="h-1.5 w-1.5 rounded-full mr-1" style={{ backgroundColor: accentColor }} />
                                      <span className={`truncate max-w-[110px] md:max-w-none ${completed ? "line-through" : ""}`}>{session.name}</span>
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
                    const accentColor = getSessionAccentColor({
                      id: session.id,
                      name: session.name,
                    });
                    
                    return (
                      <Link key={key} href={buildSessionUrl(session.id, day, slotVal)}>
                        <Card className="border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group bg-white rounded-2xl overflow-hidden h-full" data-testid={`card-session-${key}`}>
                          <CardContent className="p-0 h-full">
                            <div
                              className={`flex items-stretch h-full ${isCompleted ? "opacity-85" : ""}`}
                              style={{ borderLeft: `4px solid ${accentColor}` }}
                            >
                              <div className="p-6 flex-1 flex justify-between items-center">
                                <div>
                                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{day}</div>
                                  <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                                    <h3 className={`text-xl font-bold ${isCompleted ? "text-slate-500 line-through" : "text-slate-900 group-hover:text-slate-700 transition-colors"}`}>{session?.name}</h3>
                                  </div>
                                  <p className="text-sm text-slate-500 mt-1">
                                    {(session?.sections as any[])?.length} Blocks
                                    {formatSessionDuration(session)
                                      ? ` · ${formatSessionDuration(session)}`
                                      : ""}
                                  </p>
                                </div>
                                <div className="shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-slate-50 group-hover:bg-[var(--color-ui-surface)] group-hover:shadow-inner transition-all ml-4 border border-slate-200">
                                   {isCompleted ? <CheckCircle2 className="h-6 w-6 text-[var(--color-done-foreground)]" /> : <ChevronRight className="h-6 w-6 text-[var(--color-brand-600)] group-hover:translate-x-0.5 transition-transform" />}
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

            {latestPhaseProgressReport && progressStatusMeta && progressSecondaryStatus && (
              <Card
                className={`mt-6 rounded-2xl shadow-sm ${
                  progressSecondaryStatus === "approved" || progressSecondaryStatus === "reviewed"
                    ? "border-[var(--color-done-border)] bg-[var(--color-done-background)]"
                    : "border-slate-200 bg-white"
                }`}
                data-testid="card-phase-progress-report-context"
              >
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Progress Report</p>
                      <Badge
                        variant="outline"
                        className={
                          progressSecondaryStatus === "approved" || progressSecondaryStatus === "reviewed"
                            ? "bg-white text-[var(--color-done-foreground)] border-[var(--color-done-border)]"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }
                      >
                        {progressStatusMeta.label}
                      </Badge>
                    </div>
                    <p className="text-slate-700">{progressStatusMeta.description}</p>
                  </div>
                  <Link href={`/app/client/progress-reports/${latestPhaseProgressReport.id}`}>
                    <Button className="btn-primary-action rounded-xl">
                      View progress report
                    </Button>
                  </Link>
                </CardContent>
              </Card>
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
              <Button className="btn-primary-action" onClick={() => setWeeklyCheckinStep(2)} disabled={isCheckinReadOnly}>Continue</Button>
            ) : (
              <Button
                className="btn-primary-action"
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
              className="btn-primary-action"
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
