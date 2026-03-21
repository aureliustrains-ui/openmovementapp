import type { User } from "@shared/schema";
import { AppError } from "../../http/error-handler";

type AuthUserRepo = {
  getUserByEmail(email: string): Promise<User | undefined>;
  getUser(id: string): Promise<User | undefined>;
  updateUser?(id: string, data: { passwordHash?: string | null }): Promise<User | undefined>;
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

  if (user.status !== "Active") {
    throw new AppError("Account is inactive", 403, "ACCOUNT_INACTIVE");
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
  if (user.status !== "Active") {
    throw new AppError("Account is inactive", 403, "ACCOUNT_INACTIVE");
  }

  return user;
}

type PasswordChangeDeps = {
  users: AuthUserRepo & {
    updateUser(id: string, data: { passwordHash?: string | null }): Promise<User | undefined>;
  };
  verifyPassword: (password: string, storedHash: string) => Promise<boolean>;
  hashPassword: (password: string) => Promise<string>;
};

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export async function changeAuthenticatedUserPassword(
  input: {
    userId: string | undefined;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
  deps: PasswordChangeDeps,
): Promise<void> {
  const normalizedNewPassword = input.newPassword.trim();
  const normalizedConfirmPassword = input.confirmPassword.trim();

  if (!normalizedNewPassword || !normalizedConfirmPassword) {
    throw new AppError("New password is required", 400, "NEW_PASSWORD_REQUIRED");
  }

  if (normalizedNewPassword !== normalizedConfirmPassword) {
    throw new AppError("New password and confirmation do not match", 400, "PASSWORD_MISMATCH");
  }

  if (
    normalizedNewPassword.length < MIN_PASSWORD_LENGTH ||
    normalizedNewPassword.length > MAX_PASSWORD_LENGTH
  ) {
    throw new AppError(
      `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
      400,
      "INVALID_PASSWORD",
    );
  }

  const user = await requireAuthenticatedUser(input.userId, { users: deps.users });
  if (!user.passwordHash) {
    throw new AppError(
      "Password change is unavailable for this account",
      400,
      "PASSWORD_UNAVAILABLE",
    );
  }

  const currentPasswordValid = await deps.verifyPassword(input.currentPassword, user.passwordHash);
  if (!currentPasswordValid) {
    throw new AppError("Current password is incorrect", 401, "INVALID_CURRENT_PASSWORD");
  }

  if (input.currentPassword === normalizedNewPassword) {
    throw new AppError(
      "New password must be different from current password",
      400,
      "PASSWORD_UNCHANGED",
    );
  }

  const newPasswordHash = await deps.hashPassword(normalizedNewPassword);
  const updated = await deps.users.updateUser(user.id, { passwordHash: newPasswordHash });
  if (!updated) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
}
