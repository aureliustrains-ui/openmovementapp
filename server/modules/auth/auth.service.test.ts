import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@shared/schema";
import { AppError } from "../../http/error-handler";
import {
  changeAuthenticatedUserPassword,
  loginWithEmailPassword,
  requireAuthenticatedUser,
} from "./auth.service";

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

test("loginWithEmailPassword rejects inactive accounts", async () => {
  await assert.rejects(
    () =>
      loginWithEmailPassword(
        { email: "inactive@example.com", password: "secret123" },
        {
          users: {
            getUserByEmail: async () => buildUser({ status: "Inactive" }),
            getUser: async () => undefined,
          },
          verifyPassword: async () => true,
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 403);
      assert.equal(error.code, "ACCOUNT_INACTIVE");
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

test("requireAuthenticatedUser rejects inactive accounts", async () => {
  await assert.rejects(
    () =>
      requireAuthenticatedUser("user_1", {
        users: {
          getUserByEmail: async () => undefined,
          getUser: async () => buildUser({ status: "Inactive" }),
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 403);
      assert.equal(error.code, "ACCOUNT_INACTIVE");
      return true;
    },
  );
});

test("changeAuthenticatedUserPassword updates password hash on valid input", async () => {
  let updatedPasswordHash: string | null | undefined;
  const currentUser = buildUser({ id: "user_change", passwordHash: "stored-hash" });

  await changeAuthenticatedUserPassword(
    {
      userId: currentUser.id,
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
      confirmPassword: "NewPassword123!",
    },
    {
      users: {
        getUserByEmail: async () => undefined,
        getUser: async (id) => (id === currentUser.id ? currentUser : undefined),
        updateUser: async (_id, data) => {
          updatedPasswordHash = data.passwordHash;
          return buildUser({ id: currentUser.id, passwordHash: data.passwordHash ?? null });
        },
      },
      verifyPassword: async (password, storedHash) =>
        password === "OldPassword123!" && storedHash === "stored-hash",
      hashPassword: async (password) => `hashed:${password}`,
    },
  );

  assert.equal(updatedPasswordHash, "hashed:NewPassword123!");
});

test("changeAuthenticatedUserPassword rejects mismatched confirmation", async () => {
  await assert.rejects(
    () =>
      changeAuthenticatedUserPassword(
        {
          userId: "user_1",
          currentPassword: "OldPassword123!",
          newPassword: "NewPassword123!",
          confirmPassword: "DifferentPassword123!",
        },
        {
          users: {
            getUserByEmail: async () => undefined,
            getUser: async () => buildUser(),
            updateUser: async () => buildUser(),
          },
          verifyPassword: async () => true,
          hashPassword: async () => "hashed",
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "PASSWORD_MISMATCH");
      return true;
    },
  );
});

test("changeAuthenticatedUserPassword rejects incorrect current password", async () => {
  await assert.rejects(
    () =>
      changeAuthenticatedUserPassword(
        {
          userId: "user_1",
          currentPassword: "WrongPassword123!",
          newPassword: "NewPassword123!",
          confirmPassword: "NewPassword123!",
        },
        {
          users: {
            getUserByEmail: async () => undefined,
            getUser: async () => buildUser({ passwordHash: "stored-hash" }),
            updateUser: async () => buildUser(),
          },
          verifyPassword: async () => false,
          hashPassword: async () => "hashed",
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 401);
      assert.equal(error.code, "INVALID_CURRENT_PASSWORD");
      return true;
    },
  );
});

test("changeAuthenticatedUserPassword enforces password length rules", async () => {
  await assert.rejects(
    () =>
      changeAuthenticatedUserPassword(
        {
          userId: "user_1",
          currentPassword: "OldPassword123!",
          newPassword: "short",
          confirmPassword: "short",
        },
        {
          users: {
            getUserByEmail: async () => undefined,
            getUser: async () => buildUser({ passwordHash: "stored-hash" }),
            updateUser: async () => buildUser(),
          },
          verifyPassword: async () => true,
          hashPassword: async () => "hashed",
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "INVALID_PASSWORD");
      return true;
    },
  );
});
