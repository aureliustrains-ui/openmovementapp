import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@shared/schema";
import { hasAdminAccess, isPrimaryAdminEmail, PRIMARY_ADMIN_EMAIL } from "./admin-access";

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

test("isPrimaryAdminEmail matches the single allowed production admin email", () => {
  assert.equal(isPrimaryAdminEmail(PRIMARY_ADMIN_EMAIL), true);
  assert.equal(isPrimaryAdminEmail(` ${PRIMARY_ADMIN_EMAIL.toUpperCase()} `), true);
  assert.equal(isPrimaryAdminEmail("other-admin@example.com"), false);
});

test("hasAdminAccess allows any admin in development and only primary admin in production", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    assert.equal(hasAdminAccess(buildUser({ role: "Admin", email: "admin@example.com" })), true);

    process.env.NODE_ENV = "production";
    assert.equal(hasAdminAccess(buildUser({ role: "Admin", email: PRIMARY_ADMIN_EMAIL })), true);
    assert.equal(hasAdminAccess(buildUser({ role: "Admin", email: "admin@example.com" })), false);
    assert.equal(hasAdminAccess(buildUser({ role: "Client", email: PRIMARY_ADMIN_EMAIL })), false);
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
  }
});
