type PhaseLike = {
  id: string;
  status?: string | null;
  startDate?: string | null;
};

export function parsePhaseStartDateForSort(value: unknown): number {
  if (typeof value !== "string" || value.trim().length === 0) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function pickDefaultVisiblePhase<T extends PhaseLike>(phases: T[]): T | null {
  if (phases.length === 0) return null;

  const activePhases = phases.filter((phase) => phase.status === "Active");
  if (activePhases.length > 0) {
    const orderedActivePhases = [...activePhases].sort((a, b) => {
      const startDateDelta =
        parsePhaseStartDateForSort(b.startDate) - parsePhaseStartDateForSort(a.startDate);
      if (startDateDelta !== 0) return startDateDelta;
      return a.id.localeCompare(b.id);
    });
    return orderedActivePhases[0];
  }

  const pendingPhase = phases.find((phase) => phase.status === "Waiting for Movement Check");
  return pendingPhase || phases[0];
}
