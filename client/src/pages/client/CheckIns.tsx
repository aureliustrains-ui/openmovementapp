import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  myNotificationSummaryQuery,
  myActivePhaseProgressReportsQuery,
  phasesQuery,
  sessionCheckinsMeQuery,
  weeklyCheckinsCurrentOrDueQuery,
  weeklyCheckinsMeQuery,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pickDefaultVisiblePhase } from "@/lib/clientPhase";
import ClientReadinessSection from "@/components/client/ClientReadinessSection";
import { ActionRequiredCard } from "@/components/client/ActionRequiredCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ProgressStatus = "requested" | "submitted" | "approved" | "resubmission_requested" | "reviewed";
type ActivePhaseProgressReport = {
  id: string;
  phaseId: string;
  status: ProgressStatus;
  createdAt: string;
};

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function getProgressStatusLabel(status: ProgressStatus | null | undefined): string {
  if (status === "requested") return "Requested";
  if (status === "submitted") return "Submitted";
  if (status === "resubmission_requested") return "Resubmission requested";
  if (status === "approved") return "Approved";
  if (status === "reviewed") return "Reviewed";
  return "No update requested";
}

export default function ClientCheckIns() {
  const { viewedUser, sessionUser, impersonating } = useAuth();
  const isClientSession = sessionUser?.role === "Client";
  const isClientContextMatch = Boolean(
    sessionUser?.id && viewedUser?.id && sessionUser.id === viewedUser.id,
  );
  const isReadOnly = impersonating || !isClientSession || !isClientContextMatch;

  const { data: allPhases = [] } = useQuery(phasesQuery);
  const { data: weeklyCheckins = [] } = useQuery({
    ...weeklyCheckinsMeQuery,
    enabled: !!sessionUser && !impersonating && isClientSession,
  });
  const { data: weeklyCurrentOrDue } = useQuery({
    ...weeklyCheckinsCurrentOrDueQuery,
    enabled: !!sessionUser && !isReadOnly,
  });
  const { data: sessionCheckins = [] } = useQuery({
    ...sessionCheckinsMeQuery,
    enabled: !!sessionUser && !impersonating && isClientSession,
  });
  const { data: notificationSummary } = useQuery({
    ...myNotificationSummaryQuery,
    enabled: !!sessionUser && !impersonating && isClientSession,
  });
  const { data: activePhaseProgressReports = [] } = useQuery({
    ...myActivePhaseProgressReportsQuery,
    enabled: !!sessionUser && !impersonating && isClientSession,
  });

  if (!viewedUser) return null;

  const visiblePhases = allPhases.filter(
    (phase: any) =>
      phase.clientId === viewedUser.id &&
      (phase.status === "Active" || phase.status === "Waiting for Movement Check"),
  );
  const currentPhase = pickDefaultVisiblePhase(visiblePhases as any[]);
  const movementChecks = ((currentPhase?.movementChecks as any[]) || []) as Array<{
    status?: string;
  }>;

  const latestProgressReport = useMemo(() => {
    if (!currentPhase) return null;
    const inPhase = (activePhaseProgressReports as ActivePhaseProgressReport[]).filter(
      (report) => report.phaseId === currentPhase.id,
    );
    if (inPhase.length === 0) return null;
    return [...inPhase].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }, [activePhaseProgressReports, currentPhase]);

  const computedMovementActions = movementChecks.filter((check) => {
    const normalized = typeof check.status === "string" ? check.status.trim().toLowerCase() : "";
    return normalized === "not submitted" || normalized === "needs resubmission";
  }).length;

  const movementActionCount =
    (notificationSummary as { movementActionCount?: number } | undefined)?.movementActionCount ??
    computedMovementActions;
  const weeklyDue =
    Boolean((notificationSummary as { weeklyCheckinDue?: boolean } | undefined)?.weeklyCheckinDue) ||
    Boolean((weeklyCurrentOrDue as { due?: boolean } | undefined)?.due);
  const progressNeedsAction =
    latestProgressReport?.status === "requested" ||
    latestProgressReport?.status === "resubmission_requested";

  const dueCount = Number(weeklyDue) + (movementActionCount > 0 ? 1 : 0) + Number(progressNeedsAction);
  const progressCtaLabel =
    latestProgressReport &&
    (latestProgressReport.status === "requested" ||
      latestProgressReport.status === "resubmission_requested")
      ? "Open update"
      : "View update";

  const recentWeekly = [...(weeklyCheckins as Array<{ id: string; submittedAt?: string; phaseWeekNumber?: number | null }>)].sort(
    (a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")),
  ).slice(0, 3);
  const recentSession = [...(sessionCheckins as Array<{ id: string; submittedAt?: string; rpeOverall?: number; sleepLastNight?: number | null }>)].sort(
    (a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")),
  ).slice(0, 3);

  const movementSummary = {
    approved: movementChecks.filter((check) => check.status === "Approved").length,
    pending: movementChecks.filter((check) => check.status === "Pending").length,
    needsResubmission: movementChecks.filter((check) => check.status === "Needs Resubmission").length,
    notSubmitted: movementChecks.filter((check) => {
      const normalized = typeof check.status === "string" ? check.status.trim() : "";
      return !normalized || normalized === "Not Submitted";
    }).length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
      <section>
        <h1 className="text-3xl font-display font-bold tracking-tight text-slate-900">Check-ins</h1>
        <p className="mt-1 text-sm text-slate-500">Due items, recent submissions, and trends in one place.</p>
      </section>

      {isReadOnly ? (
        <Card className="border-amber-200 bg-amber-50 shadow-sm rounded-xl">
          <CardContent className="p-4 text-sm text-amber-800">
            Check-in submissions are read-only unless you are logged in as this client account.
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-bold text-slate-900">Due</h2>
          <Badge variant="outline" className="border-slate-300 text-slate-700">
            {dueCount} open
          </Badge>
        </div>

        {dueCount === 0 ? (
          <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
            <CardContent className="p-4 text-sm text-slate-600">
              You are all caught up.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {weeklyDue ? (
              <ActionRequiredCard
                title="Weekly check-in"
                description="Your current training week is ready to close."
                ctaLabel="Open weekly check-in"
                ctaHref="/app/client/my-phase"
                ctaDisabled={isReadOnly}
                ctaVariant="secondaryDark"
              />
            ) : null}

            {movementActionCount > 0 ? (
              <ActionRequiredCard
                title="Movement check"
                description={`${movementActionCount} movement check item${movementActionCount === 1 ? "" : "s"} need${movementActionCount === 1 ? "s" : ""} your input.`}
                ctaLabel="Open movement checks"
                ctaHref="/app/client/my-phase"
                ctaDisabled={isReadOnly}
                ctaVariant="secondaryDark"
              />
            ) : null}

            {progressNeedsAction ? (
              <ActionRequiredCard
                title="Progress update"
                description="A progress update is requested for your active plan."
                ctaLabel="Open update"
                ctaHref={latestProgressReport ? `/app/client/progress-reports/${latestProgressReport.id}` : "/app/client/my-phase"}
                ctaDisabled={isReadOnly}
                ctaVariant="secondaryDark"
              />
            ) : null}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent weekly check-ins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {recentWeekly.length === 0 ? (
              <p className="text-sm text-slate-500">No weekly check-ins yet.</p>
            ) : (
              recentWeekly.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">
                    Week {entry.phaseWeekNumber ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateLabel(entry.submittedAt)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent session reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {recentSession.length === 0 ? (
              <p className="text-sm text-slate-500">No session reviews yet.</p>
            ) : (
              recentSession.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">RPE {entry.rpeOverall ?? "—"}/10</p>
                  <p className="text-xs text-slate-500">
                    Sleep {entry.sleepLastNight ?? "—"}/10 · {formatDateLabel(entry.submittedAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Movement check status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-slate-700 space-y-1.5">
            <p>Approved: {movementSummary.approved}</p>
            <p>Pending review: {movementSummary.pending}</p>
            <p>Needs resubmission: {movementSummary.needsResubmission}</p>
            <p>Not submitted: {movementSummary.notSubmitted}</p>
            <div className="pt-2">
              <Link href="/app/client/my-phase" className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline">
                Open Plan
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progress update status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-slate-700 space-y-1.5">
            <p>{getProgressStatusLabel((latestProgressReport?.status || null) as ProgressStatus | null)}</p>
            {latestProgressReport ? (
              <p className="text-xs text-slate-500">Requested {formatDateLabel(latestProgressReport.createdAt)}</p>
            ) : (
              <p className="text-xs text-slate-500">No update requested for your active plan.</p>
            )}
            {latestProgressReport ? (
              <div className="pt-2">
                <Link
                  href={`/app/client/progress-reports/${latestProgressReport.id}`}
                  className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
                >
                  {progressCtaLabel}
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-slate-900">Trends</h2>
        <ClientReadinessSection showFullDetails />
      </section>
    </div>
  );
}
