import type { Phase, ProgressReport, ProgressReportItem } from "@shared/schema";

type MovementCheckLike = {
  status?: unknown;
};

type MessageLike = {
  clientId: string;
  isClient: boolean;
  time: string;
};

export type ProgressReportWithItems = {
  report: ProgressReport;
  items: ProgressReportItem[];
};

type ProgressItemReviewStatus = "requested" | "submitted" | "approved" | "resubmission_requested";

function normalizeStatusToken(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isTimestampAfter(left: string, right: string): boolean {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
    return leftMs > rightMs;
  }
  return left > right;
}

function parseMovementChecks(input: unknown): MovementCheckLike[] {
  if (Array.isArray(input)) {
    return input.filter(
      (entry): entry is MovementCheckLike => Boolean(entry) && typeof entry === "object",
    );
  }
  if (typeof input !== "string") return [];
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is MovementCheckLike => Boolean(entry) && typeof entry === "object",
        )
      : [];
  } catch {
    return [];
  }
}

function isMovementCheckApproved(status: unknown): boolean {
  return normalizeStatusToken(status) === "approved";
}

function isMovementCheckPendingReview(status: unknown): boolean {
  return normalizeStatusToken(status) === "pending";
}

function isMovementCheckClientAction(status: unknown): boolean {
  const token = normalizeStatusToken(status);
  return token === "not submitted" || token === "needs resubmission";
}

export function countAdminMovementAttention(phases: Phase[]): number {
  let count = 0;
  for (const phase of phases) {
    if (phase.status !== "Waiting for Movement Check") continue;
    const checks = parseMovementChecks(phase.movementChecks);
    for (const check of checks) {
      if (isMovementCheckPendingReview(check.status)) count += 1;
    }
  }
  return count;
}

export function countClientMovementActions(currentPhase: Phase | null | undefined): number {
  if (!currentPhase) return 0;
  const checks = parseMovementChecks(currentPhase.movementChecks);
  if (checks.length === 0) return 0;
  let count = 0;
  for (const check of checks) {
    if (isMovementCheckClientAction(check.status)) count += 1;
  }
  if (count === 0 && currentPhase.status === "Waiting for Movement Check") {
    // Defensive fallback for stale statuses without explicit check statuses.
    const hasUnapproved = checks.some((check) => !isMovementCheckApproved(check.status));
    if (hasUnapproved) return 1;
  }
  return count;
}

function hasSubmission(item: ProgressReportItem): boolean {
  const hasLink = typeof item.submissionLink === "string" && item.submissionLink.trim().length > 0;
  const hasObjectKey =
    typeof item.submissionObjectKey === "string" && item.submissionObjectKey.trim().length > 0;
  return hasLink || hasObjectKey;
}

export function normalizeProgressItemReviewStatus(
  item: ProgressReportItem,
  reportStatus: string,
): ProgressItemReviewStatus {
  if (
    item.reviewStatus === "requested" ||
    item.reviewStatus === "submitted" ||
    item.reviewStatus === "approved" ||
    item.reviewStatus === "resubmission_requested"
  ) {
    return item.reviewStatus;
  }
  if (reportStatus === "approved" || reportStatus === "reviewed") return "approved";
  if (reportStatus === "resubmission_requested") return "resubmission_requested";
  if (reportStatus === "submitted" && hasSubmission(item)) return "submitted";
  return "requested";
}

export function countAdminProgressAttention(reportItems: ProgressReportWithItems[]): number {
  let count = 0;
  for (const entry of reportItems) {
    for (const item of entry.items) {
      if (normalizeProgressItemReviewStatus(item, entry.report.status) === "submitted") {
        count += 1;
      }
    }
  }
  return count;
}

export function countClientProgressActions(
  reports: ProgressReport[],
  activePhaseId: string | null | undefined,
): number {
  if (!activePhaseId) return 0;
  return reports.filter(
    (report) =>
      report.phaseId === activePhaseId &&
      (report.status === "requested" || report.status === "resubmission_requested"),
  ).length;
}

export function countUnreadMessagesForClient(
  messages: MessageLike[],
  clientId: string,
  lastReadAt: string,
): number {
  return messages.filter(
    (message) =>
      message.clientId === clientId &&
      !message.isClient &&
      isTimestampAfter(message.time, lastReadAt),
  ).length;
}

export function countUnreadMessagesForAdminConversation(
  messages: MessageLike[],
  clientId: string,
  lastReadAt: string,
): number {
  return messages.filter(
    (message) =>
      message.clientId === clientId &&
      message.isClient &&
      isTimestampAfter(message.time, lastReadAt),
  ).length;
}
