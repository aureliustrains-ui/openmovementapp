import type { InsertUser, User } from "@shared/schema";
import { AppError } from "../../http/error-handler";

type UserRepo = {
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
};

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: "Admin" | "Client";
  status: string;
  avatar: string | null;
};

type CreateUserDeps = {
  users: UserRepo;
  hashPassword: (password: string) => Promise<string>;
};

export async function createUserAccount(
  input: CreateUserInput,
  deps: CreateUserDeps,
): Promise<User> {
  const normalizedEmail = input.email.toLowerCase();
  const existing = await deps.users.getUserByEmail(normalizedEmail);
  if (existing) {
    throw new AppError("Email already in use", 409, "EMAIL_IN_USE");
  }

  const passwordHash = await deps.hashPassword(input.password);
  return deps.users.createUser({
    name: input.name,
    email: normalizedEmail,
    passwordHash,
    role: input.role,
    status: input.status,
    avatar: input.avatar,
  });
}
