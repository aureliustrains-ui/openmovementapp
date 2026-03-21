import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  progressReportQuery,
  sessionsQuery,
  useSubmitProgressReport,
  useCreateClientVideoUploadTarget,
  uploadClientVideoToObjectStorage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExerciseStandardDetails } from "@/components/client/ExerciseStandardDetails";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";
import { VideoUploadField } from "@/components/client/VideoUploadField";

type ProgressReportItem = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  submissionSource?: "link" | "upload" | null;
  submissionObjectKey?: string | null;
  submissionMimeType?: string | null;
  submissionOriginalFilename?: string | null;
  submissionLink: string | null;
  submissionPlaybackUrl?: string | null;
  submissionNote: string | null;
  reviewStatus?: "requested" | "submitted" | "approved" | "resubmission_requested";
  feedbackNote?: string | null;
  reviewedAt?: string | null;
};

type ProgressReport = {
  id: string;
  clientId: string;
  phaseId: string;
  status: "requested" | "submitted" | "approved" | "resubmission_requested" | "reviewed";
  createdAt: string;
  submittedAt: string | null;
  items: ProgressReportItem[];
};

type DraftMap = Record<string, { submissionLink: string; submissionNote: string }>;
type FileDraftMap = Record<string, File | null>;

const ALLOWED_CLIENT_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/3gpp",
]);
const MAX_CLIENT_VIDEO_BYTES = 250 * 1024 * 1024;

function getReportStatusMeta(status: ProgressReport["status"]) {
  if (status === "approved" || status === "reviewed") {
    return {
      label: "Approved",
      badgeClass: "bg-green-100 text-green-700 border-green-200",
    };
  }
  if (status === "resubmission_requested") {
    return {
      label: "Resubmission requested",
      badgeClass: "bg-red-100 text-red-700 border-red-200",
    };
  }
  if (status === "submitted") {
    return {
      label: "Submitted",
      badgeClass: "bg-indigo-100 text-indigo-700 border-indigo-200",
    };
  }
  return {
    label: "Requested",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  };
}

