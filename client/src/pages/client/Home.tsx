import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  phasesQuery,
  sessionsQuery,
  weeklyCheckinsMeQuery,
  myNotificationSummaryQuery,
  myActivePhaseProgressReportsQuery,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pickDefaultVisiblePhase } from "@/lib/clientPhase";
import { getWeekSchedulePreview } from "@/lib/clientSchedule";
import { resolveClientSessionEntryDestination } from "@/lib/sessionEntry";
import { getTrainingWeekLifecycle, type TrainingScheduleEntry } from "@/lib/trainingWeek";
import { getClientCounterpartDisplayName } from "@/lib/counterpartDisplayName";
import { cn } from "@/lib/utils";
import { resolveUserFirstName } from "@/lib/userDisplayName";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActionRequiredCard } from "@/components/client/ActionRequiredCard";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";
import { Loader2, CheckCircle2, ChevronRight, CalendarDays } from "lucide-react";

const PLAN_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function resolvePlanDayNumber(day: string | null | undefined): number | null {
  if (!day) return null;
  const dayIndex = PLAN_WEEKDAYS.findIndex((weekday) => weekday.toLowerCase() === day.toLowerCase());
  return dayIndex >= 0 ? dayIndex + 1 : null;
}

export default function ClientHome() {
  const { viewedUser, sessionUser, impersonating } = useAuth();
  const counterpartName = getClientCounterpartDisplayName();
  const isClientSession = sessionUser?.role === "Client";

  const { data: allPhases = [], isLoading: loadingPhases } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);
  const { data: weeklyCheckins = [] } = useQuery({
    ...weeklyCheckinsMeQuery,
    enabled: !!sessionUser && !impersonating,
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
  const activePhase = pickDefaultVisiblePhase(
    visiblePhases.filter((phase: any) => phase.status === "Active") as any[],
  );
  const progressPhase = activePhase || currentPhase;

  const phaseSchedule = ((progressPhase?.schedule as any[]) || []) as TrainingScheduleEntry[];
  const completedInstances = ((progressPhase?.completedScheduleInstances as string[]) || []) as string[];
  const phaseSessions = progressPhase
    ? allSessions.filter((session: any) => session.phaseId === progressPhase.id)
    : [];

  const weekLifecycle = progressPhase
    ? getTrainingWeekLifecycle(
        progressPhase.durationWeeks || 1,
        phaseSchedule,
        completedInstances,
        progressPhase.id,
        (weeklyCheckins as Array<{ phaseId?: string | null; phaseWeekNumber?: number | null }>) || [],
      )
    : null;
  const currentTrainingWeek = weekLifecycle?.currentWeek || 1;
  const currentWeekStatus =
    weekLifecycle?.weeks.find((status) => status.week === currentTrainingWeek) || null;

  const weekSchedulePreview = getWeekSchedulePreview(
    currentTrainingWeek,
    phaseSchedule,
    phaseSessions as Array<{ id: string; name: string }>,
    completedInstances,
  );
  const nextSessionDestination = weekSchedulePreview.nextScheduleItem
    ? resolveClientSessionEntryDestination({
        phase: progressPhase as any,
        sessionId: weekSchedulePreview.nextScheduleItem.session.id,
        week: weekSchedulePreview.nextScheduleItem.entry.week,
        day: weekSchedulePreview.nextScheduleItem.entry.day,
        slot: weekSchedulePreview.nextScheduleItem.entry.slot,
      })
    : null;
  const nextSessionWeek = weekSchedulePreview.nextScheduleItem?.entry.week ?? currentTrainingWeek;
  const nextSessionDayNumber = weekSchedulePreview.nextScheduleItem
    ? resolvePlanDayNumber(weekSchedulePreview.nextScheduleItem.entry.day)
    : null;

  const introVideoUrl =
    typeof progressPhase?.homeIntroVideoUrl === "string" && progressPhase.homeIntroVideoUrl.trim().length > 0
      ? progressPhase.homeIntroVideoUrl.trim()
      : null;
  const latestProgressReport = [...(activePhaseProgressReports as Array<{ id: string; phaseId: string; status: string; createdAt: string }>)].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  )[0];
  const progressNeedsAction =
    latestProgressReport?.status === "requested" || latestProgressReport?.status === "resubmission_requested";
  const weeklyCheckinDue = Boolean(
    (notificationSummary as { weeklyCheckinDue?: boolean } | undefined)?.weeklyCheckinDue,
  );
  const movementActionCount =
    (notificationSummary as { movementActionCount?: number } | undefined)?.movementActionCount || 0;
  const dueCount = Number(weeklyCheckinDue) + Number(movementActionCount > 0) + Number(progressNeedsAction);

  if (loadingPhases) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
      <section>
        <h1 className="text-3xl font-display font-bold tracking-tight text-slate-900">
          Good to see you,{" "}
          {resolveUserFirstName(
            viewedUser as {
              name?: string | null;
              firstName?: string | null;
              infos?: string | null;
              email?: string | null;
            },
          )}
          .
        </h1>
        <p className="mt-1 text-sm text-slate-500">Today&apos;s plan, your next session, and pending check-ins.</p>
      </section>

      {introVideoUrl ? (
        <section>
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">From {counterpartName}</p>
          <InlineVideoPlayer url={introVideoUrl} testId="client-home-intro-video" flush />
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
          <CardContent className="p-5 md:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-2xl font-display font-bold tracking-tight text-slate-900">Next session</h2>
                {weekSchedulePreview.nextScheduleItem ? (
                  <p className="text-sm text-slate-600 mt-1">
                    {nextSessionDayNumber !== null
                      ? `Week ${nextSessionWeek} • Day ${nextSessionDayNumber}`
                      : `Week ${nextSessionWeek}`}
                  </p>
                ) : null}
              </div>
              {weekSchedulePreview.nextScheduleItem && nextSessionDestination ? (
                <Link href={nextSessionDestination.href}>
                  <Button className="w-full sm:w-auto" data-testid="button-home-start-next-session">
                    Start session
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Link href={currentPhase ? "/app/client/my-phase" : "/app/client/home"}>
                  <Button variant="outline" className="w-full sm:w-auto" data-testid="button-home-open-phase-fallback">
                    Open plan
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        {dueCount === 0 ? (
          <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
            <CardContent className="p-4 text-sm text-slate-600">No pending check-ins right now.</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {weeklyCheckinDue ? (
              <ActionRequiredCard
                title="Weekly check-in"
                description="Your current training week is ready to close."
                ctaLabel="Open weekly check-in"
                ctaHref="/app/client/check-ins"
                ctaVariant="secondaryDark"
              />
            ) : null}
            {movementActionCount > 0 ? (
              <ActionRequiredCard
                title="Movement check"
                description={`${movementActionCount} movement check item${movementActionCount === 1 ? "" : "s"} need${movementActionCount === 1 ? "s" : ""} your input.`}
                ctaLabel="Open movement checks"
                ctaHref="/app/client/check-ins"
                ctaVariant="secondaryDark"
              />
            ) : null}
            {progressNeedsAction ? (
              <Card className="border-slate-200 shadow-sm rounded-xl bg-white" data-testid="card-home-progress-update">
                <CardContent className="p-3.5 md:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Progress update
                    </span>
                    <Link href={latestProgressReport ? `/app/client/progress-reports/${latestProgressReport.id}` : "/app/client/check-ins"}>
                      <Button variant="secondaryDark" size="sm" className="h-9 min-h-9 px-3 text-xs">
                        Open update
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </section>

      <section>
        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
          <CardContent className="p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
                <CalendarDays className="h-3.5 w-3.5 text-slate-600" />
                This week
              </div>
              <Link href="/app/client/my-phase" className="text-xs font-medium text-slate-600 hover:text-slate-900">
                Open plan
              </Link>
            </div>

            {weekSchedulePreview.sortedEntries.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No sessions scheduled this week.
              </div>
            ) : (
              <div className="space-y-2">
                {weekSchedulePreview.sortedEntries.map((item) => {
                  const dayNumber = resolvePlanDayNumber(item.entry.day);
                  return (
                  <Link
                    key={item.instanceKey}
                    href={resolveClientSessionEntryDestination({
                      phase: progressPhase as any,
                      sessionId: item.session.id,
                      week: item.entry.week,
                      day: item.entry.day,
                      slot: item.entry.slot,
                    }).href}
                    className="block"
                  >
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium truncate",
                            item.isCompleted ? "text-slate-500" : "text-slate-900",
                          )}
                        >
                          {item.session.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Week {item.entry.week}
                          {dayNumber !== null ? ` • Day ${dayNumber}` : ""}
                        </p>
                      </div>
                      {item.isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-brand-700)]">
                          <CheckCircle2 className="h-3 w-3" />
                          Done
                        </span>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </Link>
                )})}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
