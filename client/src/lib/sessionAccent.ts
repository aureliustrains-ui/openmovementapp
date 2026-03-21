const SESSION_ACCENT_COLORS = [
  "var(--color-session-blue)",
  "var(--color-session-terracotta)",
  "var(--color-session-olive)",
  "var(--color-session-teal)",
  "var(--color-session-plum)",
  "var(--color-session-sand)",
] as const;

type SessionIdentity = {
  id?: string | null;
  name?: string | null;
  templateId?: string | null;
};

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getSessionIdentityKey(session: SessionIdentity | string): string {
  if (typeof session === "string") return session;
  return (
    session.id?.trim() ||
    session.templateId?.trim() ||
    session.name?.trim().toLowerCase() ||
    "session"
  );
}

export function getSessionAccentColor(session: SessionIdentity | string): string {
  const identityKey = getSessionIdentityKey(session);
  const paletteIndex = hashString(identityKey) % SESSION_ACCENT_COLORS.length;
  return SESSION_ACCENT_COLORS[paletteIndex];
}
