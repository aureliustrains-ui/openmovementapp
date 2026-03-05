import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./auth";

test("hashPassword + verifyPassword accepts the original password", async () => {
  const password = "StrongPassword123!";
  const hash = await hashPassword(password);

  assert.match(hash, /^[0-9a-f]+:[0-9a-f]+$/);
  assert.equal(await verifyPassword(password, hash), true);
});

test("verifyPassword rejects wrong password", async () => {
  const hash = await hashPassword("correct-password");
  assert.equal(await verifyPassword("wrong-password", hash), false);
});