export default function ClientProgressReport() {
  const [, params] = useRoute("/app/client/progress-reports/:id");
  const reportId = params?.id;
  const { toast } = useToast();
  const { sessionUser, viewedUser, impersonating } = useAuth();
  const submitProgressReport = useSubmitProgressReport();
  const createClientVideoUploadTarget = useCreateClientVideoUploadTarget();

  const { data: report, isLoading } = useQuery({
    ...(reportId ? progressReportQuery(reportId) : progressReportQuery("")),
    enabled: Boolean(reportId),
  });
  const { data: allSessions = [] } = useQuery(sessionsQuery);

  const typedReport = report as ProgressReport | undefined;
  const [draft, setDraft] = useState<DraftMap>({});
  const [draftFiles, setDraftFiles] = useState<FileDraftMap>({});
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!typedReport) return;
    const nextDraft: DraftMap = {};
    for (const item of typedReport.items || []) {
      nextDraft[item.id] = {
        submissionLink: item.submissionLink || "",
        submissionNote: item.submissionNote || "",
      };
    }
    setDraft(nextDraft);
    const nextFiles: FileDraftMap = {};
    for (const item of typedReport.items || []) {
      nextFiles[item.id] = null;
    }
    setDraftFiles(nextFiles);
  }, [typedReport?.id, typedReport?.status, JSON.stringify(typedReport?.items || [])]);

  const isClientSession = sessionUser?.role === "Client";
  const isClientContextMatch = Boolean(
    sessionUser?.id && viewedUser?.id && sessionUser.id === viewedUser.id,
  );
  const isImpersonationReadOnly = impersonating || !isClientSession || !isClientContextMatch;
  const isEditableStatus =
    typedReport?.status === "requested" || typedReport?.status === "resubmission_requested";
  const submissionEditable = !isImpersonationReadOnly && isEditableStatus;
  const readOnly = !submissionEditable;

  const phaseExercisesById = useMemo(() => {
    const map = new Map<string, any>();
    if (!typedReport) return map;
    const phaseSessions = (allSessions as any[]).filter((session) => session.phaseId === typedReport.phaseId);
    for (const session of phaseSessions) {
      const sections = (session.sections as any[]) || [];
      for (const section of sections) {
        const exercises = (section?.exercises as any[]) || [];
        for (const exercise of exercises) {
          if (exercise?.id && !map.has(exercise.id)) {
            map.set(exercise.id, exercise);
          }
        }
      }
    }
    return map;
  }, [typedReport?.phaseId, allSessions]);

  const handleSubmit = async () => {
    if (!typedReport || !reportId || readOnly || submitProgressReport.isPending) return;

    try {
      const submissionItems: Array<{
        itemId: string;
        submissionSource: "link" | "upload";
        submissionLink?: string;
        submissionObjectKey?: string;
        submissionMimeType?: string | null;
        submissionOriginalFilename?: string | null;
        submissionNote?: string | null;
      }> = [];

      for (const item of typedReport.items) {
        const submissionNote = (draft[item.id]?.submissionNote || "").trim() || null;
        const fallbackLink = (draft[item.id]?.submissionLink || "").trim();
        const selectedFile = draftFiles[item.id];

        if (selectedFile) {
          if (!ALLOWED_CLIENT_VIDEO_TYPES.has(selectedFile.type)) {
            throw new Error(`Invalid video type for ${item.exerciseName}. Use mp4, mov, webm, mkv, or 3gp.`);
          }
          if (selectedFile.size > MAX_CLIENT_VIDEO_BYTES) {
            throw new Error(`Video for ${item.exerciseName} is too large. Maximum file size is 250MB.`);
          }
          setUploadingItemId(item.id);
          const uploadTarget = await createClientVideoUploadTarget.mutateAsync({
            purpose: "progress_report",
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            contentType: selectedFile.type,
          });
          await uploadClientVideoToObjectStorage({
            uploadUrl: uploadTarget.uploadUrl,
            file: selectedFile,
          });
          submissionItems.push({
            itemId: item.id,
            submissionSource: "upload",
            submissionObjectKey: uploadTarget.objectKey,
            submissionMimeType: selectedFile.type || null,
            submissionOriginalFilename: selectedFile.name || null,
            submissionNote,
          });
          continue;
        }

        if (!fallbackLink) {
          throw new Error(`Add a video upload or link for ${item.exerciseName}.`);
        }
        submissionItems.push({
          itemId: item.id,
          submissionSource: "link",
          submissionLink: fallbackLink,
          submissionNote,
        });
      }

      await submitProgressReport.mutateAsync({ reportId, items: submissionItems });
      toast({
        title: "Progress report submitted",
        description: "Your coach can now review your submissions.",
      });
    } catch (error) {
      toast({
        title: "Could not submit report",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingItemId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!typedReport) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">Progress report not found.</p>
        <Link href="/app/client/my-phase">
          <Button className="mt-4" variant="outline">Back to My Phase</Button>
        </Link>
      </div>
    );
  }

  const reportStatusMeta = getReportStatusMeta(typedReport.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
      <div className="flex items-center gap-3">
        <Link href="/app/client/my-phase">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Progress Report</h1>
          <p className="text-sm text-slate-500">Submit requested updates while continuing your normal training.</p>
          <p className="text-xs text-slate-500 mt-1">
            Describe measurable progress for each exercise, for example more reps, more weight, cleaner form, or longer holds.
          </p>
        </div>
        <Badge className={`ml-auto capitalize ${reportStatusMeta.badgeClass}`}>{reportStatusMeta.label}</Badge>
      </div>

      {isImpersonationReadOnly && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm rounded-2xl">
          <CardContent className="p-4 text-sm text-amber-800">
            Progress report is read-only in impersonation mode.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {typedReport.items.map((item) => {
          const exercise = phaseExercisesById.get(item.exerciseId);
          const name = exercise?.name || item.exerciseName;
          const hasFeedback = typeof item.feedbackNote === "string" && item.feedbackNote.trim().length > 0;
          return (
            <Card key={item.id} className="border-slate-200 shadow-sm rounded-2xl bg-white">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-lg">{name}</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <ExerciseStandardDetails exercise={{ ...exercise, name }} showName={false} />

                {submissionEditable ? (
                  <>
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <VideoUploadField
                        fileInputId={`submission-file-${item.id}`}
                        linkInputId={`submission-link-${item.id}`}
                        file={draftFiles[item.id] || null}
                        linkValue={draft[item.id]?.submissionLink || ""}
                        onFileChange={(nextFile) =>
                          setDraftFiles((prev) => ({ ...prev, [item.id]: nextFile }))
                        }
                        onLinkChange={(nextLink) =>
                          setDraft((prev) => ({
                            ...prev,
                            [item.id]: {
                              submissionLink: nextLink,
                              submissionNote: prev[item.id]?.submissionNote || "",
                            },
                          }))
                        }
                        disabled={readOnly}
                        fileTestId={`input-submission-video-file-${item.id}`}
                        linkTestId={`input-submission-video-link-${item.id}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`submission-note-${item.id}`}>Achieved parameters</Label>
                      <Textarea
                        id={`submission-note-${item.id}`}
                        placeholder="e.g. 2 more reps at same load, cleaner form, better control"
                        value={draft[item.id]?.submissionNote || ""}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            [item.id]: {
                              submissionLink: prev[item.id]?.submissionLink || "",
                              submissionNote: event.target.value,
                            },
                          }))
                        }
                        disabled={readOnly}
                      />
                    </div>
                  </>
                ) : (
                  <div className="pt-2 border-t border-slate-100 space-y-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-700 mb-2">Submission video</p>
                      {item.submissionPlaybackUrl || item.submissionLink ? (
                        <InlineVideoPlayer
                          url={item.submissionPlaybackUrl || item.submissionLink}
                          sourceType={item.submissionSource}
                          openLinkLabel="Open video"
                          testId={`progress-report-submission-video-${item.id}`}
                        />
                      ) : (
                        <p className="text-slate-500">No video submitted.</p>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Achieved parameters</p>
                      <p className="text-slate-700 whitespace-pre-wrap">
                        {item.submissionNote?.trim() || "No achieved parameters provided."}
                      </p>
                    </div>
                  </div>
                )}

                {hasFeedback ? (
                  <div
                    className={`rounded-lg p-3 text-sm ${
                      typedReport.status === "approved" || typedReport.status === "reviewed"
                        ? "border border-green-200 bg-green-50 text-green-900"
                        : typedReport.status === "resubmission_requested"
                          ? "border border-red-200 bg-red-50 text-red-900"
                          : "border border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                        typedReport.status === "approved" || typedReport.status === "reviewed"
                          ? "text-green-700"
                          : typedReport.status === "resubmission_requested"
                            ? "text-red-700"
                            : "text-amber-700"
                      }`}
                    >
                      Coach feedback
                    </p>
                    <p>{item.feedbackNote}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {submissionEditable ? (
        <div className="flex justify-end">
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
            disabled={readOnly || submitProgressReport.isPending || !!uploadingItemId}
            onClick={handleSubmit}
          >
            {submitProgressReport.isPending || uploadingItemId ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            {typedReport.status === "resubmission_requested" ? "Resubmit Progress Report" : "Submit Progress Report"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
