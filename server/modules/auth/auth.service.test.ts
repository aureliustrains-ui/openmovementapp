import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@shared/schema";
import { AppError } from "../../http/error-handler";
import { loginWithEmailPassword, requireAuthenticatedUser } from "./auth.service";

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user_1",
    name: "Demo User",
    email: "demo@example.com",
    passwordHash: "salt:hash",
    role: "Client",
    status: "Active",
    avatar: null,
    bio: null,
    height: null,
    weight: null,
    goals: null,
    infos: null,
    specifics: null,
    specificsUpdatedAt: null,
    specificsUpdatedBy: null,
    ...overrides,
  };
}

test("loginWithEmailPassword returns user on valid credentials", async () => {
  const result = await loginWithEmailPassword(
    { email: "Demo@Example.com", password: "secret123" },
    {
      users: {
        getUserByEmail: async (email) => buildUser({ email }),
        getUser: async () => undefined,
      },
      verifyPassword: async () => true,
    },
  );

  assert.equal(result.email, "demo@example.com");
});

test("loginWithEmailPassword throws AppError for invalid credentials", async () => {
  await assert.rejects(
    () =>
      loginWithEmailPassword(
        { email: "missing@example.com", password: "wrong" },
        {
          users: {
            getUserByEmail: async () => undefined,
            getUser: async () => undefined,
          },
          verifyPassword: async () => false,
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 401);
      assert.equal(error.code, "INVALID_CREDENTIALS");
      return true;
    },
  );
});

test("requireAuthenticatedUser throws for missing session user id", async () => {
  await assert.rejects(
    () =>
      requireAuthenticatedUser(undefined, {
        users: {
          getUserByEmail: async () => undefined,
          getUser: async () => undefined,
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 401);
      assert.equal(error.code, "UNAUTHORIZED");
      return true;
    },
  );
});
