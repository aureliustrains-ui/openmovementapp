import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { getRecommendedTrainingWeek, getTrainingWeekStatuses } from "@/lib/trainingWeek";
import { formatReps, formatSets } from "@/lib/prescription";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function fmt(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function trendArrow(latest: number | null, previous: number | null): string {
  if (latest === null || previous === null) return "";
  const delta = latest - previous;
  if (Math.abs(delta) < 0.4) return "→";
  return delta > 0 ? "↑" : "↓";
}

type Props = {
  clientId: string;
  firstName: string;
  activePhase: any | null;
  otherPhases: any[];
  allSessions: any[];
  workoutLogs: any[];
  checkinsRecent: any;
  getPhaseDisplayStatus: (phase: any) => string;
  isReadyToActivate: (phase: any) => boolean;
  onFinish: (phase: any) => void;
  onDelete: (phase: any) => void;
  onActivate: (phase: any) => void;
  videosSlot: ReactNode;
};

export function ClientPlanOverview({
  clientId,
  firstName,
  activePhase,
  otherPhases,
  allSessions,
  workoutLogs,
  checkinsRecent,
  getPhaseDisplayStatus,
  isReadyToActivate,
  onFinish,
  onDelete,
  onActivate,
  videosSlot,
}: Props) {
  const schedule: any[] = useMemo(
    () => (Array.isArray(activePhase?.schedule) ? activePhase.schedule : []),
    [activePhase],
  );
  const completed: string[] = useMemo(
    () =>
      Array.isArray(activePhase?.completedScheduleInstances)
        ? activePhase.completedScheduleInstances
        : [],
    [activePhase],
  );
  const duration = Math.max(1, Number(activePhase?.durationWeeks) || 1);
  const weekStatuses = useMemo(
    () => getTrainingWeekStatuses(duration, schedule, completed),
    [duration, schedule, completed],
  );
  const currentWeek = getRecommendedTrainingWeek(weekStatuses);
  const totalPlanned = weekStatuses.reduce((sum, w) => sum + w.scheduledCount, 0);
  const totalDone = weekStatuses.reduce((sum, w) => sum + w.completedCount, 0);

  const [viewWeek, setViewWeek] = useState(currentWeek);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [showPast, setShowPast] = useState(false);
  useEffect(() => {
    setViewWeek(currentWeek);
    setOpenRows(new Set());
  }, [activePhase?.id, currentWeek]);

  const instanceKey = (entry: any, week: number) =>
    `w${week}_${entry.day || "Monday"}_${entry.slot || "AM"}_${entry.sessionId}`;

  const phaseLogs = useMemo(
    () => (workoutLogs || []).filter((l: any) => !activePhase || l.phaseId === activePhase.id),
    [workoutLogs, activePhase],
  );

  const weekRows = useMemo(() => {
    return schedule
      .filter((e: any) => e.week === viewWeek && e.sessionId)
      .sort(
        (a: any, b: any) =>
          DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
          String(a.slot || "AM").localeCompare(String(b.slot || "AM")),
      )
      .map((entry: any) => {
        const key = instanceKey(entry, viewWeek);
        const session = allSessions.find((s: any) => s.id === entry.sessionId);
        const logs = phaseLogs.filter((l: any) => String(l.instanceId || "").startsWith(key));
        const notes = logs.filter((l: any) => String(l.clientNotes || "").trim().length > 0);
        return { entry, key, session, done: completed.includes(key), notes };
      });
  }, [schedule, viewWeek, allSessions, completed, phaseLogs]);

  const nextEntry = useMemo(() => {
    const ordered = [...schedule]
      .filter((e: any) => e.sessionId && typeof e.week === "number")
      .sort(
        (a: any, b: any) =>
          a.week - b.week ||
          DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
          String(a.slot || "AM").localeCompare(String(b.slot || "AM")),
      );
    const next = ordered.find((e: any) => !completed.includes(instanceKey(e, e.week)));
    if (!next) return null;
    const session = allSessions.find((s: any) => s.id === next.sessionId);
    return session ? `${session.name} (${String(next.day).slice(0, 3)}, week ${next.week})` : null;
  }, [schedule, completed, allSessions]);

  const lastDate = useMemo(() => {
    const dates = phaseLogs.map((l: any) => String(l.date || "")).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [phaseLogs]);

  const checkinSessions: any[] = checkinsRecent?.sessions || [];
  const checkinWeeks: any[] = checkinsRecent?.weeks || [];
  const trend = useMemo(() => {
    const rpe = checkinSessions
      .map((c) => toNumber(c.sessionRpe ?? c.rpeOverall))
      .filter((v): v is number => v !== null);
    const sleep = checkinSessions
      .map((c) => toNumber(c.sleepLastNight))
      .filter((v): v is number => v !== null);
    const latestRpe = average(rpe.slice(0, 3));
    const previousRpe = rpe.length >= 5 ? average(rpe.slice(3, 6)) : null;
    const feltOff = checkinSessions
      .slice(0, 5)
      .filter((c) => String(c.whatFeltOff || "").trim()).length;
    const week = checkinWeeks[0];
    return {
      count: checkinSessions.length,
      rpe: latestRpe,
      rpeArrow: trendArrow(latestRpe, previousRpe),
      sleep: average(sleep.slice(0, 3)),
      feltOff,
      feltOffOf: Math.min(5, checkinSessions.length),
      recovery: week ? toNumber(week.recoveryThisTrainingWeek) : null,
      stress: week ? toNumber(week.stressOutsideTrainingThisWeek) : null,
    };
  }, [checkinSessions, checkinWeeks]);

  const clientNotes = useMemo(() => {
    const fromLogs = phaseLogs
      .filter((l: any) => String(l.clientNotes || "").trim())
      .map((l: any) => ({
        id: `log-${l.id}`,
        when: String(l.date || ""),
        title: l.exerciseName || "Exercise",
        text: String(l.clientNotes).trim(),
      }));
    const fromCheckins = checkinSessions.flatMap((c: any) => {
      const items: { id: string; when: string; title: string; text: string }[] = [];
      if (String(c.whatFeltOff || "").trim()) {
        items.push({
          id: `off-${c.id}`,
          when: String(c.submittedAt || ""),
          title: `Felt off · ${c.sessionName || "session"}`,
          text: String(c.whatFeltOff).trim(),
        });
      }
      if (String(c.optionalNote || "").trim()) {
        items.push({
          id: `note-${c.id}`,
          when: String(c.submittedAt || ""),
          title: `After ${c.sessionName || "session"}`,
          text: String(c.optionalNote).trim(),
        });
      }
      return items;
    });
    return [...fromLogs, ...fromCheckins].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 5);
  }, [phaseLogs, checkinSessions]);

  const toggleRow = (key: string) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const builderHref = (phaseId: string, week?: number) =>
    `/app/admin/clients/${clientId}/builder/${phaseId}${week ? `?week=${week}` : ""}`;

  const upcoming = otherPhases.filter((p) => p.status !== "Completed");
  const past = otherPhases.filter((p) => p.status === "Completed");

  const renderPhaseRow = (phase: any) => (
    <div
      key={phase.id}
      className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5"
      data-testid={`row-phase-${phase.id}`}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{phase.name}</div>
        <div className="text-xs text-slate-500">
          {getPhaseDisplayStatus(phase)} · {phase.durationWeeks} weeks
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {phase.status === "Waiting for Movement Check" && isReadyToActivate(phase) ? (
          <Button
            size="sm"
            className="h-8 bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => onActivate(phase)}
            data-testid={`button-activate-${phase.id}`}
          >
            <Zap className="mr-1.5 h-3.5 w-3.5" /> Activate
          </Button>
        ) : null}
        <Link href={builderHref(phase.id)}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-slate-600"
            data-testid={`button-edit-${phase.id}`}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {phase.status === "Completed" ? "View" : "Edit"}
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
          onClick={() => onDelete(phase)}
          data-testid={`button-delete-${phase.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {activePhase ? (
        <section
          className="overflow-hidden rounded-xl border border-slate-900 bg-white shadow-sm"
          data-testid={`card-phase-${activePhase.id}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Active phase
              </div>
              <h2
                className="truncate text-lg font-semibold text-slate-900"
                data-testid={`text-phase-name-${activePhase.id}`}
              >
                {activePhase.name}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Link href={builderHref(activePhase.id, viewWeek)}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 bg-white"
                  data-testid={`button-edit-${activePhase.id}`}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit phase
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-slate-500"
                onClick={() => onFinish(activePhase)}
                data-testid={`button-finish-${activePhase.id}`}
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" /> Finish
              </Button>
            </div>
          </div>

          <div className="px-5 pb-4 pt-3">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
              <span className="font-semibold text-slate-900">
                Week {currentWeek} of {duration}
              </span>
              <span className="text-slate-600">
                {totalDone} of {totalPlanned} sessions done
              </span>
              <span className="text-slate-500">
                Last session: {lastDate ? formatDate(lastDate) : "none yet"}
              </span>
              <span className="text-slate-500">Next: {nextEntry || "plan complete"}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900"
                style={{
                  width: `${totalPlanned ? Math.round((totalDone / totalPlanned) * 100) : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="grid gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-3">
            <div className="bg-white px-5 py-3">
              <div className="text-xs text-slate-400">Effort (last 3 sessions)</div>
              <div className="text-base font-semibold text-slate-900">
                {trend.rpe === null ? "—" : `${fmt(trend.rpe)}/10 ${trend.rpeArrow}`}
              </div>
            </div>
            <div className="bg-white px-5 py-3">
              <div className="text-xs text-slate-400">Sleep before sessions</div>
              <div className="text-base font-semibold text-slate-900">
                {trend.sleep === null ? "—" : `${fmt(trend.sleep)}/5`}
              </div>
            </div>
            <div className="bg-white px-5 py-3">
              <div className="text-xs text-slate-400">Felt off</div>
              <div className="text-base font-semibold text-slate-900">
                {trend.count === 0 ? "—" : `${trend.feltOff} of last ${trend.feltOffOf}`}
              </div>
            </div>
          </div>
          {trend.recovery !== null || trend.stress !== null ? (
            <div className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">
              Latest week: recovery {fmt(trend.recovery)}/5 · stress {fmt(trend.stress)}/5
            </div>
          ) : null}

          {clientNotes.length > 0 ? (
            <div className="border-t border-slate-100 px-5 py-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                From {firstName}
              </div>
              <ul className="space-y-1.5">
                {clientNotes.map((note) => (
                  <li key={note.id} className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">{note.title}</span>
                    <span className="text-slate-400"> · {formatDate(note.when)}</span>
                    <span className="block text-slate-600">{note.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="border-t border-slate-100">
            <div className="flex items-center justify-between px-5 py-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Sessions
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={viewWeek <= 1}
                  onClick={() => setViewWeek((w) => Math.max(1, w - 1))}
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="w-16 text-center text-sm text-slate-700">Week {viewWeek}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={viewWeek >= duration}
                  onClick={() => setViewWeek((w) => Math.min(duration, w + 1))}
                  aria-label="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {weekRows.length === 0 ? (
              <p className="px-5 pb-4 text-sm italic text-slate-400">No sessions in this week.</p>
            ) : (
              weekRows.map(({ entry, key, session, done, notes }) => {
                const open = openRows.has(key);
                const sections: any[] = Array.isArray(session?.sections) ? session.sections : [];
                return (
                  <div
                    key={key}
                    className="border-t border-slate-100"
                    data-testid={`row-session-${key}`}
                  >
                    <div className="flex items-center gap-3 px-5 py-2.5">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => toggleRow(key)}
                        aria-expanded={open}
                      >
                        <span className="w-10 shrink-0 text-xs font-medium uppercase text-slate-400">
                          {String(entry.day || "").slice(0, 3)}
                          {entry.slot === "PM" ? " PM" : ""}
                        </span>
                        <span className="truncate text-sm font-medium text-slate-900">
                          {session?.name || "Session"}
                        </span>
                        {done ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700">
                            <Check className="h-3.5 w-3.5" /> done
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">open</span>
                        )}
                        {notes.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                            <MessageCircle className="h-3.5 w-3.5" /> {notes.length}
                          </span>
                        ) : null}
                        <ChevronDown
                          className={`ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      <Link href={builderHref(activePhase.id, viewWeek)}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-slate-500"
                          data-testid={`button-edit-session-${key}`}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                      </Link>
                    </div>
                    {open ? (
                      <div className="space-y-2 bg-slate-50/70 py-3 pl-[4.25rem] pr-5">
                        {sections.length === 0 ? (
                          <p className="text-sm italic text-slate-400">No exercises.</p>
                        ) : (
                          sections.map((section: any, i: number) => (
                            <div key={section.id || i}>
                              {section.name ? (
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                  {section.name}
                                </div>
                              ) : null}
                              <ul className="space-y-0.5">
                                {((section.exercises as any[]) || []).map((ex: any, j: number) => {
                                  const detail = [formatSets(ex.sets), formatReps(ex.reps)]
                                    .filter(Boolean)
                                    .join(" × ");
                                  return (
                                    <li key={ex.id || j} className="text-sm text-slate-700">
                                      {ex.name}
                                      {detail ? (
                                        <span className="text-slate-400"> · {detail}</span>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))
                        )}
                        {notes.map((log: any) => (
                          <p key={log.id} className="text-sm text-amber-800">
                            <span className="font-medium">{log.exerciseName || "Exercise"}:</span>{" "}
                            {log.clientNotes}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
          <h2 className="text-base font-semibold text-slate-900">No active phase</h2>
          <p className="mt-1 text-sm text-slate-500">
            Start a new phase or publish one of the drafts below.
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phases</h3>
          <Link href={`/app/admin/clients/${clientId}/builder/new`}>
            <Button
              size="sm"
              className="h-8 bg-slate-900 text-white hover:bg-slate-800"
              data-testid="button-create-phase"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New phase
            </Button>
          </Link>
        </div>
        {upcoming.length === 0 && past.length === 0 ? (
          <p className="border-t border-slate-100 px-4 py-4 text-sm text-slate-400">
            No other phases.
          </p>
        ) : null}
        {upcoming.map(renderPhaseRow)}
        {past.length > 0 ? (
          <>
            <button
              type="button"
              className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-50"
              onClick={() => setShowPast((v) => !v)}
              data-testid="button-toggle-past-phases"
            >
              Past phases ({past.length})
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showPast ? "rotate-180" : ""}`}
              />
            </button>
            {showPast ? past.map(renderPhaseRow) : null}
          </>
        ) : null}
      </section>

      {activePhase ? (
        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm text-slate-600">
            Starting page videos for this phase
          </summary>
          <div className="border-t border-slate-100 px-4 py-4">{videosSlot}</div>
        </details>
      ) : null}
    </div>
  );
}
