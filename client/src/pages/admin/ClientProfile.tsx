import { useState, useRef, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  usersQuery,
  phasesQuery,
  sessionsQuery,
  workoutLogsQuery,
  clientSpecificsQuery,
  useUpdateClientSpecifics,
  useUpdatePhase,
  useDeletePhase,
  messagesQuery,
  useSendMessage,
  useMarkChatRead,
  clientCheckinsTrendsQuery,
  clientCheckinsRecentQuery,
  useUpdateUserStatus,
  useRemoveClient,
  clientMovementChecksGroupedQuery,
  clientProgressReportsGroupedQuery,
  adminClientNotificationSummaryQuery,
  useCreateClientProgressReport,
  useReviewProgressReportItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dumbbell,
  Plus,
  MessageCircle,
  CheckCircle2,
  ChevronLeft,
  ArrowRight,
  BarChart,
  Repeat,
  Loader2,
  XCircle,
  Send,
  Pencil,
  CalendarDays,
  Trash2,
  Archive,
  Zap,
  Save,
  UserCheck,
  UserX,
  ClipboardList,
  Activity,
  ShieldCheck,
  MoreHorizontal,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReviewSubmissionRow } from "@/components/admin/review/ReviewSubmissionRow";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";
import { getChatDisplayFirstName } from "@/lib/chatDisplayName";
import { resolveUserFullName } from "@/lib/userDisplayName";
import { mapSessionCheckinTrendData, mapWeeklyCheckinTrendData } from "@/lib/checkins";
import { buildReadinessSummaryCards } from "@/lib/readinessSummary";
import { normalizeVideoSource } from "@/lib/video";
import {
  CartesianGrid,
  Legend,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CHECKIN_COLORS = {
  sessionRpe: "#eab308",
  sleepLastNight: "#2563eb",
  feltOff: "#dc2626",
  recovery: "#16a34a",
  stress: "#d97706",
  painInjury: "#dc2626",
} as const;

function isPhaseReadyToActivate(phase: any): boolean {
  const checks = (phase.movementChecks as any[]) || [];
  if (checks.length === 0) return true;
  return checks.every((mc: any) => mc.status === "Approved");
}

function getPhaseDisplayStatus(phase: any): string {
  if (phase.status === "Waiting for Movement Check" && isPhaseReadyToActivate(phase)) {
    return "Ready to Activate";
  }
  return phase.status;
}

function getStatusColor(displayStatus: string): string {
  if (displayStatus === "Active") return "bg-slate-900 text-white border-slate-900";
  if (displayStatus === "Ready to Activate") return "bg-white text-slate-900 border-slate-300";
  if (displayStatus === "Waiting for Movement Check")
    return "bg-slate-100 text-slate-700 border-slate-200";
  if (displayStatus === "Draft") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-slate-100 text-slate-500 border-slate-200";
}

export default function AdminClientProfile() {
  const [, params] = useRoute("/app/admin/clients/:id");
  const [, setLocation] = useLocation();
  const clientId = params?.id;
  const { toast } = useToast();

  const { data: allUsers = [] } = useQuery(usersQuery);
  const { data: allPhases = [] } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);
  const { sessionUser, impersonate } = useAuth();
  const updatePhase = useUpdatePhase();
  const deletePhase = useDeletePhase();
  const updateUserStatus = useUpdateUserStatus();
  const removeClient = useRemoveClient();
  const createClientProgressReport = useCreateClientProgressReport();
  const reviewProgressReportItem = useReviewProgressReportItem();

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("programming");
  const [chatMessage, setChatMessage] = useState("");
  const [chatProfilePreview, setChatProfilePreview] = useState<{
    name: string;
    avatar: string | null;
    bio: string | null;
    height: string | null;
    weight: string | null;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTargetPhase, setDeleteTargetPhase] = useState<any>(null);
  const [finishTargetPhase, setFinishTargetPhase] = useState<any>(null);
  const [finishing, setFinishing] = useState(false);
  const [activateTargetPhase, setActivateTargetPhase] = useState<any>(null);
  const [activating, setActivating] = useState(false);
  const [specificsDraft, setSpecificsDraft] = useState("");
  const [savingSpecifics, setSavingSpecifics] = useState(false);
  const [structuredLogsFilter, setStructuredLogsFilter] = useState("all");
  const [checkinsRange, setCheckinsRange] = useState("8w");
  const [sessionMetrics, setSessionMetrics] = useState({
    rpeOverall: true,
    sleepLastNight: true,
    feltOffEvents: true,
  });
  const [weeklyMetrics, setWeeklyMetrics] = useState({
    recoveryThisTrainingWeek: true,
    stressOutsideTrainingThisWeek: true,
  });
  const [createProgressReportOpen, setCreateProgressReportOpen] = useState(false);
  const [selectedProgressExerciseIds, setSelectedProgressExerciseIds] = useState<string[]>([]);
  const [isProgressApproveOpen, setIsProgressApproveOpen] = useState(false);
  const [isProgressResubmitOpen, setIsProgressResubmitOpen] = useState(false);
  const [selectedProgressReview, setSelectedProgressReview] = useState<{
    reportId: string;
    itemId: string;
  } | null>(null);
  const [progressApproveNote, setProgressApproveNote] = useState("");
  const [progressResubmitFeedback, setProgressResubmitFeedback] = useState("");
  const [submittingProgressReview, setSubmittingProgressReview] = useState(false);
  const [phaseHomeVideoDrafts, setPhaseHomeVideoDrafts] = useState<Record<string, string>>({});
  const [phaseGuideVideoDrafts, setPhaseGuideVideoDrafts] = useState<Record<string, string>>({});
  const [savingPhaseVideoId, setSavingPhaseVideoId] = useState<string | null>(null);
  const [expandedPhaseIds, setExpandedPhaseIds] = useState<Set<string>>(new Set());

  const { data: chatMessages = [], isLoading: isChatLoading } = useQuery({
    ...messagesQuery(clientId || ""),
    enabled: !!clientId,
    refetchInterval: 5000,
  });
  const sendMessage = useSendMessage();
  const markRead = useMarkChatRead();
  const updateClientSpecifics = useUpdateClientSpecifics();
  const { data: workoutLogs = [] } = useQuery(workoutLogsQuery(clientId || ""));
  const { data: specificsData } = useQuery({
    ...clientSpecificsQuery(clientId || ""),
    enabled: !!clientId,
  });
  const { data: checkinsTrends } = useQuery({
    ...clientCheckinsTrendsQuery(clientId || "", checkinsRange),
    enabled: !!clientId && activeTab === "checkins",
  });
  const { data: checkinsRecent } = useQuery({
    ...clientCheckinsRecentQuery(clientId || ""),
    enabled: !!clientId && activeTab === "checkins",
  });
  const { data: movementCheckGroupsData = [] } = useQuery({
    ...(clientId
      ? clientMovementChecksGroupedQuery(clientId)
      : clientMovementChecksGroupedQuery("")),
    enabled: !!clientId && activeTab === "movement",
    refetchInterval: activeTab === "movement" ? 10000 : false,
  });
  const { data: progressReportGroupsData = [] } = useQuery({
    ...(clientId
      ? clientProgressReportsGroupedQuery(clientId)
      : clientProgressReportsGroupedQuery("")),
    enabled: !!clientId && activeTab === "progress-report",
  });
  const { data: notificationSummary } = useQuery({
    ...(clientId
      ? adminClientNotificationSummaryQuery(clientId)
      : adminClientNotificationSummaryQuery("")),
    enabled: !!clientId,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (typeof specificsData?.specifics === "string") {
      setSpecificsDraft(specificsData.specifics);
    }
  }, [specificsData?.specifics]);

  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  const latestClientChatMessageTime = useMemo(() => {
    const clientMessages = (chatMessages as any[]).filter((message: any) =>
      Boolean(message?.isClient),
    );
    if (clientMessages.length === 0) return null;
    return clientMessages.reduce((latest, message) => {
      const messageTime = typeof message?.time === "string" ? message.time : "";
      return messageTime > latest ? messageTime : latest;
    }, "");
  }, [chatMessages]);

  useEffect(() => {
    if (activeTab === "chat" && sessionUser && clientId) {
      markRead.mutate({ userId: sessionUser.id, clientId });
    }
  }, [activeTab, sessionUser?.id, clientId, latestClientChatMessageTime]);

  const client = allUsers.find((u: any) => u.id === clientId);
  const clientPhases = allPhases.filter((p: any) => p.clientId === clientId);
  const activePhases = clientPhases.filter((p: any) => p.status === "Active");
  const pendingPhases = clientPhases.filter((p: any) => p.status === "Waiting for Movement Check");
  const draftPhases = clientPhases.filter((p: any) => p.status === "Draft");
  const completedPhases = clientPhases.filter((p: any) => p.status === "Completed");
  const activePhaseForProgress = activePhases[0];
  const progressPhaseSessions = allSessions.filter(
    (session: any) => session.phaseId === activePhaseForProgress?.id,
  );
  const selectableProgressExercises = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; sets?: string; reps?: string; tempo?: string }
    >();
    progressPhaseSessions.forEach((session: any) => {
      const sections = (session.sections as any[]) || [];
      sections.forEach((section: any) => {
        const exercises = (section?.exercises as any[]) || [];
        exercises.forEach((exercise: any) => {
          if (exercise?.id && exercise?.name && !map.has(exercise.id)) {
            map.set(exercise.id, {
              id: String(exercise.id),
              name: String(exercise.name),
              sets: exercise.sets ? String(exercise.sets) : undefined,
              reps: exercise.reps ? String(exercise.reps) : undefined,
              tempo: exercise.tempo ? String(exercise.tempo) : undefined,
            });
          }
        });
      });
    });
    return Array.from(map.values());
  }, [progressPhaseSessions]);

  const clientDisplayName = client ? resolveUserFullName(client) : "";

  const submitChatMessage = () => {
    if (!chatMessage.trim() || !clientId) return;

    sendMessage.mutate({
      clientId: clientId,
      text: chatMessage,
    });
    setChatMessage("");
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    submitChatMessage();
  };

  const handleChatComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    submitChatMessage();
  };

  const openChatProfilePreview = (msg: any) => {
    const senderDisplayName = getChatDisplayFirstName(msg);
    setChatProfilePreview({
      name: senderDisplayName,
      avatar: msg?.senderProfile?.avatar ?? msg?.senderAvatar ?? null,
      bio: msg?.senderProfile?.bio ?? null,
      height: msg?.senderProfile?.height ?? null,
      weight: msg?.senderProfile?.weight ?? null,
    });
  };

  const getPhaseHomeVideoDraft = (phase: any): string => {
    if (Object.prototype.hasOwnProperty.call(phaseHomeVideoDrafts, phase.id)) {
      return phaseHomeVideoDrafts[phase.id] || "";
    }
    return typeof phase.homeIntroVideoUrl === "string" ? phase.homeIntroVideoUrl : "";
  };

  const setPhaseHomeVideoDraft = (phaseId: string, value: string) => {
    setPhaseHomeVideoDrafts((prev) => ({
      ...prev,
      [phaseId]: value,
    }));
  };

  const getPhaseGuideVideoDraft = (phase: any): string => {
    if (Object.prototype.hasOwnProperty.call(phaseGuideVideoDrafts, phase.id)) {
      return phaseGuideVideoDrafts[phase.id] || "";
    }
    return typeof phase.homeGuideVideoUrl === "string" ? phase.homeGuideVideoUrl : "";
  };

  const setPhaseGuideVideoDraft = (phaseId: string, value: string) => {
    setPhaseGuideVideoDrafts((prev) => ({
      ...prev,
      [phaseId]: value,
    }));
  };

  const savePhaseHomeVideo = async (phase: any, nextValue: string) => {
    const trimmed = nextValue.trim();
    if (trimmed && !normalizeVideoSource(trimmed)) {
      toast({
        title: "Invalid video URL",
        description: "Please add a valid YouTube, Drive, or direct video URL.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingPhaseVideoId(phase.id);
      await updatePhase.mutateAsync({
        id: phase.id,
        homeIntroVideoUrl: trimmed || null,
      });
      setPhaseHomeVideoDraft(phase.id, trimmed);
      toast({
        title: "Saved",
        description: trimmed ? "Client home video updated." : "Client home video removed.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Could not save the client home video.",
        variant: "destructive",
      });
    } finally {
      setSavingPhaseVideoId(null);
    }
  };

  const savePhaseGuideVideo = async (phase: any, nextValue: string) => {
    const trimmed = nextValue.trim();
    if (trimmed && !normalizeVideoSource(trimmed)) {
      toast({
        title: "Invalid video URL",
        description: "Please add a valid YouTube, Drive, or direct video URL.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingPhaseVideoId(phase.id);
      await updatePhase.mutateAsync({
        id: phase.id,
        homeGuideVideoUrl: trimmed || null,
      });
      setPhaseGuideVideoDraft(phase.id, trimmed);
      toast({
        title: "Saved",
        description: trimmed ? "Client guide video updated." : "Client guide video removed.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Could not save the client guide video.",
        variant: "destructive",
      });
    } finally {
      setSavingPhaseVideoId(null);
    }
  };

  const handleOpenApprove = (phaseId: string, exerciseId: string) => {
    setSelectedPhaseId(phaseId);
    setSelectedExerciseId(exerciseId);
    setApproveNote("");
    setIsApproveOpen(true);
  };

  const handleApproveMovementCheck = async () => {
    if (!selectedPhaseId || !selectedExerciseId) return;
    const phase = allPhases.find((p: any) => p.id === selectedPhaseId);
    if (!phase) return;

    setIsSubmitting(true);
    try {
      const updatedChecks = (phase.movementChecks as any[]).map((mc: any) => {
        if (mc.exerciseId !== selectedExerciseId) return mc;
        return {
          ...mc,
          status: "Approved",
          decision: "approved",
          approvedNote: approveNote || "",
          decidedAt: new Date().toISOString(),
        };
      });

      const allApproved = updatedChecks.every((mc: any) => mc.status === "Approved");

      await updatePhase.mutateAsync({
        id: selectedPhaseId,
        movementChecks: updatedChecks,
      });

      toast({
        title: "Check Approved",
        description: allApproved
          ? "All checks approved — phase is ready to activate!"
          : "Movement check approved.",
      });
      setIsApproveOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve movement check.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenReject = (phaseId: string, exerciseId: string) => {
    setSelectedPhaseId(phaseId);
    setSelectedExerciseId(exerciseId);
    setFeedback("");
    setIsRejectOpen(true);
  };

  const handleRejectMovementCheck = async () => {
    if (!selectedPhaseId || !selectedExerciseId) return;

    const phase = allPhases.find((p: any) => p.id === selectedPhaseId);
    if (!phase) return;

    setIsSubmitting(true);
    try {
      const updatedChecks = (phase.movementChecks as any[]).map((mc: any) => {
        if (mc.exerciseId !== selectedExerciseId) return mc;
        return {
          ...mc,
          status: "Needs Resubmission",
          decision: "resubmit",
          resubmitFeedback: feedback,
          decidedAt: new Date().toISOString(),
        };
      });

      await updatePhase.mutateAsync({
        id: selectedPhaseId,
        movementChecks: updatedChecks,
      });

      toast({
        title: "Feedback Sent",
        description: "Client has been notified to re-upload.",
      });
      setIsRejectOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send feedback.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivatePhase = async () => {
    if (activating || !activateTargetPhase) return;
    setActivating(true);
    try {
      for (const ap of activePhases) {
        await updatePhase.mutateAsync({
          id: ap.id,
          status: "Completed",
        });
      }

      await updatePhase.mutateAsync({
        id: activateTargetPhase.id,
        status: "Active",
      });

      const finishedNames = activePhases.map((p: any) => `"${p.name}"`).join(", ");
      toast({
        title: "Phase Activated",
        description:
          activePhases.length > 0
            ? `"${activateTargetPhase.name}" is now active. ${finishedNames} moved to completed.`
            : `"${activateTargetPhase.name}" is now active.`,
      });
      setActivateTargetPhase(null);
    } catch (err) {
      toast({ title: "Error", description: "Failed to activate phase.", variant: "destructive" });
    } finally {
      setActivating(false);
    }
  };

  const handleFinishPhase = async () => {
    if (finishing || !finishTargetPhase) return;
    setFinishing(true);
    try {
      await updatePhase.mutateAsync({
        id: finishTargetPhase.id,
        status: "Completed",
      });
      toast({
        title: "Phase Completed",
        description: `"${finishTargetPhase.name}" has been marked as completed.`,
      });
      setFinishTargetPhase(null);
    } catch (err) {
      toast({ title: "Error", description: "Failed to finish phase.", variant: "destructive" });
    } finally {
      setFinishing(false);
    }
  };

  const handleDeletePhase = async () => {
    if (deleting || !deleteTargetPhase) return;
    setDeleting(true);
    try {
      await deletePhase.mutateAsync(deleteTargetPhase.id);
      toast({
        title: "Phase Deleted",
        description: `"${deleteTargetPhase.name}" and all associated data removed.`,
      });
      setDeleteTargetPhase(null);
    } catch (err) {
      toast({
        title: "Delete Failed",
        description: "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSetClientStatus = async (status: "Active" | "Inactive") => {
    if (!clientId || updateUserStatus.isPending || removeClient.isPending) return;
    try {
      await updateUserStatus.mutateAsync({ id: clientId, status });
      toast({
        title: status === "Inactive" ? "Client set inactive" : "Client reactivated",
        description:
          status === "Inactive"
            ? "Client access is disabled and existing phases are archived."
            : "Client access is enabled again.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not update client status.";
      toast({
        title: "Status update failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveClient = async () => {
    if (!clientId || updateUserStatus.isPending || removeClient.isPending) return;
    const confirmed = window.confirm(
      `Remove ${clientDisplayName}? This permanently deletes their phases and removes account access.`,
    );
    if (!confirmed) return;

    try {
      await removeClient.mutateAsync(clientId);
      toast({
        title: "Client removed",
        description: "Client account was removed and phase history deleted.",
      });
      setLocation("/app/admin/clients");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not remove client.";
      toast({
        title: "Client removal failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleSaveSpecifics = async () => {
    if (!clientId || savingSpecifics) return;
    setSavingSpecifics(true);
    try {
      await updateClientSpecifics.mutateAsync({
        clientId,
        specifics: specificsDraft.trim() || null,
      });
      toast({ title: "Specifics saved" });
    } catch {
      toast({ title: "Could not save specifics", variant: "destructive" });
    } finally {
      setSavingSpecifics(false);
    }
  };

  const toggleProgressExercise = (exerciseId: string, checked: boolean) => {
    setSelectedProgressExerciseIds((prev) => {
      if (checked) {
        if (prev.includes(exerciseId)) return prev;
        return [...prev, exerciseId];
      }
      return prev.filter((id) => id !== exerciseId);
    });
  };

  const handleCreateProgressReport = async () => {
    if (!clientId || !activePhaseForProgress) return;
    if (selectedProgressExerciseIds.length === 0) {
      toast({
        title: "Select exercises",
        description: "Choose at least one exercise from the active phase.",
        variant: "destructive",
      });
      return;
    }
    try {
      await createClientProgressReport.mutateAsync({
        clientId,
        phaseId: activePhaseForProgress.id,
        exerciseIds: selectedProgressExerciseIds,
      });
      toast({
        title: "Progress report requested",
        description: "The client will now see this request in their dashboard.",
      });
      setCreateProgressReportOpen(false);
      setSelectedProgressExerciseIds([]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not create progress report.";
      toast({
        title: "Request failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleOpenApproveProgressReportItem = (reportId: string, itemId: string) => {
    setSelectedProgressReview({ reportId, itemId });
    setProgressApproveNote("");
    setIsProgressApproveOpen(true);
  };

  const handleOpenResubmitProgressReportItem = (reportId: string, itemId: string) => {
    setSelectedProgressReview({ reportId, itemId });
    setProgressResubmitFeedback("");
    setIsProgressResubmitOpen(true);
  };

  const handleApproveProgressReportItem = async () => {
    if (!selectedProgressReview || submittingProgressReview) return;
    setSubmittingProgressReview(true);
    try {
      await reviewProgressReportItem.mutateAsync({
        reportId: selectedProgressReview.reportId,
        itemId: selectedProgressReview.itemId,
        decision: "approve",
        feedbackNote: progressApproveNote.trim() || null,
      });
      toast({
        title: "Progress item approved",
        description: "Client feedback/status has been updated.",
      });
      setIsProgressApproveOpen(false);
      setSelectedProgressReview(null);
    } catch (error: unknown) {
      toast({
        title: "Review failed",
        description: error instanceof Error ? error.message : "Could not approve this submission.",
        variant: "destructive",
      });
    } finally {
      setSubmittingProgressReview(false);
    }
  };

  const handleResubmitProgressReportItem = async () => {
    if (!selectedProgressReview || submittingProgressReview) return;
    setSubmittingProgressReview(true);
    try {
      await reviewProgressReportItem.mutateAsync({
        reportId: selectedProgressReview.reportId,
        itemId: selectedProgressReview.itemId,
        decision: "resubmit",
        feedbackNote: progressResubmitFeedback.trim() || null,
      });
      toast({
        title: "Resubmission requested",
        description: "Client feedback/status has been updated.",
      });
      setIsProgressResubmitOpen(false);
      setSelectedProgressReview(null);
    } catch (error: unknown) {
      toast({
        title: "Review failed",
        description: error instanceof Error ? error.message : "Could not request a resubmission.",
        variant: "destructive",
      });
    } finally {
      setSubmittingProgressReview(false);
    }
  };

  const getSessionCount = (phaseId: string) => {
    return allSessions.filter((s: any) => s.phaseId === phaseId).length;
  };

  const exerciseNameById = useMemo(() => {
    const map = new Map<string, string>();
    allSessions.forEach((session: any) => {
      const sections = (session.sections as any[]) || [];
      sections.forEach((section: any) => {
        const exercises = section?.exercises || [];
        exercises.forEach((exercise: any) => {
          if (exercise?.id && exercise?.name) {
            map.set(exercise.id, String(exercise.name));
          }
        });
      });
    });
    return map;
  }, [allSessions]);

  const structuredLogs = useMemo(
    () =>
      [...workoutLogs]
        .map((log: any) => ({
          ...log,
          exerciseDisplayName:
            log.exerciseName || exerciseNameById.get(log.exerciseId) || "Unknown exercise",
        }))
        .sort((a: any, b: any) => {
          const aTime = typeof a.date === "string" ? a.date : "";
          const bTime = typeof b.date === "string" ? b.date : "";
          return bTime.localeCompare(aTime);
        }),
    [workoutLogs, exerciseNameById],
  );

  const exerciseFilterOptions = useMemo(() => {
    const names: string[] = [];
    structuredLogs.forEach((log: any) => {
      const name = typeof log.exerciseDisplayName === "string" ? log.exerciseDisplayName : "";
      if (name.length > 0 && !names.includes(name)) {
        names.push(name);
      }
    });
    return names.sort((a, b) => a.localeCompare(b));
  }, [structuredLogs]);

  const filteredStructuredLogs = useMemo(
    () =>
      structuredLogs.filter(
        (log: any) =>
          structuredLogsFilter === "all" || log.exerciseDisplayName === structuredLogsFilter,
      ),
    [structuredLogs, structuredLogsFilter],
  );

  const sessionCheckinTrendData = useMemo(
    () => mapSessionCheckinTrendData(((checkinsTrends as any)?.sessions || []) as any[]),
    [checkinsTrends],
  );

  const weeklyCheckinTrendData = useMemo(
    () => mapWeeklyCheckinTrendData(((checkinsTrends as any)?.weeks || []) as any[]),
    [checkinsTrends],
  );
  const weeklyTrendLabelByKey = useMemo(() => {
    const labels = new Map<string, string>();
    weeklyCheckinTrendData.forEach((entry: any) => {
      labels.set(
        String(entry?.trendWeekKey ?? ""),
        String(entry?.trendWeekLabel ?? entry?.dateLabel ?? "—"),
      );
    });
    return labels;
  }, [weeklyCheckinTrendData]);
  const sessionTrendLabelByKey = useMemo(() => {
    const labels = new Map<string, string>();
    sessionCheckinTrendData.forEach((entry: any) => {
      labels.set(
        String(entry?.trendWeekKey ?? ""),
        String(entry?.trendWeekLabel ?? entry?.dateLabel ?? "—"),
      );
    });
    return labels;
  }, [sessionCheckinTrendData]);

  const readinessSummaryCards = useMemo(
    () =>
      buildReadinessSummaryCards({
        sessionTrendData: sessionCheckinTrendData as Record<string, unknown>[],
        weeklyTrendData: weeklyCheckinTrendData as Record<string, unknown>[],
      }),
    [sessionCheckinTrendData, weeklyCheckinTrendData],
  );
  const readinessCardAccent: Record<string, string> = {
    recovery: CHECKIN_COLORS.recovery,
    stress: CHECKIN_COLORS.stress,
    effort: CHECKIN_COLORS.sessionRpe,
  };

  const movementCheckGroups = useMemo(() => {
    return [...(movementCheckGroupsData as any[])].sort((a: any, b: any) => {
      const newestInGroup = (group: any) =>
        ((group?.items || []) as any[]).reduce((latest: string, item: any) => {
          const candidate =
            (typeof item?.decidedAt === "string" && item.decidedAt) ||
            (typeof item?.submittedAt === "string" && item.submittedAt) ||
            "";
          return candidate > latest ? candidate : latest;
        }, "");
      return newestInGroup(b).localeCompare(newestInGroup(a));
    });
  }, [movementCheckGroupsData]);

  const progressReportGroups = useMemo(() => {
    const sorted = [...(progressReportGroupsData as any[])].map((group: any) => ({
      ...group,
      items: [...(group.items || [])].sort((a: any, b: any) => {
        const aTime = a.reviewedAt || a.submittedAt || a.createdAt || "";
        const bTime = b.reviewedAt || b.submittedAt || b.createdAt || "";
        return bTime.localeCompare(aTime);
      }),
    }));
    return sorted.sort((a: any, b: any) => {
      const aTop = a.items?.[0];
      const bTop = b.items?.[0];
      const aTime = aTop ? aTop.reviewedAt || aTop.submittedAt || aTop.createdAt || "" : "";
      const bTime = bTop ? bTop.reviewedAt || bTop.submittedAt || bTop.createdAt || "" : "";
      return bTime.localeCompare(aTime);
    });
  }, [progressReportGroupsData]);

  const adminNotificationSummary = useMemo(() => {
    const raw = (notificationSummary as
      | {
          unreadChatCount?: number;
          movementAttentionCount?: number;
          progressAttentionCount?: number;
          totalAttentionCount?: number;
        }
      | undefined) || {
      unreadChatCount: 0,
      movementAttentionCount: 0,
      progressAttentionCount: 0,
      totalAttentionCount: 0,
    };
    return {
      unreadChatCount: raw.unreadChatCount || 0,
      movementAttentionCount: raw.movementAttentionCount || 0,
      progressAttentionCount: raw.progressAttentionCount || 0,
      totalAttentionCount: raw.totalAttentionCount || 0,
    };
  }, [notificationSummary]);

  const togglePhaseDetails = (phaseId: string) => {
    setExpandedPhaseIds((previous) => {
      const next = new Set(previous);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const navItems = [
    { value: "programming", label: "Plan", icon: Dumbbell, count: 0 },
    { value: "checkins", label: "Recaps", icon: ClipboardList, count: 0 },
    { value: "structured-logs", label: "Notes & Logs", icon: BarChart, count: 0 },
    {
      value: "movement",
      label: "Movement",
      icon: Activity,
      count: adminNotificationSummary.movementAttentionCount,
    },
    {
      value: "progress-report",
      label: "Progress",
      icon: CheckCircle2,
      count: adminNotificationSummary.progressAttentionCount,
    },
    {
      value: "chat",
      label: "Chat",
      icon: MessageCircle,
      count: adminNotificationSummary.unreadChatCount,
    },
    { value: "specifics", label: "Specifics", icon: Pencil, count: 0 },
    { value: "access", label: "Access", icon: ShieldCheck, count: 0 },
  ];

  if (!client)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );

  const renderPhaseCard = (phase: any) => {
    const displayStatus = getPhaseDisplayStatus(phase);
    const statusColor = getStatusColor(displayStatus);
    const ready = phase.status === "Waiting for Movement Check" && isPhaseReadyToActivate(phase);
    const pendingChecks = phase.status === "Waiting for Movement Check" && !ready;
    const checksInfo = (phase.movementChecks as any[]) || [];
    const approvedCount = checksInfo.filter((mc: any) => mc.status === "Approved").length;
    const homeVideoDraft = getPhaseHomeVideoDraft(phase);
    const homeVideoDraftTrimmed = homeVideoDraft.trim();
    const homeVideoDraftParsed = homeVideoDraftTrimmed
      ? normalizeVideoSource(homeVideoDraftTrimmed)
      : null;
    const guideVideoDraft = getPhaseGuideVideoDraft(phase);
    const guideVideoDraftTrimmed = guideVideoDraft.trim();
    const guideVideoDraftParsed = guideVideoDraftTrimmed
      ? normalizeVideoSource(guideVideoDraftTrimmed)
      : null;
    const storedHomeVideoUrl =
      typeof phase.homeIntroVideoUrl === "string" && phase.homeIntroVideoUrl.trim().length > 0
        ? phase.homeIntroVideoUrl.trim()
        : "";
    const storedGuideVideoUrl =
      typeof phase.homeGuideVideoUrl === "string" && phase.homeGuideVideoUrl.trim().length > 0
        ? phase.homeGuideVideoUrl.trim()
        : "";
    const previewVideoUrl = homeVideoDraftParsed ? homeVideoDraftTrimmed : storedHomeVideoUrl;
    const previewGuideVideoUrl = guideVideoDraftParsed
      ? guideVideoDraftTrimmed
      : storedGuideVideoUrl;
    const isSavingHomeVideo = savingPhaseVideoId === phase.id;
    const isExpanded = expandedPhaseIds.has(phase.id);

    return (
      <Card
        key={phase.id}
        className={`overflow-hidden rounded-xl bg-white shadow-sm ${
          phase.status === "Active" ? "border-slate-900" : "border-slate-200"
        }`}
        data-testid={`card-phase-${phase.id}`}
      >
        <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`h-6 rounded-md px-2 text-[11px] font-semibold ${statusColor}`}
                data-testid={`badge-status-${phase.id}`}
              >
                {displayStatus}
              </Badge>
              <span className="text-xs text-slate-500">{phase.durationWeeks} weeks</span>
              <span className="text-xs text-slate-500">{getSessionCount(phase.id)} sessions</span>
              {pendingChecks && checksInfo.length > 0 && (
                <span className="text-xs font-medium text-slate-700">
                  {approvedCount}/{checksInfo.length} checks approved
                </span>
              )}
            </div>
            <h3
              className="truncate text-lg font-semibold text-slate-900"
              data-testid={`text-phase-name-${phase.id}`}
            >
              {phase.name}
            </h3>
            {phase.goal && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{phase.goal}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-md px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => togglePhaseDetails(phase.id)}
              data-testid={`button-phase-details-${phase.id}`}
            >
              <MoreHorizontal className="mr-1.5 h-4 w-4" />
              Details
            </Button>
            <Link href={`/app/admin/clients/${clientId}/builder/${phase.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-md bg-white"
                data-testid={`button-edit-${phase.id}`}
              >
                <Pencil className="mr-1.5 h-4 w-4" /> Edit
              </Button>
            </Link>
            {ready && (
              <Button
                size="sm"
                className="h-8 rounded-md bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => setActivateTargetPhase(phase)}
                data-testid={`button-activate-${phase.id}`}
              >
                <Zap className="mr-1.5 h-4 w-4" /> Activate
              </Button>
            )}
            {pendingChecks && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 cursor-not-allowed rounded-md border-slate-200 text-slate-400 opacity-70"
                disabled
                data-testid={`button-activate-disabled-${phase.id}`}
                title="All movement checks must be approved before activating"
              >
                <Zap className="mr-1.5 h-4 w-4" /> Activate
              </Button>
            )}
            {phase.status === "Active" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-md border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => setFinishTargetPhase(phase)}
                data-testid={`button-finish-${phase.id}`}
              >
                <Archive className="mr-1.5 h-4 w-4" /> Finish
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-md border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              onClick={() => setDeleteTargetPhase(phase)}
              data-testid={`button-delete-${phase.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isExpanded ? (
          <CardContent className="border-t border-slate-100 bg-slate-50/60 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <CalendarDays className="h-4 w-4" /> Week 1 Schedule
            </h4>
            {(() => {
              const schedule = (phase.schedule as any[]) || [];
              const week1 = schedule.filter((s: any) => s.week === 1);
              if (week1.length === 0) {
                return <p className="text-sm text-slate-400 italic">No schedule assigned yet.</p>;
              }
              return (
                <div className="overflow-x-auto">
                  <div className="grid min-w-[400px] grid-cols-[64px_1fr_1fr] overflow-hidden rounded-lg border border-slate-200">
                    <div className="p-2 bg-white border-b border-r border-slate-200 text-[10px] font-semibold text-slate-400 uppercase" />
                    <div className="p-2 bg-white border-b border-r border-slate-200 text-[10px] font-semibold text-slate-400 uppercase text-center">
                      AM
                    </div>
                    <div className="p-2 bg-white border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase text-center">
                      PM
                    </div>
                    {WEEKDAYS.map((day) => {
                      const amEntries = week1.filter(
                        (s: any) => s.day === day && (s.slot || "AM") === "AM",
                      );
                      const pmEntries = week1.filter((s: any) => s.day === day && s.slot === "PM");
                      if (amEntries.length === 0 && pmEntries.length === 0) return null;
                      return [
                        <div
                          key={`${day}-label`}
                          className="p-2 border-b border-r border-slate-100 text-xs font-medium text-slate-600"
                        >
                          {day.slice(0, 3)}
                        </div>,
                        <div
                          key={`${day}-am`}
                          className="p-1.5 border-b border-r border-slate-100 flex flex-wrap gap-1"
                        >
                          {amEntries.map((e: any, i: number) => {
                            const s = allSessions.find((ss: any) => ss.id === e.sessionId);
                            return s ? (
                              <Badge
                                key={i}
                                variant="outline"
                                className="border-slate-200 bg-white text-[10px] text-slate-700"
                              >
                                {s.name}
                              </Badge>
                            ) : null;
                          })}
                        </div>,
                        <div
                          key={`${day}-pm`}
                          className="p-1.5 border-b border-slate-100 flex flex-wrap gap-1"
                        >
                          {pmEntries.map((e: any, i: number) => {
                            const s = allSessions.find((ss: any) => ss.id === e.sessionId);
                            return s ? (
                              <Badge
                                key={i}
                                variant="outline"
                                className="border-slate-200 bg-white text-[10px] text-slate-700"
                              >
                                {s.name}
                              </Badge>
                            ) : null;
                          })}
                        </div>,
                      ];
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 xl:grid-cols-2">
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Home video
                </h5>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={homeVideoDraft}
                    onChange={(event) => setPhaseHomeVideoDraft(phase.id, event.target.value)}
                    placeholder="Paste YouTube, Google Drive, or direct video URL"
                    className="border-slate-200"
                    data-testid={`input-home-video-${phase.id}`}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => savePhaseHomeVideo(phase, homeVideoDraft)}
                      className="bg-slate-900 hover:bg-slate-800 text-white"
                      disabled={isSavingHomeVideo}
                      data-testid={`button-save-home-video-${phase.id}`}
                    >
                      {isSavingHomeVideo ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save
                    </Button>
                    {storedHomeVideoUrl || homeVideoDraftTrimmed ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => savePhaseHomeVideo(phase, "")}
                        disabled={isSavingHomeVideo}
                        data-testid={`button-clear-home-video-${phase.id}`}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>
                {homeVideoDraftTrimmed && !homeVideoDraftParsed ? (
                  <p className="text-xs text-red-600">Please enter a valid video URL.</p>
                ) : null}
                {previewVideoUrl ? (
                  <div className="max-w-sm">
                    <InlineVideoPlayer
                      url={previewVideoUrl}
                      testId={`preview-home-video-${phase.id}`}
                      openLinkLabel="Open intro video"
                    />
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Guide video
                </h5>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={guideVideoDraft}
                    onChange={(event) => setPhaseGuideVideoDraft(phase.id, event.target.value)}
                    placeholder="Paste YouTube, Google Drive, or direct video URL"
                    className="border-slate-200"
                    data-testid={`input-guide-video-${phase.id}`}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => savePhaseGuideVideo(phase, guideVideoDraft)}
                      className="bg-slate-900 hover:bg-slate-800 text-white"
                      disabled={isSavingHomeVideo}
                      data-testid={`button-save-guide-video-${phase.id}`}
                    >
                      {isSavingHomeVideo ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save
                    </Button>
                    {storedGuideVideoUrl || guideVideoDraftTrimmed ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => savePhaseGuideVideo(phase, "")}
                        disabled={isSavingHomeVideo}
                        data-testid={`button-clear-guide-video-${phase.id}`}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>
                {guideVideoDraftTrimmed && !guideVideoDraftParsed ? (
                  <p className="text-xs text-red-600">Please enter a valid video URL.</p>
                ) : null}
                {previewGuideVideoUrl ? (
                  <div className="max-w-sm">
                    <InlineVideoPlayer
                      url={previewGuideVideoUrl}
                      testId={`preview-guide-video-${phase.id}`}
                      openLinkLabel="Open guide video"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/app/admin/clients">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full border border-slate-200 bg-white"
                data-testid="button-back-clients"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="h-12 w-12 border border-slate-200">
                <AvatarImage src={client.avatar} />
                <AvatarFallback className="bg-slate-100 text-lg text-slate-700">
                  {(clientDisplayName || "U").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1
                  className="truncate text-xl font-semibold tracking-tight text-slate-900"
                  data-testid="text-client-profile-name"
                >
                  {clientDisplayName}
                </h1>
                <p className="mt-0.5 truncate text-sm text-slate-500">{client.email}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Badge
              variant="outline"
              className={
                client.status === "Active"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }
            >
              {client.status}
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
              {clientPhases.length} phases
            </Badge>
            {draftPhases.length > 0 ? (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                {draftPhases.length} draft{draftPhases.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => {
                if (client) {
                  impersonate(client);
                  setLocation("/app/client/home");
                }
              }}
              data-testid="button-impersonate"
              disabled={client.status !== "Active"}
            >
              <Repeat className="mr-2 h-4 w-4" /> Impersonate
            </Button>
          </div>
        </div>
      </div>

      {adminNotificationSummary.totalAttentionCount > 0 ? (
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <span className="text-sm font-semibold text-slate-900">Needs review</span>
            <Badge className="border-none bg-slate-900 text-white">
              {adminNotificationSummary.totalAttentionCount}
            </Badge>
            {adminNotificationSummary.unreadChatCount > 0 ? (
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                Chat {adminNotificationSummary.unreadChatCount}
              </Badge>
            ) : null}
            {adminNotificationSummary.movementAttentionCount > 0 ? (
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                Movement {adminNotificationSummary.movementAttentionCount}
              </Badge>
            ) : null}
            {adminNotificationSummary.progressAttentionCount > 0 ? (
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                Progress {adminNotificationSummary.progressAttentionCount}
              </Badge>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const testId =
              item.value === "programming"
                ? "tab-programming"
                : item.value === "progress-report"
                  ? "tab-progress-report"
                  : item.value === "access"
                    ? "tab-client-access"
                    : `tab-${item.value}`;
            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="h-9 rounded-lg px-3 text-slate-600 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm"
                data-testid={testId}
              >
                <Icon className="mr-1.5 h-4 w-4" />
                {item.label}
                {item.count > 0 ? (
                  <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-slate-700 px-1.5 py-0.5 text-[11px] font-semibold text-white data-[state=active]:bg-white data-[state=active]:text-slate-900">
                    {item.count}
                  </span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-5">
          <TabsContent value="programming" className="m-0 space-y-5 outline-none">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-slate-900">Phases</h2>
              <Link href={`/app/admin/clients/${clientId}/builder/new`}>
                <Button
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-full"
                  data-testid="button-create-phase"
                >
                  <Plus className="mr-2 h-4 w-4" /> Create Phase
                </Button>
              </Link>
            </div>

            {activePhases.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Active Phase{activePhases.length > 1 ? "s" : ""}
                </h3>
                <div className="space-y-4">
                  {activePhases.map((phase: any) => renderPhaseCard(phase))}
                </div>
              </div>
            )}

            {pendingPhases.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Pending Phases
                </h3>
                <div className="space-y-4">
                  {pendingPhases.map((phase: any) => renderPhaseCard(phase))}
                </div>
              </div>
            )}

            {draftPhases.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Drafts
                </h3>
                <div className="space-y-3">
                  {draftPhases.map((phase: any) => (
                    <Card
                      key={phase.id}
                      className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50"
                      data-testid={`card-draft-${phase.id}`}
                    >
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="h-6 rounded-md border-slate-200 bg-slate-100 px-2 text-[11px] text-slate-600"
                            >
                              Draft
                            </Badge>
                            <span className="text-xs text-slate-400">
                              {getSessionCount(phase.id)} session(s) &middot; {phase.durationWeeks}{" "}
                              weeks
                            </span>
                          </div>
                          <h4 className="truncate text-base font-semibold text-slate-900">
                            {phase.name}
                          </h4>
                          {phase.goal && (
                            <p className="mt-0.5 truncate text-sm text-slate-500">{phase.goal}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Link href={`/app/admin/clients/${clientId}/builder/${phase.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-md bg-white"
                              data-testid={`button-edit-draft-${phase.id}`}
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-md border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            onClick={() => setDeleteTargetPhase(phase)}
                            data-testid={`button-delete-draft-${phase.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {clientPhases.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                <Dumbbell className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">No Phases Yet</h3>
                <p className="text-slate-500 mt-1 mb-6 max-w-sm mx-auto">
                  This client doesn't have any training phases. Build one from scratch or use a
                  template.
                </p>
                <Link href={`/app/admin/clients/${clientId}/builder/new`}>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full"
                    data-testid="button-build-phase"
                  >
                    Build Phase
                  </Button>
                </Link>
              </div>
            )}

            {completedPhases.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Phase History
                </h3>
                <div className="space-y-3">
                  {completedPhases.map((phase: any) => (
                    <Card
                      key={phase.id}
                      className="rounded-xl border-slate-200 shadow-none transition-colors hover:bg-slate-50"
                      data-testid={`card-completed-${phase.id}`}
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="h-6 rounded-md border-slate-200 bg-slate-100 px-2 text-[11px] text-slate-500"
                            >
                              Completed
                            </Badge>
                          </div>
                          <div className="font-medium text-slate-900">{phase.name}</div>
                          <div className="text-sm text-slate-500">{phase.durationWeeks} Weeks</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/app/admin/clients/${clientId}/builder/${phase.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-500"
                              data-testid={`button-view-completed-${phase.id}`}
                            >
                              <Pencil className="mr-1 h-4 w-4" /> View
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteTargetPhase(phase)}
                            data-testid={`button-delete-completed-${phase.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="movement" className="m-0 outline-none">
            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle>Movement Checks</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Review movement submissions grouped by phase.
                </p>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100">
                {movementCheckGroups.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <CheckCircle2 className="h-12 w-12 text-green-200 mx-auto mb-3" />
                    <p>No movement checks submitted yet.</p>
                  </div>
                ) : (
                  movementCheckGroups.map((group: any) => (
                    <div
                      key={group.phaseId}
                      className="p-5 space-y-3"
                      data-testid={`movement-group-${group.phaseId}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-slate-900">{group.phaseName}</div>
                        <Badge
                          variant="outline"
                          className="bg-slate-100 text-slate-700 border-slate-200"
                        >
                          {group.phaseStatus}
                        </Badge>
                      </div>
                      <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden bg-white">
                        {[...(group.items || [])]
                          .sort((a: any, b: any) => {
                            const aTime = a.decidedAt || a.submittedAt || "";
                            const bTime = b.decidedAt || b.submittedAt || "";
                            return bTime.localeCompare(aTime);
                          })
                          .map((item: any, index: number) => {
                            const note =
                              item.rawStatus === "Approved"
                                ? item.approvedNote
                                : item.rawStatus === "Needs Resubmission"
                                  ? item.resubmitFeedback
                                  : item.clientNote;
                            const noteLabel =
                              item.rawStatus === "Approved"
                                ? "Approval note"
                                : item.rawStatus === "Needs Resubmission"
                                  ? "Resubmission feedback"
                                  : "Client note";

                            return (
                              <ReviewSubmissionRow
                                key={`${group.phaseId}-${item.exerciseId}-${index}`}
                                exerciseName={item.exerciseName}
                                status={
                                  (item.status as "requested" | "submitted" | "reviewed") ||
                                  "requested"
                                }
                                submittedAt={item.decidedAt || item.submittedAt}
                                submittedLabel={item.decidedAt ? "Reviewed" : "Submitted"}
                                videoUrl={item.videoUrl}
                                videoSource={item.videoSource}
                                note={note}
                                noteLabel={noteLabel}
                                actions={
                                  item.rawStatus === "Pending" ? (
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        className="border-red-200 text-red-700 hover:bg-red-50"
                                        onClick={() =>
                                          handleOpenReject(group.phaseId, item.exerciseId)
                                        }
                                        data-testid={`button-reject-${group.phaseId}-${item.exerciseId}`}
                                        disabled={isSubmitting}
                                      >
                                        <XCircle className="mr-2 h-4 w-4" /> Resubmit
                                      </Button>
                                      <Button
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() =>
                                          handleOpenApprove(group.phaseId, item.exerciseId)
                                        }
                                        data-testid={`button-approve-${group.phaseId}-${item.exerciseId}`}
                                        disabled={isSubmitting}
                                      >
                                        <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                                      </Button>
                                    </div>
                                  ) : null
                                }
                                testId={`movement-check-${group.phaseId}-${item.exerciseId}`}
                              />
                            );
                          })}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress-report" className="m-0 outline-none space-y-4">
            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Progress Report Requests</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      Request exercise updates from the active phase without interrupting training.
                    </p>
                  </div>
                  <Button
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-full"
                    onClick={() => setCreateProgressReportOpen(true)}
                    disabled={!activePhaseForProgress || selectableProgressExercises.length === 0}
                    data-testid="button-open-create-progress-report"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Request
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100">
                {progressReportGroups.length === 0 ? (
                  <div className="p-8 text-sm text-slate-500">No progress report requests yet.</div>
                ) : (
                  progressReportGroups.map((group: any) => (
                    <div
                      key={group.phaseId}
                      className="p-5 space-y-3"
                      data-testid={`progress-group-${group.phaseId}`}
                    >
                      <div className="font-semibold text-slate-900">{group.phaseName}</div>
                      <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden bg-white">
                        {(group.items || []).map((item: any, index: number) => {
                          const videoUrl =
                            (typeof item.submissionPlaybackUrl === "string" &&
                            item.submissionPlaybackUrl.trim().length > 0
                              ? item.submissionPlaybackUrl
                              : null) ||
                            (typeof item.submissionLink === "string" &&
                            item.submissionLink.trim().length > 0
                              ? item.submissionLink
                              : null);
                          const hasSubmission =
                            Boolean(videoUrl) ||
                            (typeof item.submissionObjectKey === "string" &&
                              item.submissionObjectKey.trim().length > 0);
                          const status =
                            item.reviewStatus === "approved"
                              ? "approved"
                              : item.reviewStatus === "resubmission_requested"
                                ? "resubmission_requested"
                                : item.reviewStatus === "submitted"
                                  ? "submitted"
                                  : item.reportStatus === "approved" ||
                                      item.reportStatus === "reviewed"
                                    ? "approved"
                                    : item.reportStatus === "resubmission_requested"
                                      ? "resubmission_requested"
                                      : hasSubmission
                                        ? "submitted"
                                        : "requested";
                          const reviewNote =
                            status === "resubmission_requested" || status === "approved"
                              ? item.feedbackNote
                              : item.submissionNote;
                          const noteLabel =
                            status === "resubmission_requested"
                              ? "Coach feedback"
                              : status === "approved"
                                ? "Coach note"
                                : "Achieved parameters";
                          const canReview = hasSubmission && status !== "approved";

                          return (
                            <ReviewSubmissionRow
                              key={`${group.phaseId}-${item.reportId}-${item.exerciseId}-${index}`}
                              exerciseName={item.exerciseName}
                              status={status}
                              submittedAt={item.reviewedAt || item.submittedAt || item.createdAt}
                              submittedLabel={
                                item.reviewedAt
                                  ? "Reviewed"
                                  : item.submittedAt
                                    ? "Submitted"
                                    : "Requested"
                              }
                              videoUrl={videoUrl}
                              videoSource={item.submissionSource}
                              note={reviewNote}
                              noteLabel={noteLabel}
                              actions={
                                canReview ? (
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      className="border-red-200 text-red-700 hover:bg-red-50"
                                      onClick={() =>
                                        handleOpenResubmitProgressReportItem(
                                          item.reportId,
                                          item.itemId,
                                        )
                                      }
                                      data-testid={`button-progress-resubmit-${item.reportId}-${item.itemId}`}
                                      disabled={submittingProgressReview}
                                    >
                                      <XCircle className="mr-2 h-4 w-4" /> Resubmit
                                    </Button>
                                    <Button
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() =>
                                        handleOpenApproveProgressReportItem(
                                          item.reportId,
                                          item.itemId,
                                        )
                                      }
                                      data-testid={`button-progress-approve-${item.reportId}-${item.itemId}`}
                                      disabled={submittingProgressReview}
                                    >
                                      <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                                    </Button>
                                  </div>
                                ) : null
                              }
                              testId={`progress-report-item-${item.reportId}-${item.exerciseId}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="m-0 outline-none">
            <Card className="flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white rounded-2xl h-[600px]">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isChatLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <MessageCircle className="h-12 w-12 text-slate-200 mb-4" />
                    <p>No messages yet. Start a conversation.</p>
                  </div>
                ) : (
                  chatMessages.map((msg: any) => {
                    const senderDisplayName = getChatDisplayFirstName(msg);
                    const senderInitial = senderDisplayName.charAt(0) || "U";
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-4 ${!msg.isClient ? "flex-row-reverse" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => openChatProfilePreview(msg)}
                          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                          data-testid={`button-open-chat-profile-${msg.id}`}
                        >
                          <Avatar className="h-10 w-10 shrink-0 border border-slate-100 shadow-sm">
                            <AvatarImage
                              src={msg.senderAvatar || undefined}
                              alt={senderDisplayName || undefined}
                            />
                            <AvatarFallback
                              className={
                                !msg.isClient
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-slate-100 text-slate-700"
                              }
                            >
                              {senderInitial}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                        <div
                          className={`flex flex-col ${!msg.isClient ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-semibold text-slate-900 text-sm">
                              {senderDisplayName}
                            </span>
                            <span className="text-xs text-slate-500">
                              {msg.time?.includes("T")
                                ? new Date(msg.time).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : msg.time}
                            </span>
                          </div>
                          <div
                            className={`text-sm leading-relaxed whitespace-pre-wrap break-words p-4 rounded-2xl max-w-md ${
                              !msg.isClient
                                ? "bg-indigo-600 text-white rounded-tr-sm"
                                : "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm"
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <form className="relative" onSubmit={handleSendChatMessage}>
                  <Textarea
                    placeholder="Message client..."
                    className="w-full min-h-[56px] max-h-44 resize-none pr-12 rounded-xl bg-white border-slate-200 focus-visible:ring-indigo-500 shadow-sm"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={handleChatComposerKeyDown}
                    data-testid="input-chat-message"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="absolute right-2 bottom-2 h-9 w-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                    data-testid="button-send-message"
                    disabled={!chatMessage.trim()}
                  >
                    <Send className="h-4 w-4 text-white" />
                  </Button>
                </form>
              </div>
            </Card>

            <Dialog
              open={!!chatProfilePreview}
              onOpenChange={(open) => !open && setChatProfilePreview(null)}
            >
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Profile</DialogTitle>
                </DialogHeader>
                {chatProfilePreview && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center gap-3">
                      <Avatar className="h-24 w-24 border border-slate-200">
                        <AvatarImage
                          src={chatProfilePreview.avatar || undefined}
                          alt={chatProfilePreview.name}
                        />
                        <AvatarFallback className="bg-indigo-50 text-indigo-700 text-lg font-semibold">
                          {(chatProfilePreview.name || "U")
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase() || "")
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-lg font-semibold text-slate-900">
                        {chatProfilePreview.name}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Bio
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">
                        {chatProfilePreview.bio?.trim()
                          ? chatProfilePreview.bio
                          : "No bio added yet."}
                      </p>
                    </div>
                    {(chatProfilePreview.height || chatProfilePreview.weight) && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            Height
                          </p>
                          <p className="text-sm text-slate-800">
                            {chatProfilePreview.height || "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            Weight
                          </p>
                          <p className="text-sm text-slate-800">
                            {chatProfilePreview.weight || "—"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="specifics" className="m-0 outline-none">
            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle>Specifics</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {(specificsData?.specificsUpdatedAt || specificsData?.specificsUpdatedBy) && (
                  <div className="text-xs text-slate-500">
                    Last updated{" "}
                    {specificsData?.specificsUpdatedAt
                      ? new Date(specificsData.specificsUpdatedAt).toLocaleString()
                      : "-"}
                    {specificsData?.specificsUpdatedBy
                      ? ` by ${specificsData.specificsUpdatedBy}`
                      : ""}
                  </div>
                )}
                <Textarea
                  value={specificsDraft}
                  onChange={(e) => setSpecificsDraft(e.target.value)}
                  placeholder="Coaching specifics for this client..."
                  className="min-h-[180px]"
                  data-testid="input-client-specifics"
                />
                <div>
                  <Button
                    onClick={handleSaveSpecifics}
                    disabled={savingSpecifics}
                    data-testid="button-save-client-specifics"
                  >
                    {savingSpecifics ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Specifics
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structured-logs" className="m-0 outline-none">
            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Notes &amp; Logs</CardTitle>
                  <div className="w-[260px]">
                    <Select value={structuredLogsFilter} onValueChange={setStructuredLogsFilter}>
                      <SelectTrigger
                        className="bg-white"
                        data-testid="select-structured-logs-exercise-filter"
                      >
                        <SelectValue placeholder="Filter by exercise" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All exercises</SelectItem>
                        {exerciseFilterOptions.map((exerciseName) => (
                          <SelectItem key={exerciseName} value={exerciseName}>
                            {exerciseName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {filteredStructuredLogs.length} entr
                  {filteredStructuredLogs.length === 1 ? "y" : "ies"}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {structuredLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <BarChart className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p>No structured logs yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredStructuredLogs.map((log: any) => (
                      <div key={log.id} className="p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {log.exerciseDisplayName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(log.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-xs text-slate-600">
                          Exercise entry: {log.instanceId}
                        </div>
                        <div className="text-xs text-slate-600">
                          Sets logged: {(log.sets || []).length}
                        </div>
                        {log.clientNotes && (
                          <div className="text-sm bg-blue-50 text-blue-900 border border-blue-100 rounded-md p-2 whitespace-pre-wrap">
                            <span className="font-semibold">
                              Client note for {log.exerciseDisplayName}:
                            </span>{" "}
                            {log.clientNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checkins" className="m-0 outline-none space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {readinessSummaryCards.map((card) => (
                <Card key={card.key} className="border-slate-200 shadow-sm rounded-2xl bg-white">
                  <CardContent className="p-4">
                    <div
                      className="text-xs uppercase tracking-wider"
                      style={{ color: readinessCardAccent[card.key] || "#475569" }}
                    >
                      {card.title}
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{card.primary}</div>
                    <div className="text-xs text-slate-500 mt-1">{card.secondary}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <CardTitle>Trend Explorer</CardTitle>
                  <Select value={checkinsRange} onValueChange={setCheckinsRange}>
                    <SelectTrigger
                      className="w-[160px] bg-white"
                      data-testid="select-checkins-range"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2w">2 weeks</SelectItem>
                      <SelectItem value="4w">4 weeks</SelectItem>
                      <SelectItem value="8w">8 weeks</SelectItem>
                      <SelectItem value="12w">12 weeks</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">Session metrics</span>
                    <Button
                      size="sm"
                      variant={sessionMetrics.rpeOverall ? "default" : "outline"}
                      onClick={() =>
                        setSessionMetrics((prev) => ({ ...prev, rpeOverall: !prev.rpeOverall }))
                      }
                    >
                      Session RPE
                    </Button>
                    <Button
                      size="sm"
                      variant={sessionMetrics.sleepLastNight ? "default" : "outline"}
                      onClick={() =>
                        setSessionMetrics((prev) => ({
                          ...prev,
                          sleepLastNight: !prev.sleepLastNight,
                        }))
                      }
                    >
                      Sleep last night
                    </Button>
                    <Button
                      size="sm"
                      variant={sessionMetrics.feltOffEvents ? "default" : "outline"}
                      onClick={() =>
                        setSessionMetrics((prev) => ({
                          ...prev,
                          feltOffEvents: !prev.feltOffEvents,
                        }))
                      }
                    >
                      Felt-off events
                    </Button>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer>
                      <ComposedChart data={sessionCheckinTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="trendWeekKey"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(value: string) =>
                            sessionTrendLabelByKey.get(String(value)) ?? String(value)
                          }
                        />
                        <YAxis yAxisId="rpe" domain={[0, 10]} tick={{ fontSize: 11 }} />
                        <YAxis
                          yAxisId="sleep"
                          orientation="right"
                          domain={[0, 10]}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const point = payload[0]?.payload as any;
                            return (
                              <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
                                <div className="font-semibold text-slate-900">
                                  {point?.sessionName || "Session"}
                                </div>
                                <div className="text-slate-600">{point?.dateLabel}</div>
                                <div className="text-slate-700 mt-1">RPE: {point?.rpeOverall}</div>
                                <div className="text-slate-700">
                                  Sleep last night: {point?.sleepLastNight ?? "-"}
                                </div>
                                {point?.feltOff ? (
                                  <div className="text-amber-700">Felt off: Yes</div>
                                ) : null}
                                {point?.whatFeltOff ? (
                                  <div className="text-slate-700 mt-1 whitespace-pre-wrap">
                                    What felt off: {point.whatFeltOff}
                                  </div>
                                ) : null}
                                {point?.optionalNote ? (
                                  <div className="text-slate-700 mt-1">
                                    Optional note: {point.optionalNote}
                                  </div>
                                ) : null}
                              </div>
                            );
                          }}
                        />
                        <Legend />
                        {sessionMetrics.rpeOverall && (
                          <Line
                            yAxisId="rpe"
                            type="monotone"
                            dataKey="rpeOverall"
                            name="Session RPE"
                            stroke={CHECKIN_COLORS.sessionRpe}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        )}
                        {sessionMetrics.sleepLastNight && (
                          <Line
                            yAxisId="sleep"
                            type="monotone"
                            dataKey="sleepLastNight"
                            name="Sleep last night"
                            stroke={CHECKIN_COLORS.sleepLastNight}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls={false}
                          />
                        )}
                        {sessionMetrics.feltOffEvents && (
                          <Line
                            yAxisId="rpe"
                            type="linear"
                            dataKey="feltOffEventLevel"
                            name="Felt off events"
                            stroke="transparent"
                            dot={{
                              r: 5,
                              fill: CHECKIN_COLORS.feltOff,
                              stroke: "#ffffff",
                              strokeWidth: 1.5,
                            }}
                            activeDot={{
                              r: 6,
                              fill: CHECKIN_COLORS.feltOff,
                              stroke: "#ffffff",
                              strokeWidth: 1.5,
                            }}
                            connectNulls={false}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">Weekly metrics</span>
                    <Button
                      size="sm"
                      variant={weeklyMetrics.recoveryThisTrainingWeek ? "default" : "outline"}
                      onClick={() =>
                        setWeeklyMetrics((prev) => ({
                          ...prev,
                          recoveryThisTrainingWeek: !prev.recoveryThisTrainingWeek,
                        }))
                      }
                    >
                      Recovery
                    </Button>
                    <Button
                      size="sm"
                      variant={weeklyMetrics.stressOutsideTrainingThisWeek ? "default" : "outline"}
                      onClick={() =>
                        setWeeklyMetrics((prev) => ({
                          ...prev,
                          stressOutsideTrainingThisWeek: !prev.stressOutsideTrainingThisWeek,
                        }))
                      }
                    >
                      Stress
                    </Button>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer>
                      <ComposedChart data={weeklyCheckinTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const point = payload[0]?.payload as any;
                            return (
                              <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
                                <div className="font-semibold text-slate-900">
                                  Week of {point?.weekStartDate}
                                </div>
                                <div className="text-slate-700 mt-1">
                                  Recovery: {point?.recoveryThisTrainingWeek}
                                </div>
                                <div className="text-slate-700">
                                  Stress: {point?.stressOutsideTrainingThisWeek}
                                </div>
                                {point?.optionalNote ? (
                                  <div className="text-slate-700 mt-1">
                                    Note: {point.optionalNote}
                                  </div>
                                ) : null}
                              </div>
                            );
                          }}
                        />
                        <Legend />
                        {weeklyMetrics.recoveryThisTrainingWeek && (
                          <Line
                            type="monotone"
                            dataKey="recoveryThisTrainingWeek"
                            name="Recovery this training week"
                            stroke={CHECKIN_COLORS.recovery}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        )}
                        {weeklyMetrics.stressOutsideTrainingThisWeek && (
                          <Line
                            type="monotone"
                            dataKey="stressOutsideTrainingThisWeek"
                            name="Stress outside training this week"
                            stroke={CHECKIN_COLORS.stress}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Weekly injury impact
                    </span>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <ComposedChart data={weeklyCheckinTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="trendWeekKey"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(value: string) =>
                            weeklyTrendLabelByKey.get(String(value)) ?? String(value)
                          }
                        />
                        <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const point = payload[0]?.payload as any;
                            return (
                              <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
                                <div className="font-semibold text-slate-900">
                                  {point?.trendWeekLabel || point?.weekStartDate || "Week"}
                                </div>
                                <div className="text-slate-700 mt-1">
                                  Injury impact:{" "}
                                  {typeof point?.injuryImpact === "number"
                                    ? point.injuryImpact
                                    : "—"}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="injuryImpact"
                          name="Weekly injury impact"
                          stroke={CHECKIN_COLORS.painInjury}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          connectNulls={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle>Recent Recaps</CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">Recent session recaps</h3>
                  {((checkinsRecent as any)?.sessions || []).length === 0 ? (
                    <p className="text-sm text-slate-500">No session recaps yet.</p>
                  ) : (
                    (checkinsRecent as any).sessions.map((entry: any) => (
                      <div key={entry.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="text-sm font-semibold text-slate-900">
                          {entry.sessionName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(entry.submittedAt).toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-700 mt-1">
                          Session RPE {entry.sessionRpe ?? entry.rpeOverall}
                          {entry.feltOff ? " · felt off" : ""}
                        </div>
                        <div className="text-xs text-slate-700">
                          Sleep last night {entry.sleepLastNight ?? "-"}
                        </div>
                        {entry.whatFeltOff ? (
                          <div className="text-xs text-slate-700 mt-1">
                            What felt off: {entry.whatFeltOff}
                          </div>
                        ) : null}
                        {entry.optionalNote ? (
                          <div className="text-xs text-slate-700 mt-1">
                            Optional note: {entry.optionalNote}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">Recent weekly recaps</h3>
                  {((checkinsRecent as any)?.weeks || []).length === 0 ? (
                    <p className="text-sm text-slate-500">No weekly recaps yet.</p>
                  ) : (
                    (checkinsRecent as any).weeks.map((entry: any) => (
                      <div key={entry.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="text-sm font-semibold text-slate-900">
                          Week of {entry.weekStartDate}
                        </div>
                        <div className="text-xs text-slate-700 mt-1">
                          Recovery {entry.recoveryThisTrainingWeek} · Stress{" "}
                          {entry.stressOutsideTrainingThisWeek}
                        </div>
                        <div className="text-xs text-slate-700">
                          Pain/injury affected training{" "}
                          {entry.injuryAffectedTraining ? "Yes" : "No"}
                        </div>
                        <div className="text-xs text-slate-700">
                          Injury impact{" "}
                          {entry.injuryAffectedTraining ? (entry.injuryImpact ?? "—") : "—"}
                        </div>
                        {entry.optionalNote ? (
                          <div className="text-xs text-slate-700 mt-1">
                            Optional note: {entry.optionalNote}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access" className="m-0 outline-none">
            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle>Client Access Management</CardTitle>
                <p className="text-sm text-slate-500">
                  Inactive keeps phases archived. Remove deletes all client phases and disables
                  account access permanently.
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Current account status</p>
                    <p className="text-xs text-slate-500">{client.status}</p>
                  </div>
                  <Badge
                    className={
                      client.status === "Active"
                        ? "bg-green-100 text-green-700 border-none"
                        : "bg-slate-200 text-slate-700 border-none"
                    }
                  >
                    {client.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {client.status === "Active" ? (
                    <Button
                      variant="outline"
                      onClick={() => handleSetClientStatus("Inactive")}
                      disabled={updateUserStatus.isPending || removeClient.isPending}
                      data-testid="button-client-set-inactive"
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      Set inactive
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleSetClientStatus("Active")}
                      disabled={updateUserStatus.isPending || removeClient.isPending}
                      data-testid="button-client-reactivate"
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Reactivate
                    </Button>
                  )}

                  <Button
                    variant="destructive"
                    onClick={handleRemoveClient}
                    disabled={updateUserStatus.isPending || removeClient.isPending}
                    data-testid="button-client-remove"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Client
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={createProgressReportOpen} onOpenChange={setCreateProgressReportOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Create Progress Report Request</DialogTitle>
            <DialogDescription>
              Select exercises from the currently active phase. The client will receive this as an
              additional task while continuing training.
            </DialogDescription>
          </DialogHeader>
          {!activePhaseForProgress ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This client has no active phase. Activate a phase first.
            </div>
          ) : (
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              <div className="text-sm text-slate-600">
                Active phase:{" "}
                <span className="font-semibold text-slate-900">{activePhaseForProgress.name}</span>
              </div>
              {selectableProgressExercises.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No exercises found in the active phase.
                </div>
              ) : (
                selectableProgressExercises.map((exercise) => {
                  const checked = selectedProgressExerciseIds.includes(exercise.id);
                  return (
                    <label
                      key={exercise.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={checked}
                        onChange={(event) =>
                          toggleProgressExercise(exercise.id, event.target.checked)
                        }
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{exercise.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {exercise.sets || "—"} sets · {exercise.reps || "—"} reps ·{" "}
                          {exercise.tempo || "—"} tempo
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateProgressReportOpen(false);
                setSelectedProgressExerciseIds([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProgressReport}
              disabled={
                !activePhaseForProgress ||
                selectedProgressExerciseIds.length === 0 ||
                createClientProgressReport.isPending
              }
              className="bg-slate-900 hover:bg-slate-800 text-white"
              data-testid="button-create-progress-report"
            >
              {createClientProgressReport.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Approve Movement Check</DialogTitle>
            <DialogDescription>
              Optionally leave a note for the client with your approval.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="approve-note">Approval Note (optional)</Label>
              <Textarea
                id="approve-note"
                placeholder="e.g. Great form! You're ready to start with full load."
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                data-testid="input-approve-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApproveMovementCheck}
              disabled={isSubmitting}
              data-testid="button-confirm-approve"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Resubmission</DialogTitle>
            <DialogDescription>
              Provide feedback to the client on why this video needs to be re-recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="feedback">Resubmission Feedback</Label>
              <Textarea
                id="feedback"
                placeholder="e.g. Your camera angle makes it hard to see your depth. Please record from the side."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                data-testid="input-reject-feedback"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRejectMovementCheck}
              disabled={isSubmitting || !feedback.trim()}
              data-testid="button-confirm-reject"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Send Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProgressApproveOpen} onOpenChange={setIsProgressApproveOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Approve Progress Report Item</DialogTitle>
            <DialogDescription>
              Optionally leave a short feedback note for the client.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="progress-approve-note">Feedback Note (optional)</Label>
              <Textarea
                id="progress-approve-note"
                placeholder="e.g. Great progress on depth and tempo consistency."
                value={progressApproveNote}
                onChange={(e) => setProgressApproveNote(e.target.value)}
                data-testid="input-progress-approve-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsProgressApproveOpen(false)}
              disabled={submittingProgressReview}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApproveProgressReportItem}
              disabled={submittingProgressReview}
              data-testid="button-confirm-progress-approve"
            >
              {submittingProgressReview ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProgressResubmitOpen} onOpenChange={setIsProgressResubmitOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Progress Resubmission</DialogTitle>
            <DialogDescription>
              Leave clear feedback so the client can resubmit with improvements.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="progress-resubmit-feedback">Resubmission Feedback</Label>
              <Textarea
                id="progress-resubmit-feedback"
                placeholder="e.g. Please share a clearer angle to assess form depth."
                value={progressResubmitFeedback}
                onChange={(e) => setProgressResubmitFeedback(e.target.value)}
                data-testid="input-progress-resubmit-feedback"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsProgressResubmitOpen(false)}
              disabled={submittingProgressReview}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleResubmitProgressReportItem}
              disabled={submittingProgressReview || !progressResubmitFeedback.trim()}
              data-testid="button-confirm-progress-resubmit"
            >
              {submittingProgressReview ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Send Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activateTargetPhase !== null}
        onOpenChange={(open) => {
          if (!open) setActivateTargetPhase(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Activate Phase</DialogTitle>
            <DialogDescription>
              {activePhases.length > 0
                ? `Activating "${activateTargetPhase?.name}" will finish the current active phase${activePhases.length > 1 ? "s" : ""} (${activePhases.map((p: any) => `"${p.name}"`).join(", ")}) and make this the client's new active phase.`
                : `Activate "${activateTargetPhase?.name}"? The client will immediately see this phase.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActivateTargetPhase(null)}
              disabled={activating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleActivatePhase}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={activating}
              data-testid="button-confirm-activate"
            >
              {activating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              {activePhases.length > 0 ? "Finish & Activate" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={finishTargetPhase !== null}
        onOpenChange={(open) => {
          if (!open) setFinishTargetPhase(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Finish Phase</DialogTitle>
            <DialogDescription>
              Mark "{finishTargetPhase?.name}" as completed? It will remain visible in your admin
              history but will no longer appear for the client.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFinishTargetPhase(null)}
              disabled={finishing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFinishPhase}
              className="bg-slate-900 hover:bg-slate-800 text-white"
              disabled={finishing}
              data-testid="button-confirm-finish"
            >
              {finishing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Finish Phase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTargetPhase !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetPhase(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Phase</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTargetPhase?.name}"? This will also remove all
              sessions and logs tied to it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTargetPhase(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeletePhase}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              data-testid="button-confirm-delete-phase"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
