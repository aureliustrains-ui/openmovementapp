type ProgressStatus =
  | "requested"
  | "submitted"
  | "approved"
  | "resubmission_requested"
  | "reviewed";

export type ProgressReportSummary = {
  id: string;
  phaseId: string;
  status: ProgressStatus;
  createdAt: string;
};

export type ActionRequiredItem = {
  kind: "weekly_checkin" | "progress_report";
  id: string;
};

export function pickLatestProgressReportForPhase(
  reports: ProgressReportSummary[],
  phaseId: string,
): ProgressReportSummary | null {
  const inPhase = reports.filter((report) => report.phaseId === phaseId);
  if (inPhase.length === 0) return null;
  const sorted = [...inPhase].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sorted[0];
}

export function buildActionRequiredItems(input: {
  weeklyDue: boolean;
  weeklyWeekNumber: number | null;
  progressReport: ProgressReportSummary | null;
}): ActionRequiredItem[] {
  const items: ActionRequiredItem[] = [];
  if (input.weeklyDue && input.weeklyWeekNumber !== null) {
    items.push({ kind: "weekly_checkin", id: `weekly-${input.weeklyWeekNumber}` });
  }
  const progressReport = input.progressReport;
  const progressNeedsAction =
    progressReport &&
    (progressReport.status === "requested" ||
      progressReport.status === "resubmission_requested");

  if (progressNeedsAction) {
    items.push({ kind: "progress_report", id: progressReport.id });
  }
  return items;
}
