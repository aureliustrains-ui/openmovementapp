import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";

type ExerciseLike = {
  name?: string;
  sets?: string;
  reps?: string;
  tempo?: string;
  goal?: string;
  notes?: string;
  additionalInstructions?: string;
  repsMode?: string | null;
  qualityPoints?: string | null;
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
  const integratedLabelClass =
    "mb-1 text-[13px] md:text-sm font-semibold leading-5 text-[var(--color-brand-700)]";
  const integratedValueClass = "text-[15px] md:text-base font-medium leading-6 text-slate-900";
  const prescriptionFields = [
    { label: "Sets", value: exercise.sets },
    { label: exercise.repsMode === "hold" ? "Hold" : "Reps", value: exercise.reps },
    { label: "Tempo", value: exercise.tempo },
  ].filter((field) => field.value && field.value.trim().length > 0);
  const prescriptionGridClass =
    prescriptionFields.length === 1
      ? "grid-cols-1"
      : prescriptionFields.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  const clean = (value?: string | null) => (value && value.trim() ? value.trim() : "");
  const repStandardLabel = exercise.repsMode === "hold" ? "A hold counts" : "A rep counts";
  const repStandard = clean(exercise.qualityPoints);
  const textBlocks = [
    { label: "Goal", value: clean(exercise.goal) },
    {
      label: exercise.repsMode === "hold" ? "A hold counts" : "A rep counts",
      value: clean(exercise.qualityPoints),
    },
    { label: "Additional Instructions", value: clean(exercise.additionalInstructions) },
  ].filter((block) => block.value);

  return (
    <div className="space-y-3">
      {showName && <h3 className={nameClassName}>{exercise.name || "Exercise"}</h3>}

      {prescriptionFields.length > 0 && (
        <div className={`${offset}grid ${prescriptionGridClass} gap-2`}>
          {prescriptionFields.map((field, index) => (
            <div
              key={`${index}-${field.label}`}
              className={
                integrated
                  ? "py-1 text-center"
                  : "rounded-xl border border-slate-100 bg-slate-50 p-2 text-center"
              }
            >
              {field.label ? (
                <div
                  className={
                    integrated
                      ? integratedLabelClass
                      : "mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                  }
                >
                  {field.label}
                </div>
              ) : null}
              <div
                className={integrated ? integratedValueClass : "text-sm font-bold text-slate-900"}
              >
                {field.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {repStandard && (
        <div className={`${offset}text-center`} data-testid="exercise-rep-standard">
          <span className="text-xs font-semibold text-slate-500">{repStandardLabel}: </span>
          <span className="text-xs text-slate-600 whitespace-pre-wrap">{repStandard}</span>
        </div>
      )}

      {textBlocks.length > 0 && (
        <div
          className={`${offset}grid grid-cols-1 gap-2 ${
            textBlocks.length > 1 ? "md:grid-cols-2" : "md:w-8/12 md:mx-auto"
          } ${integrated ? "md:w-10/12 md:mx-auto md:justify-items-center" : ""}`}
          data-testid="exercise-standard"
        >
          {textBlocks.map((block) => (
            <div
              key={block.label}
              className={
                integrated
                  ? "py-1 w-full text-center"
                  : "bg-slate-50 rounded-xl p-3 border border-slate-100 text-center"
              }
            >
              <div
                className={
                  integrated
                    ? integratedLabelClass
                    : "text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1"
                }
              >
                {block.label}
              </div>
              <div
                className={
                  integrated
                    ? `${integratedValueClass} whitespace-pre-wrap`
                    : "text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap"
                }
              >
                {block.value}
              </div>
            </div>
          ))}
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
