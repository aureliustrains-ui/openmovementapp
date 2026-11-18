import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Archive, ChevronDown, Check, MessageCircle, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { getRecommendedTrainingWeek, getTrainingWeekStatuses } from "@/lib/trainingWeek";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
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
  const [showPast, setShowPast] = useState(false);

  const instanceKey = (entry: any, week: number) =>
    `w${week}_${entry.day || "Monday"}_${entry.slot || "AM"}_${entry.sessionId}`;

  const phaseLogs = useMemo(
    () => (workoutLogs || []).filter((l: any) => !activePhase || l.phaseId === activePhase.id),
    [workoutLogs, activePhase],
  );

  const sessionName = (id: string) => allSessions.find((s: any) => s.id === id)?.name || "Session";

  const weeks = useMemo(() => {
    const ordered = [...schedule]
      .filter((e: any) => e.sessionId && typeof e.week === "number")
      .sort(
        (a: any, b: any) =>
          a.week - b.week ||
          DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
          String(a.slot || "AM").localeCompare(String(b.slot || "AM")),
      );
    const nextEntry = ordered.find((e: any) => !completed.includes(instanceKey(e, e.week)));
    const nextKey = nextEntry ? instanceKey(nextEntry, nextEntry.week) : null;
    return Array.from({ length: duration }, (_, i) => {
      const week = i + 1;
      const rows = ordered
        .filter((e: any) => e.week === week)
        .map((entry: any) => {
          const key = instanceKey(entry, week);
          const noteCount = phaseLogs.filter(
            (l: any) =>
              String(l.instanceId || "").startsWith(key) && String(l.clientNotes || "").trim(),
          ).length;
          return {
            key,
            entry,
            name: sessionName(entry.sessionId),
            done: completed.includes(key),
            isNext: key === nextKey,
            noteCount,
          };
        });
      return { week, rows };
    });
  }, [schedule, completed, duration, phaseLogs, allSessions]);

  const clientNotes = useMemo(() => {
    const fromLogs = phaseLogs
      .filter((l: any) => String(l.clientNotes || "").trim())
      .map((l: any) => {
        const m = /^w(\d+)_([A-Za-z]+)_([A-Za-z]+)_(.+)$/.exec(String(l.instanceId || ""));
        const place = m
          ? `Week ${m[1]} · ${sessionName(
              allSessions.find((s: any) => s.id === m[4] || m[4].startsWith(s.id))?.id || m[4],
            )}`
          : "";
        return {
          id: `log-${l.id}`,
          when: String(l.date || ""),
          place,
          title: l.exerciseName || "Exercise",
          text: String(l.clientNotes).trim(),
        };
      });
    const fromCheckins = ((checkinsRecent?.sessions as any[]) || []).flatMap((c: any) => {
      const items: { id: string; when: string; place: string; title: string; text: string }[] = [];
      if (String(c.whatFeltOff || "").trim()) {
        items.push({
          id: `off-${c.id}`,
          when: String(c.submittedAt || ""),
          place: c.sessionName || "Session",
          title: "Felt off",
          text: String(c.whatFeltOff).trim(),
        });
      }
      if (String(c.optionalNote || "").trim()) {
        items.push({
          id: `note-${c.id}`,
          when: String(c.submittedAt || ""),
          place: c.sessionName || "Session",
          title: "Note after session",
          text: String(c.optionalNote).trim(),
        });
      }
      return items;
    });
    return [...fromLogs, ...fromCheckins].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 6);
  }, [phaseLogs, checkinsRecent, allSessions]);

  const builderHref = (phaseId: string) => `/app/admin/clients/${clientId}/builder/${phaseId}`;
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
              <Link href={builderHref(activePhase.id)}>
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
            <div className="flex flex-wrap items-baseline gap-x-5 text-sm">
              <span className="font-semibold text-slate-900">
                {totalDone} of {totalPlanned} sessions done
              </span>
              <span className="text-slate-500">
                Week {currentWeek} of {duration}
              </span>
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

          <div
            className="grid gap-px border-t border-slate-100 bg-slate-100"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
            data-testid="plan-weeks"
          >
            {weeks.map(({ week, rows }) => {
              const isCurrent = week === currentWeek;
              const doneCount = rows.filter((r) => r.done).length;
              return (
                <div
                  key={week}
                  className={`px-4 py-3 ${isCurrent ? "bg-slate-50" : "bg-white"}`}
                  data-testid={`plan-week-${week}`}
                >
                  <div className="mb-2 flex items-baseline justify-between">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${isCurrent ? "text-slate-900" : "text-slate-400"}`}
                    >
                      Week {week}
                    </span>
                    <span className="text-xs text-slate-400">
                      {doneCount}/{rows.length}
                    </span>
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-xs italic text-slate-300">No sessions</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {rows.map((row) => (
                        <li
                          key={row.key}
                          className={`flex items-center gap-2 text-sm ${
                            row.done
                              ? "text-slate-400"
                              : row.isNext
                                ? "font-semibold text-slate-900"
                                : "text-slate-600"
                          }`}
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                            {row.done ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : row.isNext ? (
                              <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
                            ) : (
                              <span className="h-2.5 w-2.5 rounded-full border border-slate-300" />
                            )}
                          </span>
                          <span className="truncate">
                            <span className="mr-1 text-[11px] uppercase text-slate-400">
                              {String(row.entry.day || "").slice(0, 3)}
                            </span>
                            {row.name}
                          </span>
                          {row.isNext ? (
                            <span className="shrink-0 text-[10px] font-semibold uppercase text-slate-500">
                              next
                            </span>
                          ) : null}
                          {row.noteCount > 0 ? (
                            <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-xs text-amber-700">
                              <MessageCircle className="h-3.5 w-3.5" />
                              {row.noteCount}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {clientNotes.length > 0 ? (
            <div className="border-t border-slate-100 px-5 py-3" data-testid="plan-client-notes">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Comments from {firstName}
              </div>
              <ul className="space-y-2">
                {clientNotes.map((note) => (
                  <li key={note.id} className="text-sm">
                    <div className="text-slate-900">
                      <span className="font-medium">{note.title}</span>
                      {note.place ? <span className="text-slate-500"> · {note.place}</span> : null}
                      <span className="text-slate-400"> · {formatDate(note.when)}</span>
                    </div>
                    <div className="text-slate-600">{note.text}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
    </div>
  );
}
