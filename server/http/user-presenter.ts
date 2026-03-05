import type { User } from "@shared/schema";

export type PublicUser = Omit<User, "passwordHash">;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...safeUser } = user;
  void passwordHash;
  return safeUser;
}
