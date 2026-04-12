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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ProgressStatus = "requested" | "submitted" | "approved" | "resubmission_requested" | "reviewed";
type ActivePhaseProgressReport = {
  id: string;
  phaseId: string;
  status: ProgressStatus;
  createdAt: string;
};
type RecentActivityItem = {
  id: string;
  type: "Weekly" | "Session" | "Progress";
  submittedAt: string | null;
  detail: string;
  href?: string;
};

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const isMovementCheckBlocking = currentPhase?.status === "Waiting for Movement Check";
  const weeklyDue =
    Boolean((notificationSummary as { weeklyCheckinDue?: boolean } | undefined)?.weeklyCheckinDue) ||
    Boolean((weeklyCurrentOrDue as { due?: boolean } | undefined)?.due);
  const progressNeedsAction =
    latestProgressReport?.status === "requested" ||
    latestProgressReport?.status === "resubmission_requested";

  const dueCount = Number(weeklyDue) + Number(movementActionCount > 0) + Number(progressNeedsAction);

  const recentWeekly = [...(weeklyCheckins as Array<{ id: string; submittedAt?: string; phaseWeekNumber?: number | null }>)].sort(
    (a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")),
  );
  const recentSession = [...(sessionCheckins as Array<{ id: string; submittedAt?: string; rpeOverall?: number; sleepLastNight?: number | null }>)].sort(
    (a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")),
  );

  const movementSummary = {
    approved: movementChecks.filter((check) => check.status === "Approved").length,
    pending: movementChecks.filter((check) => check.status === "Pending").length,
  };
  const hasMovementInReview = movementSummary.pending > 0 || movementSummary.approved > 0;
  const hasProgressInReview =
    latestProgressReport?.status === "submitted" ||
    latestProgressReport?.status === "approved" ||
    latestProgressReport?.status === "reviewed";

  const recentActivity: RecentActivityItem[] = [
    ...recentWeekly.slice(0, 4).map((entry) => ({
      id: `weekly-${entry.id}`,
      type: "Weekly" as const,
      submittedAt: entry.submittedAt || null,
      detail: `Week ${entry.phaseWeekNumber ?? "—"} check-in submitted.`,
    })),
    ...recentSession.slice(0, 4).map((entry) => ({
      id: `session-${entry.id}`,
      type: "Session" as const,
      submittedAt: entry.submittedAt || null,
      detail: `Effort ${entry.rpeOverall ?? "—"}/10 · Sleep ${entry.sleepLastNight ?? "—"}/10`,
    })),
    ...(latestProgressReport && latestProgressReport.status !== "requested"
      ? [
          {
            id: `progress-${latestProgressReport.id}`,
            type: "Progress" as const,
            submittedAt: latestProgressReport.createdAt || null,
            detail: `Progress update status: ${getProgressStatusLabel(latestProgressReport.status)}.`,
            href: `/app/client/progress-reports/${latestProgressReport.id}`,
          },
        ]
      : []),
  ]
    .sort((a, b) => toTimestamp(b.submittedAt) - toTimestamp(a.submittedAt))
    .slice(0, 8);
  const recentActivityList = (
    <div className="divide-y divide-slate-100">
      {recentActivity.map((entry) => (
        <div key={entry.id} className="py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-3">
            <Badge variant="outline" className="border-slate-300 text-slate-700 text-[11px]">
              {entry.type}
            </Badge>
            <p className="text-xs text-slate-500">{formatDateLabel(entry.submittedAt)}</p>
          </div>
          <p className="mt-1 text-sm text-slate-700">{entry.detail}</p>
          {entry.href ? (
            <Link
              href={entry.href}
              className="mt-1 inline-block text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
            >
              Open
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
      <section>
        <h1 className="text-3xl font-display font-bold tracking-tight text-slate-900">Check-ins</h1>
      </section>

      {isReadOnly ? (
        <Card className="border-amber-200 bg-amber-50 shadow-sm rounded-xl">
          <CardContent className="p-4 text-sm text-amber-800">
            Check-in submissions are read-only unless you are logged in as this client account.
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-display font-bold text-slate-900">Action required</h2>
          <Badge variant="outline" className="border-slate-300 text-slate-700">
            {dueCount} open
          </Badge>
        </div>

        {dueCount === 0 ? (
          <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
            <CardContent className="p-4 text-sm text-slate-600">
              You are all caught up for now.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {movementActionCount > 0 && isMovementCheckBlocking ? (
              <ActionRequiredCard
                title="Movement check"
                description={`${movementActionCount} movement check item${movementActionCount === 1 ? "" : "s"} need${movementActionCount === 1 ? "s" : ""} your input.`}
                ctaLabel="Open movement checks"
                ctaHref="/app/client/my-phase#movement-checks"
                ctaDisabled={isReadOnly}
                ctaVariant="secondaryDark"
              />
            ) : null}

            {weeklyDue ? (
              <ActionRequiredCard
                title="Weekly check-in"
                description="Your current training week is ready to close."
                ctaLabel="Complete weekly check-in"
                ctaHref="/app/client/my-phase?weeklyCheckin=1"
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

            {movementActionCount > 0 && !isMovementCheckBlocking ? (
              <ActionRequiredCard
                title="Movement check"
                description={`${movementActionCount} movement check item${movementActionCount === 1 ? "" : "s"} need${movementActionCount === 1 ? "s" : ""} your input.`}
                ctaLabel="Open movement checks"
                ctaHref="/app/client/my-phase#movement-checks"
                ctaDisabled={isReadOnly}
                ctaVariant="secondaryDark"
              />
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-slate-900">In review</h2>
        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
          <CardContent className="p-4 space-y-3">
            {!hasMovementInReview && !hasProgressInReview ? (
              <p className="text-sm text-slate-600">No items are currently waiting for review.</p>
            ) : (
              <>
                {movementSummary.pending > 0 ? (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Movement checks</p>
                      <p className="text-xs text-slate-600">
                        {movementSummary.pending} pending coach review
                      </p>
                    </div>
                    <Badge variant="outline" className="border-slate-300 text-slate-700">
                      Pending review
                    </Badge>
                  </div>
                ) : null}
                {movementSummary.approved > 0 ? (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Movement checks</p>
                      <p className="text-xs text-slate-600">{movementSummary.approved} approved</p>
                    </div>
                    <Badge variant="outline" className="border-slate-300 text-slate-700">
                      Approved
                    </Badge>
                  </div>
                ) : null}
                {hasProgressInReview && latestProgressReport ? (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Progress update</p>
                      <p className="text-xs text-slate-600">
                        {getProgressStatusLabel(latestProgressReport.status)}
                      </p>
                    </div>
                    <Link
                      href={`/app/client/progress-reports/${latestProgressReport.id}`}
                      className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-slate-900">Trends</h2>
        <ClientReadinessSection compactForCheckins />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-slate-900">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
            <CardContent className="p-4">
              <p className="text-sm text-slate-600">No recent check-in activity yet.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="md:hidden">
              <details className="rounded-xl border border-slate-200 bg-white p-3" data-testid="details-checkins-recent-activity-mobile">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                  Show recent activity
                </summary>
                <div className="mt-2">{recentActivityList}</div>
              </details>
            </div>
            <Card className="hidden md:block border-slate-200 shadow-sm rounded-xl bg-white">
              <CardContent className="p-4">{recentActivityList}</CardContent>
            </Card>
          </>
        )}
      </section>
    </div>
  );
}
