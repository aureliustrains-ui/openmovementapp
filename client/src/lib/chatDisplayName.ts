type ChatSenderProfileLike = {
  firstName?: string | null;
  infos?: string | null;
  name?: string | null;
};

type ChatSenderLike = {
  senderProfile?: ChatSenderProfileLike | null;
  senderName?: string | null;
  sender?: string | null;
};

function normalize(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstToken(value: string | null | undefined): string {
  const normalized = normalize(value);
  if (!normalized) return "";
  const [first] = normalized.split(/\s+/);
  return first || normalized;
}

export function getChatDisplayFirstName(sender: ChatSenderLike): string {
  const profile = sender?.senderProfile || null;
  const explicitFirstName = normalize(profile?.firstName || profile?.infos);
  if (explicitFirstName) return explicitFirstName;

  const fallback = firstToken(sender?.senderName || profile?.name || sender?.sender);
  return fallback || "Profile";
}

