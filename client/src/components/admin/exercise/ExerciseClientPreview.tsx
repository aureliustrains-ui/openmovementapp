import { ExerciseStandardDetails } from "@/components/client/ExerciseStandardDetails";
import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";
import { formatReps, formatSets } from "@/lib/prescription";

/**
 * Shows an exercise the way a client sees it in a session (collapsed row + opened card),
 * using the same client components. Coach notes are never part of it.
 */
export function ExerciseClientPreview({
  exercise,
}: {
  exercise: {
    name?: string;
    sets?: string;
    reps?: string;
    tempo?: string;
    goal?: string;
    additionalInstructions?: string;
    demoUrl?: string;
  };
}) {
  const summary = [formatSets(exercise.sets), formatReps(exercise.reps), exercise.tempo?.trim() || null]
    .filter(Boolean)
    .join(" · ");
  const demoUrl = exercise.demoUrl?.trim();
  return (
    <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Client view
        </p>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 min-w-8 items-center justify-center rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">
            A1
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {exercise.name || "Exercise"}
            </div>
            {summary ? <div className="truncate text-xs text-slate-500">{summary}</div> : null}
          </div>
        </div>
      </div>
      <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-3 pb-3 pt-3">
        {demoUrl ? (
          <InlineVideoPlayer url={demoUrl} sourceType="link" flush />
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
            No demo video yet
          </div>
        )}
        <ExerciseStandardDetails
          exercise={{
            sets: exercise.sets,
            reps: exercise.reps,
            tempo: exercise.tempo,
            goal: exercise.goal,
            additionalInstructions: exercise.additionalInstructions,
          }}
          showName={false}
          showDemoLink={false}
          integrated
        />
      </div>
    </div>
  );
}
