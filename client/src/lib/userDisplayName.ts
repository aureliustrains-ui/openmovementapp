type UserDisplaySource = {
  firstName?: string | null;
  infos?: string | null;
  name?: string | null;
  email?: string | null;
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstToken(value: string): string {
  const [first] = value.split(/\s+/);
  return first || "";
}

function looksLikeSingleTokenName(value: string): boolean {
  return value.split(/\s+/).length === 1;
}

export function resolveUserFirstName(user: UserDisplaySource | null | undefined): string {
  const explicitFirstName = normalize(user?.firstName || user?.infos);
  if (explicitFirstName) return explicitFirstName;

  const name = normalize(user?.name);
  if (name && !looksLikeSingleTokenName(name)) {
    const token = firstToken(name);
    if (token) return token;
  }

  const emailLocalPart = normalize(user?.email).split("@")[0] || "";
  if (emailLocalPart) return emailLocalPart;

  if (name) return name;
  return "there";
}

