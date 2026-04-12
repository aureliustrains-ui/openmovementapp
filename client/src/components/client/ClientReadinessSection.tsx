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
import { ChevronDown, Loader2, TrendingUp } from "lucide-react";
import {
  ComposedChart,
  CartesianGrid,
  Line,
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
type WeeklyMetricKey = "recoveryThisTrainingWeek" | "stressOutsideTrainingThisWeek";

const CHART_FRAME_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50/30 p-1.5 h-[62vw] min-h-[260px] max-h-[380px] sm:h-64";

function metricToggleClassName(active: boolean): string {
  return cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-1 py-1 text-[11px] font-medium transition-colors sm:text-xs",
    active ? "text-slate-900" : "text-slate-500 hover:text-slate-700",
  );
}

function formatScore(value: unknown, scale: 5 | 10): string {
  if (typeof value !== "number" || Number.isNaN(value)) return `—/${scale}`;
  return `${Number.isInteger(value) ? value : Number(value).toFixed(1).replace(/\.0$/, "")}/${scale}`;
}

function averageScore(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function compareDirection(
  latest: number | null,
  baseline: number | null,
  threshold: number,
): "up" | "down" | "flat" | "unknown" {
  if (latest === null || baseline === null) return "unknown";
  const delta = latest - baseline;
  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "flat";
}

export default function ClientReadinessSection({
  showFullDetails = false,
  compactForCheckins = false,
}: {
  showFullDetails?: boolean;
  compactForCheckins?: boolean;
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
  });
  const [showTrendOrientation, setShowTrendOrientation] = useState(false);

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
  const weeklyTrendLabelByKey = useMemo(() => {
    const labels = new Map<string, string>();
    weeklyCheckinTrendData.forEach((entry: any) => {
      labels.set(
        String(entry?.trendWeekKey ?? ""),
        String(entry?.trendWeekLabel ?? entry?.dateLabel ?? "—"),
      );
    });
    return labels;
  }, [weeklyCheckinTrendData]);
  const sessionTrendLabelByKey = useMemo(() => {
    const labels = new Map<string, string>();
    sessionCheckinTrendData.forEach((entry: any) => {
      labels.set(
        String(entry?.trendWeekKey ?? ""),
        String(entry?.trendWeekLabel ?? entry?.dateLabel ?? "—"),
      );
    });
    return labels;
  }, [sessionCheckinTrendData]);

  const hasAnySessionTrendData = hasSessionCheckinTrendData(sessionCheckinTrendData);
  const hasAnyWeeklyTrendData = hasWeeklyCheckinTrendData(weeklyCheckinTrendData);
  const hasAnyTrendData = hasAnySessionTrendData || hasAnyWeeklyTrendData;
  const hasSessionTrendData = hasAnySessionTrendData;
  const hasWeeklyTrendData = hasAnyWeeklyTrendData;

  const hasFeltOffEventsInView = sessionCheckinTrendData.some((entry: any) => Boolean(entry?.feltOff));
  const hasInjuryImpactDataInView = weeklyCheckinTrendData.some(
    (entry: any) => typeof entry?.injuryImpact === "number",
  );

  const showFeltOffToggle = showFullDetails || hasFeltOffEventsInView;
  const feltOffEventCount = sessionCheckinTrendData.filter((entry: any) => Boolean(entry?.feltOff)).length;

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
  const trendSummaryLines = useMemo(() => {
    const lines: string[] = [];
    const latestWeekly = weeklyCheckinTrendData[weeklyCheckinTrendData.length - 1] as any;
    const previousWeekly =
      weeklyCheckinTrendData.length > 1
        ? (weeklyCheckinTrendData[weeklyCheckinTrendData.length - 2] as any)
        : null;
    const latestSession = sessionCheckinTrendData[sessionCheckinTrendData.length - 1] as any;
    const priorSessions = sessionCheckinTrendData.slice(-6, -1) as any[];

    const recoveryDirection = compareDirection(
      typeof latestWeekly?.recoveryThisTrainingWeek === "number"
        ? latestWeekly.recoveryThisTrainingWeek
        : null,
      typeof previousWeekly?.recoveryThisTrainingWeek === "number"
        ? previousWeekly.recoveryThisTrainingWeek
        : null,
      0.4,
    );
    if (recoveryDirection === "up") lines.push("Recovery was better than last week.");
    if (recoveryDirection === "down") lines.push("Recovery was lower than last week.");
    if (recoveryDirection === "flat") lines.push("Recovery stayed about the same as last week.");

    const stressDirection = compareDirection(
      typeof latestWeekly?.stressOutsideTrainingThisWeek === "number"
        ? latestWeekly.stressOutsideTrainingThisWeek
        : null,
      typeof previousWeekly?.stressOutsideTrainingThisWeek === "number"
        ? previousWeekly.stressOutsideTrainingThisWeek
        : null,
      0.4,
    );
    if (stressDirection === "up") lines.push("Stress was higher than last week.");
    if (stressDirection === "down") lines.push("Stress was lower than last week.");
    if (stressDirection === "flat") lines.push("Stress stayed about the same as last week.");

    const effortDirection = compareDirection(
      typeof latestSession?.rpeOverall === "number" ? latestSession.rpeOverall : null,
      averageScore(priorSessions.map((entry) => entry?.rpeOverall)),
      0.6,
    );
    if (effortDirection === "up") lines.push("Effort was slightly higher than your recent average.");
    if (effortDirection === "down") lines.push("Effort was slightly lower than your recent average.");
    if (effortDirection === "flat") lines.push("Effort has been steady recently.");

    const sleepDirection = compareDirection(
      typeof latestSession?.sleepLastNight === "number" ? latestSession.sleepLastNight : null,
      averageScore(priorSessions.map((entry) => entry?.sleepLastNight)),
      0.6,
    );
    if (sleepDirection === "up") lines.push("Sleep was slightly better than your recent average.");
    if (sleepDirection === "down") lines.push("Sleep was slightly lower than your recent average.");
    if (sleepDirection === "flat") lines.push("Sleep has stayed fairly stable recently.");

    if (feltOffEventCount > 0) {
      lines.push(
        `${feltOffEventCount} recent session check-in${feltOffEventCount === 1 ? "" : "s"} included a felt-off event.`,
      );
    }
    if (lines.length === 0) {
      lines.push("Not enough recent check-ins yet to generate a trend summary.");
    }
    return lines.slice(0, 4);
  }, [weeklyCheckinTrendData, sessionCheckinTrendData, feltOffEventCount]);

  return (
    <div className="space-y-6">
      {showFullDetails && !compactForCheckins ? (
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
          {compactForCheckins ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowTrendOrientation((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800"
                  aria-expanded={showTrendOrientation}
                >
                  What is this?
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      showTrendOrientation ? "rotate-180" : "rotate-0",
                    )}
                  />
                </button>
                {showTrendOrientation ? (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    These check-ins show the data you entered about your sessions and your weeks. They are there to help us notice patterns, reflect on how training is going, and give a rough orientation over time. They can show us whether recovery, stress, effort, sleep, or other factors are moving in a certain direction, but they should not be treated as something absolute. In a world with so much data, it is easy to rely too much on numbers and forget the most important thing: learning to sense our own body well. The real goal is to become better at noticing how we feel, how recovered we are, how much effort something really takes, and when small changes begin to happen. The better we get at sensing this ourselves, the less we need from the outside to tell us what is going on. These check-ins should support that process, not replace it.
                  </p>
                ) : null}
              </div>
              <div className="flex justify-start sm:justify-end">
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
            </div>
          ) : (
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
          )}
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
            <>
              {compactForCheckins ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</p>
                    <div className="mt-1.5 space-y-1">
                      {trendSummaryLines.map((line) => (
                        <p key={line} className="text-sm text-slate-700">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700">Weekly trends</h3>
                    {hasWeeklyTrendData ? (
                      <div className="space-y-3">
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
                                    </div>
                                  );
                                }}
                              />
                              <Line type="monotone" dataKey="recoveryThisTrainingWeek" name="Recovery this training week" stroke={CHART_COLORS.recovery} strokeWidth={2} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="stressOutsideTrainingThisWeek" name="Stress outside training this week" stroke={CHART_COLORS.stress} strokeWidth={2} dot={{ r: 3 }} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        {hasInjuryImpactDataInView ? (
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Weekly injury impact
                            </h4>
                            <div className={CHART_FRAME_CLASS}>
                              <ResponsiveContainer>
                                <ComposedChart data={weeklyCheckinTrendData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis
                                    dataKey="trendWeekKey"
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={(value: string) => weeklyTrendLabelByKey.get(String(value)) ?? String(value)}
                                  />
                                  <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} width={28} />
                                  <Tooltip
                                    content={({ active, payload }) => {
                                      if (!active || !payload || payload.length === 0) return null;
                                      const point = payload[0]?.payload as any;
                                      return (
                                        <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
                                          <div className="font-semibold text-slate-900">
                                            {point?.trendWeekLabel || point?.weekStartDate || "Week"}
                                          </div>
                                          <div className="text-slate-700 mt-1">
                                            Injury impact: {typeof point?.injuryImpact === "number" ? point.injuryImpact : "—"}
                                          </div>
                                        </div>
                                      );
                                    }}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="injuryImpact"
                                    name="Weekly injury impact"
                                    stroke={CHART_COLORS.painInjury}
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    connectNulls={false}
                                  />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                        No weekly check-ins yet.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700">Session trends</h3>
                    {hasSessionTrendData ? (
                      <div className="space-y-2">
                        <div className={CHART_FRAME_CLASS}>
                          <ResponsiveContainer>
                            <ComposedChart data={sessionCheckinTrendData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis
                                dataKey="trendWeekKey"
                                tick={{ fontSize: 11 }}
                                tickFormatter={(value: string) =>
                                  sessionTrendLabelByKey.get(String(value)) ?? String(value)
                                }
                              />
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
                                    </div>
                                  );
                                }}
                              />
                              <Line type="monotone" dataKey="rpeOverall" name="Effort" stroke={CHART_COLORS.sessionRpe} strokeWidth={2} dot={{ r: 3 }} />
                              <Line
                                type="monotone"
                                dataKey="sleepLastNight"
                                name="Sleep"
                                stroke={CHART_COLORS.sleepLastNight}
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                connectNulls={false}
                              />
                              {hasFeltOffEventsInView ? (
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
                        {feltOffEventCount > 0 ? (
                          <p className="text-xs text-slate-600">
                            Red markers show felt-off events ({feltOffEventCount} in this period).
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                        No session check-ins yet.
                      </div>
                    )}
                  </div>
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
                              <XAxis
                                dataKey="trendWeekKey"
                                tick={{ fontSize: 11 }}
                                tickFormatter={(value: string) =>
                                  sessionTrendLabelByKey.get(String(value)) ?? String(value)
                                }
                              />
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
                              {sessionMetrics.rpeOverall ? (
                                <Line type="monotone" dataKey="rpeOverall" name="Effort" stroke={CHART_COLORS.sessionRpe} strokeWidth={2} dot={{ r: 3 }} />
                              ) : null}
                              {sessionMetrics.sleepLastNight ? (
                                <Line
                                  type="monotone"
                                  dataKey="sleepLastNight"
                                  name="Sleep"
                                  stroke={CHART_COLORS.sleepLastNight}
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  connectNulls={false}
                                />
                              ) : null}
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
                                    </div>
                                  );
                                }}
                              />
                              {weeklyMetrics.recoveryThisTrainingWeek ? (
                                <Line type="monotone" dataKey="recoveryThisTrainingWeek" name="Recovery this training week" stroke={CHART_COLORS.recovery} strokeWidth={2} dot={{ r: 3 }} />
                              ) : null}
                              {weeklyMetrics.stressOutsideTrainingThisWeek ? (
                                <Line type="monotone" dataKey="stressOutsideTrainingThisWeek" name="Stress outside training this week" stroke={CHART_COLORS.stress} strokeWidth={2} dot={{ r: 3 }} />
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

            {showFullDetails && hasInjuryImpactDataInView ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Weekly injury impact</h3>
                <div className={CHART_FRAME_CLASS}>
                  <ResponsiveContainer>
                    <ComposedChart data={weeklyCheckinTrendData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="trendWeekKey"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value: string) => weeklyTrendLabelByKey.get(String(value)) ?? String(value)}
                      />
                      <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} width={28} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const point = payload[0]?.payload as any;
                          return (
                            <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
                              <div className="font-semibold text-slate-900">
                                {point?.trendWeekLabel || point?.weekStartDate || "Week"}
                              </div>
                              <div className="text-slate-700 mt-1">
                                Injury impact: {typeof point?.injuryImpact === "number" ? point.injuryImpact : "—"}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="injuryImpact"
                        name="Weekly injury impact"
                        stroke={CHART_COLORS.painInjury}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
            </>
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
                      Session effort {entry.sessionRpe ?? entry.rpeOverall}
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
                    <div className="text-xs text-slate-700">
                      Injury impact {entry.injuryAffectedTraining ? (entry.injuryImpact ?? "—") : "—"}
                    </div>
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
