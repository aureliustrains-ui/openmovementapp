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

function emailLocalPart(value: string | null | undefined): string {
  return normalize(value).split("@")[0] || "";
}

export function resolveUserFirstName(user: UserDisplaySource | null | undefined): string {
  const explicitFirstName = normalize(user?.firstName || user?.infos);
  if (explicitFirstName) return explicitFirstName;

  const name = normalize(user?.name);
  if (name && !looksLikeSingleTokenName(name)) {
    const token = firstToken(name);
    if (token) return token;
  }

  const emailLocal = emailLocalPart(user?.email);
  if (emailLocal) return emailLocal;

  if (name) return name;
  return "there";
}

export function resolveUserFullName(user: UserDisplaySource | null | undefined): string {
  const explicitFirstName = normalize(user?.firstName || user?.infos);
  const name = normalize(user?.name);

  if (explicitFirstName && name) {
    const firstLower = explicitFirstName.toLowerCase();
    const nameLower = name.toLowerCase();
    if (nameLower === firstLower || nameLower.startsWith(`${firstLower} `)) {
      return name;
    }
    return `${explicitFirstName} ${name}`;
  }

  if (name) return name;
  if (explicitFirstName) return explicitFirstName;

  const emailLocal = emailLocalPart(user?.email);
  if (emailLocal) return emailLocal;

  return "User";
}
