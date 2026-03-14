import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";

type ReviewStatus = "requested" | "submitted" | "reviewed" | "approved" | "resubmission_requested";

type Props = {
  exerciseName: string;
  status: ReviewStatus;
  submittedAt?: string | null;
  submittedLabel?: string;
  videoUrl?: string | null;
  videoSource?: "upload" | "link" | string | null;
  noteLabel?: string;
  note?: string | null;
  actions?: ReactNode;
  testId?: string;
};

const statusStyles: Record<ReviewStatus, string> = {
  requested: "bg-amber-100 text-amber-700 border-amber-200",
  submitted: "bg-indigo-100 text-indigo-700 border-indigo-200",
  reviewed: "bg-green-100 text-green-700 border-green-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  resubmission_requested: "bg-red-100 text-red-700 border-red-200",
};

export function ReviewSubmissionRow({
  exerciseName,
  status,
  submittedAt,
  submittedLabel = "Submitted",
  videoUrl,
  videoSource,
  noteLabel,
  note,
  actions,
  testId,
}: Props) {
  const statusLabel = status === "resubmission_requested" ? "resubmission requested" : status;

  return (
    <div className="p-5 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between hover:bg-slate-50/50 transition-colors" data-testid={testId}>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${statusStyles[status]} capitalize`}>
            {statusLabel}
          </Badge>
          {submittedAt ? (
            <span className="text-xs text-slate-500">
              {submittedLabel} {new Date(submittedAt).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        <h4 className="font-semibold text-lg text-slate-900">{exerciseName}</h4>
        {note ? (
          <div className="mt-2 text-sm bg-slate-50 text-slate-800 p-2 rounded-lg border border-slate-100">
            <span className="font-bold">{noteLabel || "Note"}:</span> {note}
          </div>
        ) : null}
      </div>

      <div className="w-full md:w-[360px] shrink-0 space-y-3">
        {videoUrl ? (
          <InlineVideoPlayer url={videoUrl} sourceType={videoSource} openLinkLabel="Open video" />
        ) : (
          <div className="text-sm text-slate-400 italic">No video submitted</div>
        )}
        {actions}
      </div>
    </div>
  );
}
