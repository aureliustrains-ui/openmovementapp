import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";

type ExerciseLike = {
  name?: string;
  sets?: string;
  reps?: string;
  tempo?: string;
  goal?: string;
  notes?: string;
  additionalInstructions?: string;
  startPosition?: string | null;
  endPosition?: string | null;
  qualityPoints?: string | null;
  progressionStart?: string | null;
  progressionBuild?: string | null;
  progressionNext?: string | null;
  demoUrl?: string;
};

type Props = {
  exercise: ExerciseLike;
  showName?: boolean;
  showDemoLink?: boolean;
  sectionOffsetClassName?: string;
  nameClassName?: string;
  demoLabel?: string;
  integrated?: boolean;
};

export function ExerciseStandardDetails({
  exercise,
  showName = true,
  showDemoLink = true,
  sectionOffsetClassName = "",
  nameClassName = "text-xl font-bold text-slate-900",
  demoLabel = "Watch demo",
  integrated = false,
}: Props) {
  const offset = sectionOffsetClassName ? `${sectionOffsetClassName} ` : "";
  const integratedLabelClass = "mb-1 text-[13px] md:text-sm font-semibold leading-5 text-[var(--color-brand-700)]";
  const integratedValueClass = "text-[15px] md:text-base font-medium leading-6 text-slate-900";
  const prescriptionFields = [
    { label: "Sets", value: exercise.sets },
    { label: "Reps", value: exercise.reps },
    { label: "Tempo", value: exercise.tempo },
  ].filter((field) => field.value && field.value.trim().length > 0);
  const prescriptionGridClass =
    prescriptionFields.length === 1
      ? "grid-cols-1"
      : prescriptionFields.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  const clean = (value?: string | null) => (value && value.trim() ? value.trim() : "");
  const hasProgression = Boolean(
    clean(exercise.progressionStart) || clean(exercise.progressionBuild) || clean(exercise.progressionNext),
  );
  const standardRows = [
    { label: "Start", value: clean(exercise.startPosition) },
    { label: "Top / end", value: clean(exercise.endPosition) },
    { label: "A rep counts", value: clean(exercise.qualityPoints) },
    { label: "Start here", value: clean(exercise.progressionStart) },
    { label: "Build", value: clean(exercise.progressionBuild) },
    { label: "Then", value: clean(exercise.progressionNext) },
  ].filter((row) => row.value);

  return (
    <div className="space-y-3">
      {showName && <h3 className={nameClassName}>{exercise.name || "Exercise"}</h3>}

      {prescriptionFields.length > 0 && (
        <div className={`${offset}grid ${prescriptionGridClass} gap-2`}>
          {prescriptionFields.map((field) => (
            <div
              key={field.label}
              className={
                integrated
                  ? "py-1 text-center"
                  : "rounded-xl border border-slate-100 bg-slate-50 p-2 text-center"
              }
            >
              <div
                className={
                  integrated
                    ? integratedLabelClass
                    : "mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                }
              >
                {field.label}
              </div>
              <div
                className={
                  integrated ? integratedValueClass : "text-sm font-bold text-slate-900"
                }
              >
                {field.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {standardRows.length > 0 && (
        <div
          className={`${offset}space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left`}
          data-testid="exercise-standard"
        >
          {standardRows.map((row) => (
            <div key={row.label} className="grid grid-cols-[84px_1fr] gap-2 text-sm leading-relaxed">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 pt-0.5">
                {row.label}
              </div>
              <div className="font-medium text-slate-900 whitespace-pre-wrap">{row.value}</div>
            </div>
          ))}
        </div>
      )}

      {((exercise.goal && !hasProgression) || exercise.additionalInstructions) && (
        <div className={`${offset}grid grid-cols-1 md:grid-cols-2 gap-2 ${integrated ? "md:w-10/12 md:mx-auto md:justify-items-center" : ""}`}>
          {exercise.goal && !hasProgression && (
            <div className={integrated ? "py-1 w-full text-center" : "bg-slate-50 rounded-xl p-3 border border-slate-100"}>
              <div className={integrated ? integratedLabelClass : "text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1"}>Goal</div>
              <div className={integrated ? integratedValueClass : "text-sm font-medium text-slate-900 leading-relaxed"}>{exercise.goal}</div>
            </div>
          )}
          {exercise.additionalInstructions && (
            <div className={integrated ? "py-1 w-full text-center" : "bg-slate-50 rounded-xl p-3 border border-slate-100"}>
              <div className={integrated ? integratedLabelClass : "text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1"}>Additional Instructions</div>
              <div className={integrated ? `${integratedValueClass} whitespace-pre-wrap` : "text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap"}>
                {exercise.additionalInstructions}
              </div>
            </div>
          )}
        </div>
      )}


      {showDemoLink && exercise.demoUrl && (
        <div className={`${offset}`}>
          <InlineVideoPlayer url={exercise.demoUrl} sourceType="link" openLinkLabel={demoLabel} />
        </div>
      )}
    </div>
  );
}
