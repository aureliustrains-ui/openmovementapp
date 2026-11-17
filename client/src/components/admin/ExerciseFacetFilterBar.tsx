import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EXERCISE_LOAD_TYPES,
  EXERCISE_MATERIALS,
  EXERCISE_PATTERNS,
  EXERCISE_POSITIONS,
  facetLabel,
  type ExerciseFacetFilter,
} from "@shared/exerciseFacets";

type FacetKey = "pattern" | "material" | "loadType" | "position";

const FACET_GROUPS: Array<{ key: FacetKey; label: string; values: readonly string[] }> = [
  { key: "pattern", label: "Pattern", values: EXERCISE_PATTERNS },
  { key: "material", label: "Equipment", values: EXERCISE_MATERIALS },
  { key: "loadType", label: "Hold / reps", values: EXERCISE_LOAD_TYPES },
  { key: "position", label: "Position", values: EXERCISE_POSITIONS },
];

export function isFacetFilterActive(filter: ExerciseFacetFilter): boolean {
  return (
    Boolean(filter.needsVideo) ||
    FACET_GROUPS.some((group) => (filter[group.key]?.length ?? 0) > 0)
  );
}

export function ExerciseFacetFilterBar({
  value,
  onChange,
}: {
  value: ExerciseFacetFilter;
  onChange: (next: ExerciseFacetFilter) => void;
}) {
  const toggle = (key: FacetKey, facetValue: string) => {
    const current = value[key] ?? [];
    const next = current.includes(facetValue)
      ? current.filter((entry) => entry !== facetValue)
      : [...current, facetValue];
    onChange({ ...value, [key]: next });
  };
  const active = isFacetFilterActive(value);

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="exercise-facet-filters">
      {FACET_GROUPS.map((group) => {
        const selected = value[group.key] ?? [];
        return (
          <DropdownMenu key={group.key}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant={selected.length > 0 ? "secondary" : "outline"}
                size="sm"
                className="h-8"
              >
                {group.label}
                {selected.length > 0 ? ` · ${selected.length}` : ""}
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              {group.values.map((facetValue) => (
                <DropdownMenuCheckboxItem
                  key={facetValue}
                  checked={selected.includes(facetValue)}
                  onCheckedChange={() => toggle(group.key, facetValue)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {facetLabel(facetValue)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
      <Button
        type="button"
        variant={value.needsVideo ? "secondary" : "outline"}
        size="sm"
        className="h-8"
        onClick={() => onChange({ ...value, needsVideo: !value.needsVideo })}
      >
        Needs video
      </Button>
      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-slate-500"
          onClick={() => onChange({})}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
