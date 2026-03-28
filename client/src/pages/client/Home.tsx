import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  phasesQuery,
  sessionsQuery,
  weeklyCheckinsMeQuery,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pickDefaultVisiblePhase } from "@/lib/clientPhase";
import { buildScheduleInstanceKey, getWeekSchedulePreview } from "@/lib/clientSchedule";
import { resolveClientSessionEntryDestination } from "@/lib/sessionEntry";
import { getTrainingWeekLifecycle, type TrainingScheduleEntry } from "@/lib/trainingWeek";
import { getClientCounterpartDisplayName } from "@/lib/counterpartDisplayName";
import { cn } from "@/lib/utils";
import { resolveUserFirstName } from "@/lib/userDisplayName";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HomeChatCard } from "@/components/client/HomeChatCard";
import ClientReadinessSection from "@/components/client/ClientReadinessSection";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";
import { Loader2, CheckCircle2, ChevronRight, CalendarDays } from "lucide-react";

function getActivePlanCompletion(phase: any | null): {
  completedInstances: number;
  totalInstances: number;
  percent: number;
} {
  if (!phase) {
    return { completedInstances: 0, totalInstances: 0, percent: 0 };
  }

  const schedule = ((phase.schedule as any[]) || []) as TrainingScheduleEntry[];
  const expectedKeys = schedule
    .map((entry) => {
      if (typeof entry.sessionId !== "string" || entry.sessionId.length === 0) return null;
      const week = typeof entry.week === "number" && entry.week > 0 ? entry.week : 1;
      const day = typeof entry.day === "string" && entry.day.length > 0 ? entry.day : "Monday";
      const slot = typeof entry.slot === "string" && entry.slot.length > 0 ? entry.slot : "AM";
      return buildScheduleInstanceKey(week, day, slot, entry.sessionId);
    })
    .filter((key): key is string => typeof key === "string");
  const expectedSet = new Set(expectedKeys);
  const completedSet = new Set(
    (((phase.completedScheduleInstances as string[]) || []) as string[]).filter(
      (value): value is string => typeof value === "string",
    ),
  );
  const completedInstances = Array.from(expectedSet).filter((key) => completedSet.has(key)).length;
  const totalInstances = expectedSet.size;
  const percent =
    totalInstances > 0 ? Math.max(0, Math.min(100, Math.round((completedInstances / totalInstances) * 100))) : 0;

  return { completedInstances, totalInstances, percent };
}

export default function ClientHome() {
  const { viewedUser, sessionUser, impersonating } = useAuth();
  const counterpartName = getClientCounterpartDisplayName();

  const { data: allPhases = [], isLoading: loadingPhases } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);
  const { data: weeklyCheckins = [] } = useQuery({
    ...weeklyCheckinsMeQuery,
    enabled: !!sessionUser && !impersonating,
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

  const weeklyScheduledCount = currentWeekStatus?.scheduledCount || 0;
  const weeklyCompletedCount = currentWeekStatus?.completedCount || 0;
  const activePlanCompletion = getActivePlanCompletion(activePhase);
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

  const primaryProgressCopy =
    activePlanCompletion.totalInstances > 0
      ? `${activePlanCompletion.percent}% of current phase complete`
      : "Your plan is ready to start";
  const mobilePrimaryProgressCopy =
    activePlanCompletion.totalInstances > 0 ? `${activePlanCompletion.percent}% complete` : "Plan ready";
  const weeklyProgressCopy =
    weeklyScheduledCount > 0 &&
    (currentWeekStatus?.state === "ready_for_checkin" || weeklyCompletedCount >= weeklyScheduledCount)
      ? "Training week complete"
      : `${weeklyCompletedCount} of ${weeklyScheduledCount} sessions done this week`;
  const introVideoUrl =
    typeof progressPhase?.homeIntroVideoUrl === "string" && progressPhase.homeIntroVideoUrl.trim().length > 0
      ? progressPhase.homeIntroVideoUrl.trim()
      : null;

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
        <p className="mt-1 text-sm text-slate-500">Here&apos;s your week at a glance.</p>
      </section>

      {introVideoUrl ? (
        <section>
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">From {counterpartName}</p>
          <InlineVideoPlayer url={introVideoUrl} testId="client-home-intro-video" />
        </section>
      ) : null}

      <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
        <CardContent className="p-5 md:p-6 space-y-4">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Progress</p>
              <h2 className="text-[1.55rem] leading-tight font-semibold text-slate-800 sm:text-2xl">
                <span className="sm:hidden">{mobilePrimaryProgressCopy}</span>
                <span className="hidden sm:inline">{primaryProgressCopy}</span>
              </h2>
            </div>
            <p className="text-sm text-slate-500 whitespace-nowrap sm:text-right">Week {currentTrainingWeek}</p>
          </div>
          <div className="relative h-2 w-full rounded-full bg-[var(--color-ui-hover)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-brand-700)] transition-all"
              style={{ width: `${activePlanCompletion.totalInstances > 0 ? activePlanCompletion.percent : 0}%` }}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-[2px]">
              {[25, 50, 75, 100].map((mark) => (
                <span
                  key={mark}
                  className={cn(
                    "h-1.5 w-px rounded-full",
                    activePlanCompletion.percent >= mark ? "bg-slate-500" : "bg-slate-300",
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">{weeklyProgressCopy}</p>
            {currentPhase ? (
              <Link href="/app/client/my-phase">
                <Button
                  variant="outline"
                  className="h-8 w-full border-[var(--color-ui-border)] bg-[var(--color-ui-hover)] text-slate-900 hover:border-slate-400 hover:bg-[var(--color-ui-surface)] active:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:w-auto"
                  data-testid="button-home-go-to-current-phase"
                >
                  Open phase
                </Button>
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 border-slate-200 shadow-sm rounded-2xl bg-white">
          <CardContent className="p-5 md:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Next up</p>
                <h2 className="text-2xl font-display font-bold tracking-tight text-slate-900">Start next session</h2>
                {weekSchedulePreview.nextScheduleItem ? (
                  <p className="text-sm text-slate-600 mt-1">
                    Week {currentTrainingWeek} · {weekSchedulePreview.nextScheduleItem.entry.day} {weekSchedulePreview.nextScheduleItem.entry.slot}
                  </p>
                ) : null}
              </div>
              {weekSchedulePreview.nextScheduleItem && nextSessionDestination ? (
                <Link href={nextSessionDestination.href}>
                  <Button className="btn-primary-action w-full sm:w-auto" data-testid="button-home-start-next-session">
                    Start next session
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Link href={currentPhase ? "/app/client/my-phase" : "/app/client/home"}>
                  <Button className="w-full sm:w-auto border-slate-300 bg-white text-slate-800 hover:bg-slate-50" data-testid="button-home-open-phase-fallback">
                    Open current phase
                  </Button>
                </Link>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
                <CalendarDays className="h-3.5 w-3.5 text-slate-600" />
                This Week
              </div>
              {weekSchedulePreview.sortedEntries.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No sessions scheduled this week.
                </div>
              ) : (
                <div className="space-y-2">
                  {weekSchedulePreview.sortedEntries.map((item) => (
                    <div
                      key={item.instanceKey}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                    >
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
                          {item.entry.day} {item.entry.slot}
                        </p>
                      </div>
                      {item.isCompleted ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-brand-500)] bg-[var(--color-brand-100)] text-[var(--color-brand-700)] px-2 py-0.5 text-[11px] font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          Done
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <HomeChatCard />
      </div>

      <ClientReadinessSection />
    </div>
  );
}
