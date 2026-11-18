import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@shared/schema";
import { PRIMARY_ADMIN_EMAIL } from "./admin-access";
import {
  accessibleClientFilter,
  canAccessClient,
  canEditTemplate,
  isCoach,
  isOwner,
  isStaff,
} from "./access";

function user(overrides: Partial<User>): User {
  return {
    id: "u",
    name: "Name",
    email: "x@example.com",
    passwordHash: "h",
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
    coachId: null,
    ...overrides,
  };
}

const owner = user({ id: "owner", role: "Admin", email: PRIMARY_ADMIN_EMAIL });
const coachA = user({ id: "coachA", role: "Coach", email: "a@example.com" });
const coachB = user({ id: "coachB", role: "Coach", email: "b@example.com" });
const removedCoach = user({ id: "coachC", role: "Coach", status: "Removed", email: "c@example.com" });
const ownerClient = user({ id: "c0", coachId: null });
const clientOfA = user({ id: "c1", coachId: "coachA" });
const clientOfB = user({ id: "c2", coachId: "coachB" });

test("roles", () => {
  assert.equal(isOwner(owner), true);
  assert.equal(isOwner(coachA), false);
  assert.equal(isCoach(coachA), true);
  assert.equal(isCoach(removedCoach), false);
  assert.equal(isStaff(coachA), true);
  assert.equal(isStaff(removedCoach), false);
  assert.equal(isStaff(clientOfA), false);
});

test("owner sees every client", () => {
  for (const client of [ownerClient, clientOfA, clientOfB]) {
    assert.equal(canAccessClient(owner, client), true);
  }
});

test("a coach sees only their own clients", () => {
  assert.equal(canAccessClient(coachA, clientOfA), true);
  assert.equal(canAccessClient(coachA, clientOfB), false);
  assert.equal(canAccessClient(coachA, ownerClient), false);
  assert.equal(canAccessClient(coachB, clientOfA), false);
});

test("a removed coach sees nothing", () => {
  assert.equal(canAccessClient(removedCoach, clientOfA), false);
  assert.equal(canAccessClient(removedCoach, user({ id: "c3", coachId: "coachC" })), false);
});

test("coach accounts are not reachable as clients", () => {
  assert.equal(canAccessClient(coachA, coachB), false);
  assert.equal(canAccessClient(owner, coachA), false);
});

test("a client sees only themselves", () => {
  assert.equal(canAccessClient(clientOfA, clientOfA), true);
  assert.equal(canAccessClient(clientOfA, clientOfB), false);
});

test("client filter matches the same rules", () => {
  const all = [ownerClient, clientOfA, clientOfB, coachA];
  assert.deepEqual(all.filter(accessibleClientFilter(owner)).map((u) => u.id), ["c0", "c1", "c2"]);
  assert.deepEqual(all.filter(accessibleClientFilter(coachA)).map((u) => u.id), ["c1"]);
  assert.deepEqual(all.filter(accessibleClientFilter(clientOfA)).map((u) => u.id), []);
});

test("library edits: owner everything, coach only their own", () => {
  assert.equal(canEditTemplate(owner, { createdBy: "coachA" }), true);
  assert.equal(canEditTemplate(owner, { createdBy: null }), true);
  assert.equal(canEditTemplate(coachA, { createdBy: "coachA" }), true);
  assert.equal(canEditTemplate(coachA, { createdBy: "coachB" }), false);
  assert.equal(canEditTemplate(coachA, { createdBy: null }), false);
  assert.equal(canEditTemplate(removedCoach, { createdBy: "coachC" }), false);
});
