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
import {
  findBlockingProgressReport,
  progressReportHref,
  resolveClientSessionEntryDestination,
} from "@/lib/sessionEntry";
import { getTrainingWeekLifecycle, type TrainingScheduleEntry } from "@/lib/trainingWeek";
import { resolveUserFirstName } from "@/lib/userDisplayName";
import { ActionRequiredCard } from "@/components/client/ActionRequiredCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CoachNoteBox } from "@/components/client/CoachNoteBox";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";
import { Loader2, ChevronRight, CheckCircle2, Circle } from "lucide-react";

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ClientHome() {
  const { viewedUser, sessionUser, impersonating } = useAuth();
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
  const completedInstances = ((progressPhase?.completedScheduleInstances as string[]) ||
    []) as string[];
  const phaseSessions = progressPhase
    ? allSessions.filter((session: any) => session.phaseId === progressPhase.id)
    : [];

  const weekLifecycle = progressPhase
    ? getTrainingWeekLifecycle(
        progressPhase.durationWeeks || 1,
        phaseSchedule,
        completedInstances,
        progressPhase.id,
        (weeklyCheckins as Array<{ phaseId?: string | null; phaseWeekNumber?: number | null }>) ||
          [],
      )
    : null;
  const currentTrainingWeek = weekLifecycle?.currentWeek || 1;
  const currentWeekStatus = weekLifecycle?.weeks.find((week) => week.week === currentTrainingWeek);
  // All sessions of the week are done, only the weekly recap is missing.
  const weekReadyToClose = currentWeekStatus?.state === "ready_for_checkin";
  const phaseDurationWeeks = progressPhase?.durationWeeks || 1;
  const isLastWeek = currentTrainingWeek >= phaseDurationWeeks;

  const weekSchedulePreview = getWeekSchedulePreview(
    currentTrainingWeek,
    phaseSchedule,
    phaseSessions as Array<{ id: string; name: string }>,
    completedInstances,
  );
  const weekEntries = weekSchedulePreview.sortedEntries;
  const weekDoneCount = weekEntries.filter((item) => item.isCompleted).length;
  const weekProgressPercent =
    weekEntries.length > 0 ? Math.round((weekDoneCount / weekEntries.length) * 100) : 0;
  const nextItemKey = weekEntries.find((item) => !item.isCompleted)?.instanceKey ?? null;
  const blockingReport = findBlockingProgressReport(activePhaseProgressReports as any[]);
  const blockingReportHref = blockingReport?.id ? progressReportHref(blockingReport.id) : null;
  const destinationFor = (item: (typeof weekEntries)[number]) =>
    resolveClientSessionEntryDestination({
      blockingReportHref,
      phase: progressPhase as any,
      sessionId: item.session.id,
      week: item.entry.week,
      day: item.entry.day,
      slot: item.entry.slot,
    });

  const nextSessionDestination = weekSchedulePreview.nextScheduleItem
    ? resolveClientSessionEntryDestination({
        blockingReportHref,
        phase: progressPhase as any,
        sessionId: weekSchedulePreview.nextScheduleItem.session.id,
        week: weekSchedulePreview.nextScheduleItem.entry.week,
        day: weekSchedulePreview.nextScheduleItem.entry.day,
        slot: weekSchedulePreview.nextScheduleItem.entry.slot,
      })
    : null;

  const guideVideoUrl =
    typeof progressPhase?.homeGuideVideoUrl === "string" &&
    progressPhase.homeGuideVideoUrl.trim().length > 0
      ? progressPhase.homeGuideVideoUrl.trim()
      : null;
  const introVideoUrl =
    typeof progressPhase?.homeIntroVideoUrl === "string" &&
    progressPhase.homeIntroVideoUrl.trim().length > 0
      ? progressPhase.homeIntroVideoUrl.trim()
      : null;
  const latestProgressReport = [
    ...(activePhaseProgressReports as Array<{
      id: string;
      phaseId: string;
      status: string;
      createdAt: string;
    }>),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const progressNeedsAction =
    latestProgressReport?.status === "requested" ||
    latestProgressReport?.status === "resubmission_requested";
  const weeklyCheckinDue = Boolean(
    (notificationSummary as { weeklyCheckinDue?: boolean } | undefined)?.weeklyCheckinDue,
  );
  const movementActionCount =
    (notificationSummary as { movementActionCount?: number } | undefined)?.movementActionCount || 0;
  // When the week is ready to close, the weekly recap is the main card (below) instead of a
  // secondary action card.
  const showWeeklyActionCard = weeklyCheckinDue && !weekReadyToClose;
  const dueCount =
    Number(progressNeedsAction) + Number(showWeeklyActionCard) + Number(movementActionCount > 0);

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
      </section>

      {guideVideoUrl ? (
        <section>
          <InlineVideoPlayer url={guideVideoUrl} testId="client-home-guide-video" flush />
        </section>
      ) : null}

      {introVideoUrl ? (
        <section>
          <InlineVideoPlayer url={introVideoUrl} testId="client-home-intro-video" flush />
        </section>
      ) : null}

      {dueCount > 0 ? (
        <section className="space-y-3">
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
              ctaVariant="secondaryDark"
              testId="card-home-progress-update"
            />
          ) : null}
          {movementActionCount > 0 ? (
            <ActionRequiredCard
              title="Progress update"
              description={
                movementActionCount === 1
                  ? "One progress update needs your input."
                  : `${movementActionCount} progress update items need your input.`
              }
              ctaLabel="Open progress update"
              ctaHref="/app/client/my-phase#movement-checks"
              ctaVariant="secondaryDark"
              testId="card-home-movement-check"
            />
          ) : null}
          {showWeeklyActionCard ? (
            <ActionRequiredCard
              title="Weekly recap"
              description="Your current training week is ready to close."
              ctaLabel="Complete weekly recap"
              ctaHref="/app/client/my-phase?weeklyCheckin=1"
              ctaVariant="secondaryDark"
              testId="card-home-weekly-checkin"
            />
          ) : null}
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        {weekReadyToClose && currentWeekStatus ? (
          <Card
            className="border-[var(--color-brand-500)] shadow-sm rounded-xl bg-[var(--color-brand-100)]"
            data-testid="card-home-week-ready-to-close"
          >
            <CardContent className="p-5 md:p-6 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--color-brand-700)]">
                  Week {currentTrainingWeek} of {phaseDurationWeeks} done
                </p>
                <h2 className="text-2xl font-display font-bold tracking-tight text-slate-900">
                  {currentWeekStatus.completedCount}/{currentWeekStatus.scheduledCount} sessions completed
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  {isLastWeek
                    ? "Close the week with a short recap to finish this phase."
                    : `Close the week with a short recap to unlock week ${currentTrainingWeek + 1}.`}
                </p>
              </div>
              <Link href="/app/client/my-phase?weeklyCheckin=1">
                <Button className="w-full sm:w-auto" data-testid="button-home-weekly-recap">
                  Complete weekly recap
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
        <Card
          className="border-slate-200 shadow-sm rounded-xl bg-white"
          data-testid="card-home-this-week"
        >
          <CardContent className="p-5 md:p-6 space-y-4">
            {progressPhase ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Week {currentTrainingWeek} of {phaseDurationWeeks}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[var(--color-brand-600)] transition-all"
                    style={{ width: `${weekProgressPercent}%` }}
                  />
                </div>
              </div>
            ) : null}

            {weekEntries.length > 0 ? (
              <ul className="divide-y divide-slate-100" data-testid="list-home-week-sessions">
                {WEEKDAY_NAMES.flatMap((dayName, dayIdx) => {
                  const dayItems = weekEntries.filter((entry) => entry.dayIndex === dayIdx);
                  if (dayItems.length === 0) {
                    return [
                      <li
                        key={`rest-${dayName}`}
                        className="flex items-center gap-3 py-2.5 text-slate-300"
                        data-testid={`home-day-empty-${dayName}`}
                      >
                        <span className="h-5 w-5 shrink-0" />
                        <span className="w-12 shrink-0 text-xs uppercase tracking-wider">
                          {dayName.slice(0, 3)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">No session</span>
                      </li>,
                    ];
                  }
                  return dayItems.map((item, itemIdx) => {
                    const isNext = item.instanceKey === nextItemKey;
                    return (
                      <li key={item.instanceKey}>
                        <Link
                          href={destinationFor(item).href}
                          className={`flex items-center gap-3 py-2.5 ${
                            isNext ? "text-slate-900" : "text-slate-600"
                          }`}
                        >
                          {item.isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-brand-600)]" />
                          ) : (
                            <Circle
                              className={`h-5 w-5 shrink-0 ${
                                isNext ? "text-[var(--color-brand-600)]" : "text-slate-300"
                              }`}
                            />
                          )}
                          <span className="w-12 shrink-0 text-xs uppercase tracking-wider text-slate-400">
                            {itemIdx === 0 ? dayName.slice(0, 3) : ""}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate ${
                              item.isCompleted ? "text-slate-400 line-through" : ""
                            }`}
                          >
                            {item.session.name}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                        </Link>
                      </li>
                    );
                  });
                })}
              </ul>
            ) : null}

            {weekSchedulePreview.nextScheduleItem && nextSessionDestination && nextItemKey ? (
              <Link href={nextSessionDestination.href}>
                <Button className="w-full" data-testid="button-home-start-next-session">
                  Start {weekSchedulePreview.nextScheduleItem.session.name}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href={currentPhase ? "/app/client/my-phase" : "/app/client/home"}>
                <Button
                  variant="outline"
                  className="w-full"
                  data-testid="button-home-open-phase-fallback"
                >
                  {currentPhase ? "Open plan" : "No plan yet"}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      <CoachNoteBox clientId={viewedUser.id} disabled={!isClientSession || impersonating} />
    </div>
  );
}
