import type { User } from "@shared/schema";
import { AppError } from "../../http/error-handler";

type AuthUserRepo = {
  getUserByEmail(email: string): Promise<User | undefined>;
  getUser(id: string): Promise<User | undefined>;
};

type LoginDeps = {
  users: AuthUserRepo;
  verifyPassword: (password: string, storedHash: string) => Promise<boolean>;
};

export async function loginWithEmailPassword(
  input: { email: string; password: string },
  deps: LoginDeps,
): Promise<User> {
  const user = await deps.users.getUserByEmail(input.email.toLowerCase());
  if (!user?.passwordHash) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const validPassword = await deps.verifyPassword(input.password, user.passwordHash);
  if (!validPassword) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  return user;
}

export async function requireAuthenticatedUser(
  userId: string | undefined,
  deps: { users: AuthUserRepo },
): Promise<User> {
  if (!userId) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const user = await deps.users.getUser(userId);
  if (!user) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }

  return user;
}
