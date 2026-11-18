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
  /** Short facts shown as small tags, e.g. "Must send before training", "10 kg", "8 reps", "Form 4/5". */
  tags?: string[];
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
  tags,
}: Props) {
  const statusLabel = status === "resubmission_requested" ? "resubmission requested" : status;

  return (
    <div
      className="grid gap-5 p-5 transition-colors hover:bg-slate-50/50 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-start"
      data-testid={testId}
    >
      <div className="min-w-0">
        {videoUrl ? (
          <InlineVideoPlayer url={videoUrl} sourceType={videoSource} openLinkLabel="Open video" flush />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm italic text-slate-400">
            No video submitted
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`${statusStyles[status]} capitalize`}>
              {statusLabel}
            </Badge>
            {submittedAt ? (
              <span className="text-xs text-slate-500">
                {submittedLabel} {new Date(submittedAt).toLocaleDateString()}
              </span>
            ) : null}
          </div>
          <h4 className="text-lg font-semibold text-slate-900">{exerciseName}</h4>
          {tags && tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {note ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-sm text-slate-800">
            <span className="font-bold">{noteLabel || "Note"}:</span> {note}
          </div>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
