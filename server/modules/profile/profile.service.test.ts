import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@shared/schema";
import { AppError } from "../../http/error-handler";
import { updateMyProfile } from "./profile.service";

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

test("updateMyProfile updates profile fields for an admin user", async () => {
  const updated = await updateMyProfile(
    "admin_1",
    { bio: "Coach bio", height: "180 cm", weight: "80 kg", goals: "Grow", infos: "None" },
    {
      users: {
        getUserByEmail: async () => undefined,
        getUser: async (id) => buildUser({ id, role: "Admin" }),
        updateUser: async (id, data) => buildUser({ id, role: "Admin", ...data }),
      },
    },
  );

  assert.equal(updated.role, "Admin");
  assert.equal(updated.bio, "Coach bio");
  assert.equal(updated.goals, "Grow");
});

test("updateMyProfile updates profile fields for a client user", async () => {
  const updated = await updateMyProfile(
    "client_1",
    { bio: "Client bio", goals: "Consistency" },
    {
      users: {
        getUserByEmail: async () => undefined,
        getUser: async (id) => buildUser({ id, role: "Client" }),
        updateUser: async (id, data) => buildUser({ id, role: "Client", ...data }),
      },
    },
  );

  assert.equal(updated.role, "Client");
  assert.equal(updated.bio, "Client bio");
  assert.equal(updated.goals, "Consistency");
});

test("updateMyProfile throws typed error when user is missing", async () => {
  await assert.rejects(
    () =>
      updateMyProfile(
        "missing",
        { bio: "x" },
        {
          users: {
            getUserByEmail: async () => undefined,
            getUser: async () => undefined,
            updateUser: async () => undefined,
          },
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 404);
      assert.equal(error.code, "USER_NOT_FOUND");
      return true;
    },
  );
});

test("updateMyProfile enforces unique email", async () => {
  await assert.rejects(
    () =>
      updateMyProfile(
        "client_1",
        { email: "taken@example.com" },
        {
          users: {
            getUserByEmail: async () => buildUser({ id: "other_user", email: "taken@example.com" }),
            getUser: async (id) => buildUser({ id, email: "old@example.com" }),
            updateUser: async (id, data) => buildUser({ id, ...data }),
          },
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

test("updateMyProfile accepts stored avatar paths from upload endpoint", async () => {
  const updated = await updateMyProfile(
    "client_1",
    { avatar: "/uploads/avatars/1700000000-demo.webp" },
    {
      users: {
        getUserByEmail: async () => undefined,
        getUser: async (id) => buildUser({ id, avatar: null }),
        updateUser: async (id, data) => buildUser({ id, avatar: data.avatar ?? null }),
      },
    },
  );

  assert.equal(updated.avatar, "/uploads/avatars/1700000000-demo.webp");
});
