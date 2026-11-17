import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUpdateExerciseTemplate } from "@/lib/api";
import {
  EXERCISE_KEYWORDS_MAX,
  EXERCISE_LEVEL_MAX,
  EXERCISE_LEVEL_MIN,
  EXERCISE_LOAD_TYPES,
  EXERCISE_MATERIALS,
  EXERCISE_PATTERNS,
  EXERCISE_POSITIONS,
  facetLabel,
  readExerciseFacets,
} from "@shared/exerciseFacets";

type Facets = ReturnType<typeof readExerciseFacets>;
type FacetKey = "pattern" | "material" | "loadType" | "position";

const GROUPS: Array<{ key: FacetKey; label: string; values: readonly string[] }> = [
  { key: "pattern", label: "Pattern", values: EXERCISE_PATTERNS },
  { key: "material", label: "Equipment", values: EXERCISE_MATERIALS },
  { key: "loadType", label: "Hold / reps", values: EXERCISE_LOAD_TYPES },
  { key: "position", label: "Position (optional)", values: EXERCISE_POSITIONS },
];

function readKeywords(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((value): value is string => typeof value === "string").slice(0, EXERCISE_KEYWORDS_MAX)
    : [];
}

/**
 * Coach-only library tags for an exercise template. Each change is saved right away.
 * Nothing here is copied into client plans.
 */
export function ExerciseLibraryTags({
  item,
}: {
  item: { id: string; facets?: unknown; keywords?: unknown; needsVideo?: boolean | null };
}) {
  const { toast } = useToast();
  const updateExerciseTemplate = useUpdateExerciseTemplate();
  const [facets, setFacets] = useState<Facets>(() => readExerciseFacets(item.facets));
  const [keywords, setKeywords] = useState<string[]>(() => readKeywords(item.keywords));
  const [needsVideo, setNeedsVideo] = useState<boolean>(Boolean(item.needsVideo));
  const [keywordDraft, setKeywordDraft] = useState("");

  useEffect(() => {
    setFacets(readExerciseFacets(item.facets));
    setKeywords(readKeywords(item.keywords));
    setNeedsVideo(Boolean(item.needsVideo));
  }, [item.id, item.facets, item.keywords, item.needsVideo]);

  const save = async (patch: Record<string, unknown>) => {
    try {
      await updateExerciseTemplate.mutateAsync({ id: item.id, ...patch } as any);
    } catch {
      toast({ title: "Could not save library tags", variant: "destructive" });
    }
  };

  const toggleFacet = (key: FacetKey, value: string) => {
    const current = facets[key] as string[];
    const nextValues = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    const next = { ...facets, [key]: nextValues } as Facets;
    setFacets(next);
    void save({ facets: next });
  };

  const setLevel = (level: number | null) => {
    const next = { ...facets, level };
    setFacets(next);
    void save({ facets: next });
  };

  const addKeyword = () => {
    const text = keywordDraft.trim();
    if (!text || keywords.length >= EXERCISE_KEYWORDS_MAX || keywords.includes(text)) return;
    const next = [...keywords, text];
    setKeywords(next);
    setKeywordDraft("");
    void save({ keywords: next });
  };

  const removeKeyword = (keyword: string) => {
    const next = keywords.filter((entry) => entry !== keyword);
    setKeywords(next);
    void save({ keywords: next });
  };

  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <div
      className="space-y-3 rounded-md border border-slate-200 bg-white p-3"
      onClick={stop}
      onPointerDown={stop}
      data-testid={`exercise-library-tags-${item.id}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Library tags · only you see these
      </p>

      {GROUPS.map((group) => (
        <div key={group.key} className="space-y-1">
          <Label className="text-xs text-slate-500">{group.label}</Label>
          <div className="flex flex-wrap gap-1.5">
            {group.values.map((value) => {
              const selected = (facets[group.key] as string[]).includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleFacet(group.key, value)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    selected
                      ? "border-[var(--color-brand-500)] bg-[var(--color-brand-100)] text-[var(--color-brand-700)]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {facetLabel(value)}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Level on its ladder</Label>
          <div className="flex gap-1">
            {Array.from(
              { length: EXERCISE_LEVEL_MAX - EXERCISE_LEVEL_MIN + 1 },
              (_, index) => EXERCISE_LEVEL_MIN + index,
            ).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setLevel(facets.level === level ? null : level)}
                className={`h-7 w-7 rounded-md border text-xs font-semibold ${
                  facets.level === level
                    ? "border-[var(--color-brand-500)] bg-[var(--color-brand-100)] text-[var(--color-brand-700)]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5">
          <Label className="text-xs text-slate-500">Needs video</Label>
          <Switch
            checked={needsVideo}
            onCheckedChange={(checked) => {
              setNeedsVideo(checked);
              void save({ needsVideo: checked });
            }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-slate-500">
          Keywords (max {EXERCISE_KEYWORDS_MAX}) · when do you want to find this again?
        </Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {keywords.map((keyword) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
            >
              {keyword}
              <button
                type="button"
                onClick={() => removeKeyword(keyword)}
                aria-label={`Remove ${keyword}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {keywords.length < EXERCISE_KEYWORDS_MAX ? (
            <Input
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addKeyword();
                }
              }}
              onBlur={addKeyword}
              placeholder="e.g. hips sag in push-up"
              className="h-7 w-56 bg-white text-xs"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
