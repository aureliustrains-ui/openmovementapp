import test from "node:test";
import assert from "node:assert/strict";
import type { InsertUser, User } from "@shared/schema";
import { AppError } from "../../http/error-handler";
import { createUserAccount } from "./users.service";

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "u_1",
    name: "Test User",
    email: "test@example.com",
    passwordHash: "salt:hash",
    role: "Client",
    status: "Active",
    avatar: null,
    ...overrides,
  };
}

test("createUserAccount normalizes email and persists hashed password", async () => {
  let capturedInsert: InsertUser | null = null;

  const created = await createUserAccount(
    {
      name: "New User",
      email: "NewUser@Example.COM",
      password: "password123",
      role: "Client",
      status: "Active",
      avatar: null,
    },
    {
      users: {
        getUserByEmail: async () => undefined,
        createUser: async (user) => {
          capturedInsert = user;
          return buildUser({
            name: user.name,
            email: user.email,
            passwordHash: user.passwordHash,
            role: user.role,
            status: user.status,
            avatar: user.avatar ?? null,
          });
        },
      },
      hashPassword: async () => "hashed-password",
    },
  );

  assert.ok(capturedInsert);
  assert.equal(capturedInsert?.email, "newuser@example.com");
  assert.equal(capturedInsert?.passwordHash, "hashed-password");
  assert.equal(created.email, "newuser@example.com");
});

test("createUserAccount throws typed domain error for duplicate email", async () => {
  await assert.rejects(
    () =>
      createUserAccount(
        {
          name: "Dup User",
          email: "dup@example.com",
          password: "password123",
          role: "Admin",
          status: "Active",
          avatar: null,
        },
        {
          users: {
            getUserByEmail: async () => buildUser({ email: "dup@example.com" }),
            createUser: async (_user) => buildUser(),
          },
          hashPassword: async () => "hashed",
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 409);
      assert.equal(error.code, "EMAIL_IN_USE");
      return true;
    },
  );
});
