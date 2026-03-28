import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  clientCheckinsRecentQuery,
  clientCheckinsTrendsQuery,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  type CheckinsRange,
  hasSessionCheckinTrendData,
  hasWeeklyCheckinTrendData,
  mapSessionCheckinTrendData,
  mapWeeklyCheckinTrendData,
} from "@/lib/checkins";
import { buildReadinessSummaryCards } from "@/lib/readinessSummary";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp } from "lucide-react";
import {
  ComposedChart,
  CartesianGrid,
  Line,
  Scatter,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

function metricToggleClassName(active: boolean): string {
  return cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-1 py-1 text-[11px] font-medium transition-colors sm:text-xs",
    active ? "text-slate-900" : "text-slate-500 hover:text-slate-700",
  );
}

export default function ClientReadinessSection({
  showFullDetails = false,
}: {
  showFullDetails?: boolean;
}) {
  const { viewedUser } = useAuth();
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

  const clientId = viewedUser?.id || "";
  const trendsQuery = useQuery({
    ...clientCheckinsTrendsQuery(clientId, checkinsRange),
    enabled: !!clientId,
  });
  const recentQuery = useQuery({
    ...clientCheckinsRecentQuery(clientId),
    enabled: !!clientId && showFullDetails,
  });

  const checkinsTrends = trendsQuery.data as any;
  const checkinsRecent = recentQuery.data as any;

  const sessionCheckinTrendData = mapSessionCheckinTrendData(
    (((checkinsTrends as any)?.sessions || []) as any[]),
  );
  const weeklyCheckinTrendData = mapWeeklyCheckinTrendData(
    (((checkinsTrends as any)?.weeks || []) as any[]),
  );

  const hasAnySessionTrendData = hasSessionCheckinTrendData(sessionCheckinTrendData);
  const hasAnyWeeklyTrendData = hasWeeklyCheckinTrendData(weeklyCheckinTrendData);
  const hasAnyTrendData = hasAnySessionTrendData || hasAnyWeeklyTrendData;
  const hasSessionTrendData = hasAnySessionTrendData;
  const hasWeeklyTrendData = hasAnyWeeklyTrendData;

  const hasFeltOffEventsInView = sessionCheckinTrendData.some((entry: any) => Boolean(entry?.feltOff));
  const hasInjuryImpactEventsInView = weeklyCheckinTrendData.some((entry: any) => {
    const injuryImpact = typeof entry?.injuryImpact === "number" ? entry.injuryImpact : 0;
    return injuryImpact > 0 || entry?.injuryAffectedTraining === true;
  });

  const showFeltOffToggle = showFullDetails || hasFeltOffEventsInView;
  const showInjuryToggle = showFullDetails || hasInjuryImpactEventsInView;

  const summaryCards = useMemo(
    () =>
      buildReadinessSummaryCards({
        sessionTrendData: sessionCheckinTrendData as Record<string, unknown>[],
        weeklyTrendData: weeklyCheckinTrendData as Record<string, unknown>[],
      }),
    [sessionCheckinTrendData, weeklyCheckinTrendData],
  );

  const summaryCardAccent: Record<string, string> = {
    recovery: CHART_COLORS.recovery,
    stress: CHART_COLORS.stress,
    effort: CHART_COLORS.sessionRpe,
  };

  return (
    <div className="space-y-6">
      {showFullDetails ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => (
            <Card key={card.key} className="border-slate-200 shadow-sm rounded-2xl bg-white">
              <CardContent className="p-4">
                <div
                  className="text-xs uppercase tracking-wider"
                  style={{ color: summaryCardAccent[card.key] || "#475569" }}
                >
                  {card.title}
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{card.primary}</div>
                <div className="text-xs text-slate-500 mt-1">{card.secondary}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
        <CardHeader className="border-b border-slate-100 bg-slate-50/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-600" />
              <CardTitle>{showFullDetails ? "Trend Explorer" : "Readiness"}</CardTitle>
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
          {trendsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
            </div>
          ) : trendsQuery.isError ? (
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
                    <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap pb-1">
                      <button
                        type="button"
                        className={metricToggleClassName(sessionMetrics.rpeOverall)}
                        onClick={() => toggleSessionMetric("rpeOverall")}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.sessionRpe }} />
                        Effort
                      </button>
                      <button
                        type="button"
                        className={metricToggleClassName(sessionMetrics.sleepLastNight)}
                        onClick={() => toggleSessionMetric("sleepLastNight")}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.sleepLastNight }} />
                        Sleep
                      </button>
                      {showFeltOffToggle ? (
                        <button
                          type="button"
                          className={metricToggleClassName(sessionMetrics.feltOffEvents)}
                          onClick={() => toggleSessionMetric("feltOffEvents")}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.feltOff }} />
                          Felt off
                        </button>
                      ) : null}
                    </div>
                    <div className={CHART_FRAME_CLASS}>
                      <ResponsiveContainer>
                        <ComposedChart data={sessionCheckinTrendData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
                                  <div className="text-slate-700 mt-1">Effort: {point?.rpeOverall}</div>
                                  <div className="text-slate-700">Sleep: {point?.sleepLastNight ?? "-"}/10</div>
                                  {point?.feltOff ? <div className="text-amber-700">Felt off: Yes</div> : null}
                                  {point?.feltOff && point?.whatFeltOff ? (
                                    <div className="text-slate-700 mt-1 whitespace-pre-wrap">
                                      What felt off: {point.whatFeltOff}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            }}
                          />
                          {sessionMetrics.rpeOverall && (
                            <Line type="monotone" dataKey="rpeOverall" name="Effort" stroke={CHART_COLORS.sessionRpe} strokeWidth={2} dot={{ r: 3 }} />
                          )}
                          {sessionMetrics.sleepLastNight && (
                            <Line
                              type="monotone"
                              dataKey="sleepLastNight"
                              name="Sleep"
                              stroke={CHART_COLORS.sleepLastNight}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              connectNulls={false}
                            />
                          )}
                          {showFeltOffToggle && sessionMetrics.feltOffEvents ? (
                            <Line
                              type="linear"
                              dataKey="feltOffEventLevel"
                              name="Felt off events"
                              stroke="transparent"
                              dot={{ r: 5, fill: CHART_COLORS.feltOff, stroke: "#ffffff", strokeWidth: 1.5 }}
                              activeDot={{ r: 6, fill: CHART_COLORS.feltOff, stroke: "#ffffff", strokeWidth: 1.5 }}
                              connectNulls={false}
                            />
                          ) : null}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
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
                    <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap pb-1">
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
                      {showInjuryToggle ? (
                        <button
                          type="button"
                          className={metricToggleClassName(weeklyMetrics.injuryImpact)}
                          onClick={() => toggleWeeklyMetric("injuryImpact")}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.painInjury }} />
                          Injury impact
                        </button>
                      ) : null}
                    </div>
                    <div className={CHART_FRAME_CLASS}>
                      <ResponsiveContainer>
                        <ComposedChart data={weeklyCheckinTrendData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
                                  <div className="text-slate-700">Pain/injury affected training: {point?.injuryAffectedTraining ? "Yes" : "No"}</div>
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
                          {showInjuryToggle ? (
                            <>
                              {weeklyMetrics.injuryImpact ? (
                                <Line
                                  type="linear"
                                  dataKey="injuryImpact"
                                  name="Pain/injury impact"
                                  stroke={CHART_COLORS.painInjury}
                                  strokeWidth={3}
                                  dot={{ r: 5, fill: CHART_COLORS.painInjury, stroke: "#ffffff", strokeWidth: 1.5 }}
                                  activeDot={{
                                    r: 6,
                                    fill: CHART_COLORS.painInjury,
                                    stroke: "#ffffff",
                                    strokeWidth: 1.5,
                                  }}
                                  connectNulls={false}
                                />
                              ) : null}
                              <Scatter
                                dataKey="injuryImpactEventLevel"
                                name="Pain/injury events"
                                fill={CHART_COLORS.painInjury}
                                line={false}
                                shape={
                                  <circle
                                    r={6}
                                    fill={CHART_COLORS.painInjury}
                                    stroke="#ffffff"
                                    strokeWidth={1.75}
                                  />
                                }
                                legendType="circle"
                                isAnimationActive={false}
                              />
                            </>
                          ) : null}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
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

      {showFullDetails ? (
        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle>Recent Check-ins</CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Recent session check-ins</h3>
              {((checkinsRecent as any)?.sessions || []).length === 0 ? (
                <p className="text-sm text-slate-500">No session check-ins yet.</p>
              ) : (
                (checkinsRecent as any).sessions.map((entry: any) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="text-sm font-semibold text-slate-900">{entry.sessionName}</div>
                    <div className="text-xs text-slate-500">{new Date(entry.submittedAt).toLocaleString()}</div>
                    <div className="text-xs text-slate-700 mt-1">
                      Session RPE {entry.sessionRpe ?? entry.rpeOverall}
                      {entry.feltOff ? " · felt off" : ""}
                    </div>
                    <div className="text-xs text-slate-700">Sleep last night {entry.sleepLastNight ?? "-"}</div>
                    {entry.whatFeltOff ? (
                      <div className="text-xs text-slate-700 mt-1">What felt off: {entry.whatFeltOff}</div>
                    ) : null}
                    {entry.optionalNote ? (
                      <div className="text-xs text-slate-700 mt-1">Optional note: {entry.optionalNote}</div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Recent weekly check-ins</h3>
              {((checkinsRecent as any)?.weeks || []).length === 0 ? (
                <p className="text-sm text-slate-500">No weekly check-ins yet.</p>
              ) : (
                (checkinsRecent as any).weeks.map((entry: any) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="text-sm font-semibold text-slate-900">Week of {entry.weekStartDate}</div>
                    <div className="text-xs text-slate-700 mt-1">
                      Recovery {entry.recoveryThisTrainingWeek} · Stress {entry.stressOutsideTrainingThisWeek}
                    </div>
                    <div className="text-xs text-slate-700">
                      Pain/injury affected training {entry.injuryAffectedTraining ? "Yes" : "No"}
                    </div>
                    <div className="text-xs text-slate-700">Injury impact {entry.injuryImpact ?? 0}</div>
                    {entry.optionalNote ? (
                      <div className="text-xs text-slate-700 mt-1">Optional note: {entry.optionalNote}</div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
