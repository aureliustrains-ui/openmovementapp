type PhaseWithMovementChecks = {
  status?: string | null;
  movementChecks?: unknown;
};

export type SessionEntryDestination =
  | { kind: "movement-check"; href: string }
  | { kind: "session"; href: string };

type SessionEntryInput = {
  phase: PhaseWithMovementChecks | null | undefined;
  sessionId: string;
  week: number;
  day: string;
  slot: string;
  movementCheckHref?: string;
};

function isApprovedMovementCheckStatus(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "approved";
}

function getMovementChecks(phase: PhaseWithMovementChecks | null | undefined): Array<{ status?: unknown }> {
  if (!phase || !Array.isArray(phase.movementChecks)) return [];
  return phase.movementChecks as Array<{ status?: unknown }>;
}

export function requiresMovementCheckBeforeSession(
  phase: PhaseWithMovementChecks | null | undefined,
): boolean {
  if (!phase) return false;
  if (phase.status === "Waiting for Movement Check") return true;

  const checks = getMovementChecks(phase);
  if (checks.length === 0) return false;
  return checks.some((check) => !isApprovedMovementCheckStatus(check?.status));
}

export function buildClientSessionHref(input: {
  sessionId: string;
  week: number;
  day: string;
  slot: string;
}): string {
  const slot = input.slot || "AM";
  return `/app/client/session/${input.sessionId}?week=${input.week}&day=${encodeURIComponent(input.day)}&slot=${encodeURIComponent(slot)}`;
}

export function resolveClientSessionEntryDestination(input: SessionEntryInput): SessionEntryDestination {
  if (requiresMovementCheckBeforeSession(input.phase)) {
    return {
      kind: "movement-check",
      href: input.movementCheckHref || "/app/client/my-phase",
    };
  }

  return {
    kind: "session",
    href: buildClientSessionHref({
      sessionId: input.sessionId,
      week: input.week,
      day: input.day,
      slot: input.slot,
    }),
  };
}
