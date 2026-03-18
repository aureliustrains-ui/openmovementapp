import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  clientCheckinsTrendsQuery,
  phasesQuery,
  sessionsQuery,
  weeklyCheckinsMeQuery,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pickDefaultVisiblePhase } from "@/lib/clientPhase";
import {
  type CheckinsRange,
  hasSessionCheckinTrendData,
  hasWeeklyCheckinTrendData,
  mapSessionCheckinTrendData,
  mapWeeklyCheckinTrendData,
} from "@/lib/checkins";
import { buildScheduleInstanceKey, getWeekSchedulePreview, type WeekScheduleItem } from "@/lib/clientSchedule";
import { getTrainingWeekLifecycle, type TrainingScheduleEntry } from "@/lib/trainingWeek";
import { getClientCounterpartDisplayName } from "@/lib/counterpartDisplayName";
import { cn } from "@/lib/utils";
import { resolveUserFirstName } from "@/lib/userDisplayName";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HomeChatCard } from "@/components/client/HomeChatCard";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";
import { Loader2, TrendingUp, CheckCircle2, ChevronRight, CalendarDays } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";

const CHART_COLORS = {
  sessionRpe: "#eab308",
  sleepLastNight: "#2563eb",
  feltOff: "#dc2626",
  recovery: "#16a34a",
  stress: "#d97706",
  painInjury: "#dc2626",
} as const;
type SessionMetricKey = "rpeOverall" | "sleepLastNight" | "feltOffEvents";
type WeeklyMetricKey = "recoveryThisTrainingWeek" | "stressOutsideTrainingThisWeek" | "injuryImpact";
const CHART_FRAME_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50/30 p-1.5 h-[62vw] min-h-[260px] max-h-[380px] sm:h-64";

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

function buildClientSessionUrl(item: WeekScheduleItem): string {
  return `/app/client/session/${item.session.id}?week=${item.entry.week}&day=${encodeURIComponent(item.entry.day)}&slot=${encodeURIComponent(item.entry.slot)}`;
}

function metricToggleClassName(active: boolean): string {
  return cn(
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
    active
      ? "border-slate-400 bg-slate-200 text-slate-800"
      : "border-[var(--color-ui-border)] bg-white text-[var(--color-ui-secondary)] hover:bg-[var(--color-ui-surface)]",
  );
}

