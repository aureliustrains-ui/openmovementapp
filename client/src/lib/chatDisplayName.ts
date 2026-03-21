import { resolveUserFirstName } from "@/lib/userDisplayName";

type ChatSenderLike = {
  senderProfile?: {
    firstName?: string | null;
    infos?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
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
  const explicitProfileFirstName = normalize(profile?.firstName || profile?.infos);
  if (explicitProfileFirstName) return explicitProfileFirstName;

  const profileName = resolveUserFirstName(profile);
  if (profileName && profileName !== "there") return profileName;

  const fallback = firstToken(sender?.senderName || sender?.sender);
  return fallback || "Profile";
}
