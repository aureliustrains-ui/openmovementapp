import test from "node:test";
import assert from "node:assert/strict";
import { toPublicUser } from "./user-presenter";

test("toPublicUser removes passwordHash", () => {
  const user = {
    id: "u1",
    name: "Test User",
    email: "test@example.com",
    passwordHash: "salt:hash",
    role: "Client",
    status: "Active",
    avatar: null,
  };

  const publicUser = toPublicUser(user);

  assert.equal("passwordHash" in publicUser, false);
  assert.equal(publicUser.email, "test@example.com");
  assert.equal(publicUser.role, "Client");
});
