import { Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { pickExerciseStandard } from "@/lib/exerciseStandard";

/**
 * The one editor for an exercise's prescription and content. Used in the exercise library,
 * the exercise template page and every exercise row in the plan / session / section builders,
 * so all of them show the same fields with the same labels.
 */
export type ExerciseEditableFields = {
  demoUrl: string;
  sets: string;
  reps: string;
  load: string;
  tempo: string;
  goal: string;
  additionalInstructions: string;
  startPosition: string;
  endPosition: string;
  qualityPoints: string;
  progressionStart: string;
  progressionBuild: string;
  progressionNext: string;
  notes: string;
  requiresMovementCheck: boolean;
  enableStructuredLogging: boolean;
};

export type ExerciseFieldKey = keyof ExerciseEditableFields;

export function toExerciseEditableFields(source: any): ExerciseEditableFields {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    demoUrl: text(source?.demoUrl),
    sets: text(source?.sets),
    reps: text(source?.reps),
    load: source?.load === "Auto" ? "" : text(source?.load),
    tempo: text(source?.tempo),
    goal: text(source?.goal),
    additionalInstructions: text(source?.additionalInstructions),
    ...pickExerciseStandard(source),
    notes: text(source?.notes),
    requiresMovementCheck: Boolean(source?.requiresMovementCheck),
    enableStructuredLogging: Boolean(source?.enableStructuredLogging),
  };
}

const labelClass = "text-[10px] font-semibold uppercase tracking-wider text-slate-500";

export function ExerciseFieldsEditor({
  value,
  onChange,
  showMovementCheck = true,
  idPrefix,
}: {
  value: ExerciseEditableFields;
  onChange: <K extends ExerciseFieldKey>(field: K, next: ExerciseEditableFields[K]) => void;
  /** Hide the movement-check switch where the surrounding phase has movement checks off. */
  showMovementCheck?: boolean;
  idPrefix: string;
}) {
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  return (
    <div className="space-y-3" onClick={stop} onPointerDown={stop}>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-demo`} className={labelClass}>
          Demo video
        </Label>
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 shrink-0 text-slate-400" />
          <Input
            id={`${idPrefix}-demo`}
            value={value.demoUrl}
            onChange={(event) => onChange("demoUrl", event.target.value)}
            placeholder="Paste a video link"
            className="h-8 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["sets", "Sets"],
            ["reps", "Reps"],
            ["load", "Load"],
            ["tempo", "Tempo"],
          ] as const
        ).map(([field, label]) => (
          <div key={field} className="space-y-1">
            <Label htmlFor={`${idPrefix}-${field}`} className={labelClass}>
              {label}
            </Label>
            <Input
              id={`${idPrefix}-${field}`}
              value={value[field]}
              onChange={(event) => onChange(field, event.target.value)}
              className="h-8 bg-white"
            />
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <p className={labelClass}>The standard · client sees this</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["startPosition", "Start", "e.g. arms straight, body in one line"],
              ["endPosition", "Top / end", "e.g. rings at the lower ribs, shoulder blades back"],
            ] as const
          ).map(([field, label, placeholder]) => (
            <div key={field} className="space-y-1">
              <Label htmlFor={`${idPrefix}-${field}`} className={labelClass}>
                {label}
              </Label>
              <Textarea
                id={`${idPrefix}-${field}`}
                value={value[field]}
                onChange={(event) => onChange(field, event.target.value)}
                placeholder={placeholder}
                className="min-h-[56px] resize-none bg-white text-sm"
              />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-qualityPoints`} className={labelClass}>
            What counts as a rep
          </Label>
          <Textarea
            id={`${idPrefix}-qualityPoints`}
            value={value.qualityPoints}
            onChange={(event) => onChange("qualityPoints", event.target.value)}
            placeholder="e.g. no hip sag · no shrugging · full range"
            className="min-h-[56px] resize-none bg-white text-sm"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["progressionStart", "Start here", "e.g. the angle where you get 8 clean reps"],
              ["progressionBuild", "Build", "e.g. work up to 12 at the same angle"],
              ["progressionNext", "Then", "e.g. lower the rings, start again at 8"],
            ] as const
          ).map(([field, label, placeholder]) => (
            <div key={field} className="space-y-1">
              <Label htmlFor={`${idPrefix}-${field}`} className={labelClass}>
                {label}
              </Label>
              <Textarea
                id={`${idPrefix}-${field}`}
                value={value[field]}
                onChange={(event) => onChange(field, event.target.value)}
                placeholder={placeholder}
                className="min-h-[56px] resize-none bg-white text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {value.goal.trim() ? (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-goal`} className={labelClass}>
            Goal (older free text) · client sees this unless the standard above has progression
          </Label>
          <Textarea
            id={`${idPrefix}-goal`}
            value={value.goal}
            onChange={(event) => onChange("goal", event.target.value)}
            className="min-h-[56px] resize-none bg-white text-sm"
          />
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-instructions`} className={labelClass}>
          Additional instructions · client sees this
        </Label>
        <Textarea
          id={`${idPrefix}-instructions`}
          value={value.additionalInstructions}
          onChange={(event) => onChange("additionalInstructions", event.target.value)}
          placeholder="Extra cues or reminders"
          className="min-h-[72px] resize-none bg-white text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-notes`} className={labelClass}>
          Coach notes · only you
        </Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={value.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          placeholder="Reminders for yourself, never shown to clients"
          className="min-h-[48px] resize-none bg-white text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {showMovementCheck ? (
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
            Movement check
            <Switch
              checked={value.requiresMovementCheck}
              onCheckedChange={(checked) => onChange("requiresMovementCheck", checked)}
            />
          </label>
        ) : null}
        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
          Log weight and reps per set
          <Switch
            checked={value.enableStructuredLogging}
            onCheckedChange={(checked) => onChange("enableStructuredLogging", checked)}
          />
        </label>
      </div>
    </div>
  );
}
