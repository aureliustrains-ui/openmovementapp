import type { InsertUser, User } from "@shared/schema";
import { AppError } from "../../http/error-handler";

export type ProfileUpdateInput = {
  name?: string;
  email?: string;
  avatar?: string | null;
  bio?: string | null;
  height?: string | null;
  weight?: string | null;
  goals?: string | null;
  infos?: string | null;
};

type ProfileUsersPort = {
  getUserByEmail(email: string): Promise<User | undefined>;
  getUser(id: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
};

export async function updateMyProfile(
  userId: string,
  input: ProfileUpdateInput,
  deps: { users: ProfileUsersPort },
): Promise<User> {
  const currentUser = await deps.users.getUser(userId);
  if (!currentUser) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  const normalizedEmail = input.email?.trim().toLowerCase();
  if (normalizedEmail && normalizedEmail !== currentUser.email) {
    const existing = await deps.users.getUserByEmail(normalizedEmail);
    if (existing && existing.id !== userId) {
      throw new AppError("Email already in use", 409, "EMAIL_IN_USE");
    }
  }

  const updated = await deps.users.updateUser(userId, {
    name: input.name?.trim() || currentUser.name,
    email: normalizedEmail || currentUser.email,
    avatar: input.avatar ?? currentUser.avatar ?? null,
    bio: input.bio ?? currentUser.bio ?? null,
    height: input.height ?? currentUser.height ?? null,
    weight: input.weight ?? currentUser.weight ?? null,
    goals: input.goals ?? currentUser.goals ?? null,
    infos: input.infos ?? currentUser.infos ?? null,
  });

  if (!updated) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  return updated;
}
