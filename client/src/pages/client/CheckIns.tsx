import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  sessionsQuery,
  myNotificationSummaryQuery,
  myActivePhaseProgressReportsQuery,
  phasesQuery,
  sessionCheckinsMeQuery,
  weeklyCheckinsCurrentOrDueQuery,
  weeklyCheckinsMeQuery,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pickDefaultVisiblePhase } from "@/lib/clientPhase";
import { buildWeekHistory } from "@/lib/weekHistory";
import { getTrainingWeekLifecycle, type TrainingScheduleEntry } from "@/lib/trainingWeek";
import { ActionRequiredCard } from "@/components/client/ActionRequiredCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ProgressStatus =
  | "requested"
  | "submitted"
  | "approved"
  | "resubmission_requested"
  | "reviewed";
type ActivePhaseProgressReport = {
  id: string;
  phaseId: string;
  status: ProgressStatus;
  createdAt: string;
};
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
  const { data: allSessions = [] } = useQuery(sessionsQuery);
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
    Boolean(
      (notificationSummary as { weeklyCheckinDue?: boolean } | undefined)?.weeklyCheckinDue,
    ) || Boolean((weeklyCurrentOrDue as { due?: boolean } | undefined)?.due);
  const progressNeedsAction =
    latestProgressReport?.status === "requested" ||
    latestProgressReport?.status === "resubmission_requested";

  const dueCount =
    Number(weeklyDue) + Number(movementActionCount > 0) + Number(progressNeedsAction);

  const movementSummary = {
    approved: movementChecks.filter((check) => check.status === "Approved").length,
    pending: movementChecks.filter((check) => check.status === "Pending").length,
  };
  const hasMovementInReview = movementSummary.pending > 0 || movementSummary.approved > 0;
  const hasProgressInReview =
    latestProgressReport?.status === "submitted" ||
    latestProgressReport?.status === "approved" ||
    latestProgressReport?.status === "reviewed";

  const phaseSchedule = ((currentPhase?.schedule as any[]) || []) as TrainingScheduleEntry[];
  const completedInstances = ((currentPhase?.completedScheduleInstances as string[]) ||
    []) as string[];
  const lifecycle = currentPhase
    ? getTrainingWeekLifecycle(
        currentPhase.durationWeeks || 1,
        phaseSchedule,
        completedInstances,
        currentPhase.id,
        weeklyCheckins as Array<{ phaseId?: string | null; phaseWeekNumber?: number | null }>,
      )
    : null;
  const weekHistory = currentPhase
    ? buildWeekHistory({
        phaseId: currentPhase.id,
        durationWeeks: currentPhase.durationWeeks || 1,
        schedule: phaseSchedule,
        completedInstances,
        phaseSessionIds: (allSessions as Array<{ id: string; phaseId?: string }>)
          .filter((session) => session.phaseId === currentPhase.id)
          .map((session) => session.id),
        weeklyRecaps: weeklyCheckins as any[],
        sessionRecaps: sessionCheckins as any[],
        currentWeek: lifecycle?.currentWeek || 1,
      })
    : [];
  const showInReview = hasMovementInReview || hasProgressInReview;

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in">
      {isReadOnly ? (
        <Card className="border-amber-200 bg-amber-50 shadow-sm rounded-xl">
          <CardContent className="p-4 text-sm text-amber-800">
            Recap submissions are read-only unless you are logged in as this client account.
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3" data-testid="section-recaps-due">
        <h2 className="text-xl font-display font-bold text-slate-900">Due now</h2>
        {dueCount === 0 ? (
          <p className="text-sm text-slate-600">Nothing due. You are all caught up.</p>
        ) : (
          <div className="space-y-3">
            {movementActionCount > 0 ? (
              <ActionRequiredCard
                title="Progress update"
                description={`${movementActionCount} progress update item${movementActionCount === 1 ? "" : "s"} need${movementActionCount === 1 ? "s" : ""} your input.`}
                ctaLabel="Open progress update"
                ctaHref="/app/client/my-phase#movement-checks"
                ctaDisabled={isReadOnly}
                ctaVariant="secondaryDark"
              />
            ) : null}
            {weeklyDue ? (
              <ActionRequiredCard
                title="Weekly recap"
                description="Your current training week is ready to close."
                ctaLabel="Complete weekly recap"
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
                ctaHref={
                  latestProgressReport
                    ? `/app/client/progress-reports/${latestProgressReport.id}`
                    : "/app/client/my-phase"
                }
                ctaDisabled={isReadOnly}
                ctaVariant="secondaryDark"
              />
            ) : null}
          </div>
        )}
      </section>

      {showInReview ? (
        <section className="space-y-3">
          <h2 className="text-xl font-display font-bold text-slate-900">With your coach</h2>
          <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
            <CardContent className="p-4 space-y-3">
              {movementSummary.pending > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-900">Progress updates</p>
                  <Badge variant="outline" className="border-slate-300 text-slate-700">
                    {movementSummary.pending} waiting for review
                  </Badge>
                </div>
              ) : null}
              {movementSummary.approved > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-900">Progress updates</p>
                  <Badge variant="outline" className="border-slate-300 text-slate-700">
                    {movementSummary.approved} approved
                  </Badge>
                </div>
              ) : null}
              {hasProgressInReview && latestProgressReport ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-900">Progress update</p>
                  <Link
                    href={`/app/client/progress-reports/${latestProgressReport.id}`}
                    className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
                  >
                    {getProgressStatusLabel(latestProgressReport.status)} · Open
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-3" data-testid="section-recaps-weeks">
        <h2 className="text-xl font-display font-bold text-slate-900">Your weeks</h2>
        {weekHistory.length === 0 ? (
          <p className="text-sm text-slate-600">Your weeks will show up here once you start.</p>
        ) : (
          <div className="space-y-2">
            {weekHistory.map((item) => (
              <Card
                key={item.week}
                className="border-slate-200 shadow-sm rounded-xl bg-white"
                data-testid={`card-recap-week-${item.week}`}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">Week {item.week}</p>
                    <Badge
                      variant="outline"
                      className={
                        item.recap
                          ? "border-[var(--color-brand-500)] text-[var(--color-brand-700)]"
                          : "border-slate-300 text-slate-600"
                      }
                    >
                      {item.recap ? "Done" : item.isCurrent ? "This week" : "Open"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">Sessions</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.completedCount}/{item.scheduledCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">Effort</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.averageEffort !== null ? `${item.averageEffort}/10` : "–"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">Recovery</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.recap?.recovery != null ? `${item.recap.recovery}/5` : "–"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