export default function ClientHome() {
  const { viewedUser, sessionUser, impersonating } = useAuth();
  const counterpartName = getClientCounterpartDisplayName();
  const [checkinsRange, setCheckinsRange] = useState<CheckinsRange>("8w");
  const [sessionMetrics, setSessionMetrics] = useState({
    rpeOverall: true,
    sleepLastNight: true,
    feltOffEvents: true,
  });
  const [weeklyMetrics, setWeeklyMetrics] = useState({
    recoveryThisTrainingWeek: true,
    stressOutsideTrainingThisWeek: true,
    injuryImpact: true,
  });
  const toggleSessionMetric = (metric: SessionMetricKey) => {
    setSessionMetrics((prev) => {
      const next = { ...prev, [metric]: !prev[metric] };
      return Object.values(next).some(Boolean) ? next : prev;
    });
  };
  const toggleWeeklyMetric = (metric: WeeklyMetricKey) => {
    setWeeklyMetrics((prev) => {
      const next = { ...prev, [metric]: !prev[metric] };
      return Object.values(next).some(Boolean) ? next : prev;
    });
  };

  const { data: allPhases = [], isLoading: loadingPhases } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);
  const { data: weeklyCheckins = [] } = useQuery({
    ...weeklyCheckinsMeQuery,
    enabled: !!sessionUser && !impersonating,
  });
  const { data: checkinsTrends, isLoading: loadingTrends, isError: trendsError } = useQuery({
    ...clientCheckinsTrendsQuery(viewedUser?.id || "", checkinsRange),
    enabled: !!viewedUser?.id,
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

  const primaryProgressCopy =
    activePlanCompletion.totalInstances > 0
      ? `${activePlanCompletion.percent}% of current plan complete`
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

  const allSessionCheckinTrendData = mapSessionCheckinTrendData(
    (((checkinsTrends as any)?.sessions || []) as any[]),
  );
  const allWeeklyCheckinTrendData = mapWeeklyCheckinTrendData(
    (((checkinsTrends as any)?.weeks || []) as any[]),
  );
  const sessionCheckinTrendData = allSessionCheckinTrendData;
  const weeklyCheckinTrendData = allWeeklyCheckinTrendData;
  const hasAnySessionTrendData = hasSessionCheckinTrendData(sessionCheckinTrendData);
  const hasAnyWeeklyTrendData = hasWeeklyCheckinTrendData(weeklyCheckinTrendData);
  const hasAnyTrendData = hasAnySessionTrendData || hasAnyWeeklyTrendData;
  const hasSessionTrendData = hasAnySessionTrendData;
  const hasWeeklyTrendData = hasAnyWeeklyTrendData;

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
              className="h-full rounded-full bg-[linear-gradient(90deg,#5F8C87_0%,#6E7FA3_52%,#5A678A_100%)] transition-all"
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
          <p className="text-sm text-slate-600">{weeklyProgressCopy}</p>
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
              {weekSchedulePreview.nextScheduleItem ? (
                <Link href={buildClientSessionUrl(weekSchedulePreview.nextScheduleItem)}>
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
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-done-border)] bg-[var(--color-done-background)] text-[var(--color-done-foreground)] px-2 py-0.5 text-[11px] font-medium">
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

      <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
        <CardHeader className="border-b border-slate-100 bg-slate-50/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-600" />
              <CardTitle>Readiness</CardTitle>
            </div>
            <Select value={checkinsRange} onValueChange={(value) => setCheckinsRange(value as CheckinsRange)}>
              <SelectTrigger className="w-[160px] bg-white border-slate-200" data-testid="select-client-home-checkins-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2w">2 weeks</SelectItem>
                <SelectItem value="4w">4 weeks</SelectItem>
                <SelectItem value="8w">8 weeks</SelectItem>
                <SelectItem value="12w">12 weeks</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-5 md:p-6 space-y-6">
          {loadingTrends ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
            </div>
          ) : trendsError ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-600">Readiness data could not be loaded right now.</p>
            </div>
          ) : !hasAnyTrendData ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-600">No check-ins yet. Your trends will appear after your first entries.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Session check-ins</h3>
                {hasSessionTrendData ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={metricToggleClassName(sessionMetrics.rpeOverall)}
                        onClick={() => toggleSessionMetric("rpeOverall")}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.sessionRpe }} />
                        Session RPE
                      </button>
                      <button
                        type="button"
                        className={metricToggleClassName(sessionMetrics.sleepLastNight)}
                        onClick={() => toggleSessionMetric("sleepLastNight")}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.sleepLastNight }} />
                        Sleep (/10)
                      </button>
                      <button
                        type="button"
                        className={metricToggleClassName(sessionMetrics.feltOffEvents)}
                        onClick={() => toggleSessionMetric("feltOffEvents")}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.feltOff }} />
                        Felt-off events
                      </button>
                    </div>
                    <div className={CHART_FRAME_CLASS}>
                      <ResponsiveContainer>
                        <LineChart data={sessionCheckinTrendData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} width={28} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || payload.length === 0) return null;
                              const point = payload[0]?.payload as any;
                              return (
                                <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
                                  <div className="font-semibold text-slate-900">{point?.sessionName || "Session"}</div>
                                  <div className="text-slate-600">{point?.dateLabel}</div>
                                  <div className="text-slate-700 mt-1">RPE: {point?.rpeOverall}</div>
                                  <div className="text-slate-700">Sleep last night: {point?.sleepLastNight ?? "-"}/5</div>
                                </div>
                              );
                            }}
                          />
                          {sessionMetrics.rpeOverall && (
                            <Line type="monotone" dataKey="rpeOverall" name="Session RPE" stroke={CHART_COLORS.sessionRpe} strokeWidth={2} dot={{ r: 3 }} />
                          )}
                          {sessionMetrics.sleepLastNight && (
                            <Line
                              type="monotone"
                              dataKey="sleepLastNightScaled"
                              name="Sleep last night (/10)"
                              stroke={CHART_COLORS.sleepLastNight}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              connectNulls={false}
                            />
                          )}
                          {sessionMetrics.feltOffEvents && (
                            <Scatter dataKey="feltOffMarker" name="Felt off events" fill={CHART_COLORS.feltOff} />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : hasAnySessionTrendData ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No session check-ins in this range.
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No session check-ins yet.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Weekly check-ins</h3>
                {hasWeeklyTrendData ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={metricToggleClassName(weeklyMetrics.recoveryThisTrainingWeek)}
                        onClick={() => toggleWeeklyMetric("recoveryThisTrainingWeek")}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.recovery }} />
                        Recovery
                      </button>
                      <button
                        type="button"
                        className={metricToggleClassName(weeklyMetrics.stressOutsideTrainingThisWeek)}
                        onClick={() => toggleWeeklyMetric("stressOutsideTrainingThisWeek")}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.stress }} />
                        Stress
                      </button>
                      <button
                        type="button"
                        className={metricToggleClassName(weeklyMetrics.injuryImpact)}
                        onClick={() => toggleWeeklyMetric("injuryImpact")}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.painInjury }} />
                        Injury impact
                      </button>
                    </div>
                    <div className={CHART_FRAME_CLASS}>
                      <ResponsiveContainer>
                        <LineChart data={weeklyCheckinTrendData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} width={28} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || payload.length === 0) return null;
                              const point = payload[0]?.payload as any;
                              return (
                                <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
                                  <div className="font-semibold text-slate-900">Week of {point?.weekStartDate}</div>
                                  <div className="text-slate-700 mt-1">Recovery: {point?.recoveryThisTrainingWeek}</div>
                                  <div className="text-slate-700">Stress: {point?.stressOutsideTrainingThisWeek}</div>
                                  <div className="text-slate-700">Injury impact: {point?.injuryImpact ?? 0}</div>
                                </div>
                              );
                            }}
                          />
                          {weeklyMetrics.recoveryThisTrainingWeek && (
                            <Line type="monotone" dataKey="recoveryThisTrainingWeek" name="Recovery this training week" stroke={CHART_COLORS.recovery} strokeWidth={2} dot={{ r: 3 }} />
                          )}
                          {weeklyMetrics.stressOutsideTrainingThisWeek && (
                            <Line type="monotone" dataKey="stressOutsideTrainingThisWeek" name="Stress outside training this week" stroke={CHART_COLORS.stress} strokeWidth={2} dot={{ r: 3 }} />
                          )}
                          {weeklyMetrics.injuryImpact && (
                            <Line type="monotone" dataKey="injuryImpact" name="Pain/injury impact" stroke={CHART_COLORS.painInjury} strokeWidth={2} dot={{ r: 3 }} />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : hasAnyWeeklyTrendData ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No weekly check-ins in this range.
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No weekly check-ins yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
