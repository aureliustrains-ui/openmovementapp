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
import { resolveUserFirstName } from "@/lib/userDisplayName";
import { ActionRequiredCard } from "@/components/client/ActionRequiredCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";
import { Loader2, ChevronRight } from "lucide-react";

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

  const guideVideoUrl =
    typeof progressPhase?.homeGuideVideoUrl === "string" && progressPhase.homeGuideVideoUrl.trim().length > 0
      ? progressPhase.homeGuideVideoUrl.trim()
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
  const dueCount =
    Number(progressNeedsAction) + Number(weeklyCheckinDue) + Number(movementActionCount > 0);

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

      <div className="grid grid-cols-1 gap-4">
        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
          <CardContent className="p-5 md:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Next movement session</p>
                <h2 className="text-2xl font-display font-bold tracking-tight text-slate-900">
                  {weekSchedulePreview.nextScheduleItem?.session.name || "No session scheduled"}
                </h2>
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

      {dueCount > 0 ? (
        <section className="space-y-3">
          {progressNeedsAction ? (
            <ActionRequiredCard
              title="Progress update"
              description="A progress update is requested for your active plan."
              ctaLabel="Open update"
              ctaHref={latestProgressReport ? `/app/client/progress-reports/${latestProgressReport.id}` : "/app/client/my-phase"}
              ctaVariant="secondaryDark"
              testId="card-home-progress-update"
            />
          ) : null}
          {movementActionCount > 0 ? (
            <ActionRequiredCard
              title="Movement check"
              description={
                movementActionCount === 1
                  ? "One movement check needs your input."
                  : `${movementActionCount} movement check items need your input.`
              }
              ctaLabel="Open movement checks"
              ctaHref="/app/client/my-phase#movement-checks"
              ctaVariant="secondaryDark"
              testId="card-home-movement-check"
            />
          ) : null}
          {weeklyCheckinDue ? (
            <ActionRequiredCard
              title="Weekly check-in"
              description="Your current training week is ready to close."
              ctaLabel="Complete weekly check-in"
              ctaHref="/app/client/my-phase?weeklyCheckin=1"
              ctaVariant="secondaryDark"
              testId="card-home-weekly-checkin"
            />
          ) : null}
        </section>
      ) : null}

    </div>
  );
}
