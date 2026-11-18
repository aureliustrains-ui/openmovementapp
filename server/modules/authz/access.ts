import type { User } from "@shared/schema";
import { hasAdminAccess } from "./admin-access";

type Actor = Pick<User, "id" | "role" | "email" | "status">;

/** The owner (head coach): sees and edits everything. */
export function isOwner(user: Actor | null | undefined): boolean {
  return !!user && hasAdminAccess(user);
}

/** An active coach: works only with their own clients. */
export function isCoach(user: Actor | null | undefined): boolean {
  return !!user && user.role === "Coach" && user.status === "Active";
}

/** Owner or coach: may use the admin area. */
export function isStaff(user: Actor | null | undefined): boolean {
  return isOwner(user) || isCoach(user);
}

/** Can this person see or change this client's data (plans, logs, reports, messages)? */
export function canAccessClient(
  user: Actor | null | undefined,
  client: Pick<User, "id" | "role" | "coachId"> | null | undefined,
): boolean {
  if (!user || !client) return false;
  if (user.id === client.id) return true;
  if (client.role !== "Client") return false;
  if (isOwner(user)) return true;
  if (isCoach(user)) return client.coachId === user.id;
  return false;
}

/** Library items: the owner edits all, a coach only what they added. */
export function canEditTemplate(
  user: Actor | null | undefined,
  item: { createdBy?: string | null },
): boolean {
  if (!user) return false;
  if (isOwner(user)) return true;
  return isCoach(user) && !!item.createdBy && item.createdBy === user.id;
}

/** Ids of the clients this staff member may see, or null for "everyone" (owner). */
export function accessibleClientFilter(
  user: Actor,
): ((client: Pick<User, "role" | "coachId">) => boolean) {
  if (isOwner(user)) return (c) => c.role === "Client";
  if (isCoach(user)) return (c) => c.role === "Client" && c.coachId === user.id;
  return () => false;
}
