import type { User } from "@shared/schema";

export const PRIMARY_ADMIN_EMAIL =
  process.env.PRIMARY_ADMIN_EMAIL?.trim().toLowerCase() ||
  process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ||
  "aureliustrains@gmail.com";

function normalizeEmail(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

export function isPrimaryAdminEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === PRIMARY_ADMIN_EMAIL;
}

export function hasAdminAccess(user: Pick<User, "role" | "email">): boolean {
  if (user.role !== "Admin") return false;
  if (process.env.NODE_ENV === "production") {
    return isPrimaryAdminEmail(user.email);
  }
  return true;
}
