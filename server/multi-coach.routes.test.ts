import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import type { User } from "@shared/schema";

type StorageLike = Record<string, unknown>;

async function loadRouteDeps() {
  delete process.env.BOOTSTRAP_ADMIN_EMAIL;
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/dbname?sslmode=require";
  process.env.SESSION_SECRET ??= "test-session-secret-123456";
  process.env.NODE_ENV = "test";

  const [{ registerRoutes }, { storage }] = await Promise.all([
    import("./routes"),
    import("./storage"),
  ]);
  return { registerRoutes, storage: storage as unknown as StorageLike };
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "admin_1",
    name: "Admin One",
    email: "admin@example.com",
    passwordHash: "hash",
    role: "Admin",
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

async function withPatchedStorage<T>(
  storage: StorageLike,
  patches: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const originals = Object.entries(patches).map(([key]) => [key, storage[key]] as const);
  for (const [key, value] of Object.entries(patches)) {
    storage[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of originals) {
      storage[key] = value;
    }
  }
}

async function withTestServer<T>(
  registerRoutes: (
    httpServer: ReturnType<typeof createServer>,
    app: express.Express,
  ) => Promise<unknown>,
  fn: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userIdHeader = req.headers["x-test-user-id"];
    const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
    (
      req as {
        session?: {
          userId?: string;
          save: (cb: (error?: unknown) => void) => void;
          destroy: (cb: () => void) => void;
        };
      }
    ).session = {
      userId: userId || undefined,
      save: (cb) => cb(),
      destroy: (cb: () => void) => cb(),
    };
    next();
  });

  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      httpServer.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      httpServer.off("error", onError);
      resolve();
    };
    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
    httpServer.listen(0, "127.0.0.1");
  });
  const address = httpServer.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
}


const owner = buildUser({ id: "owner_1", role: "Admin", email: "owner@example.com" });
const coachA = buildUser({ id: "coach_a", role: "Coach", email: "a@example.com" });
const coachB = buildUser({ id: "coach_b", role: "Coach", email: "b@example.com" });
const clientA = buildUser({ id: "client_a", role: "Client", coachId: "coach_a", email: "ca@example.com" });
const clientB = buildUser({ id: "client_b", role: "Client", coachId: "coach_b", email: "cb@example.com" });
const allUsers = [owner, coachA, coachB, clientA, clientB];

const phases = [
  { id: "phase_a", clientId: "client_a", name: "A", status: "Active" },
  { id: "phase_b", clientId: "client_b", name: "B", status: "Active" },
];

const baseStorage = {
  getUser: async (id: string) => allUsers.find((user) => user.id === id),
  getUsers: async () => allUsers,
  getPhases: async () => phases,
  getPhase: async (id: string) => phases.find((phase) => phase.id === id),
  getPhasesByClient: async (clientId: string) => phases.filter((p) => p.clientId === clientId),
  getMessages: async () => [],
  getChatReadStatusByUser: async () => [],
};

function as(userId: string) {
  return { "x-test-user-id": userId };
}

test("a coach lists and opens only their own clients' data", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  await withPatchedStorage(storage, baseStorage, async () => {
    await withTestServer(registerRoutes, async (baseUrl) => {
      const usersRes = await fetch(`${baseUrl}/api/users`, { headers: as("coach_a") });
      assert.equal(usersRes.status, 200);
      const ids = ((await usersRes.json()) as Array<{ id: string }>).map((u) => u.id).sort();
      assert.deepEqual(ids, ["client_a", "coach_a"]);

      const ownPhases = await fetch(`${baseUrl}/api/phases?clientId=client_a`, { headers: as("coach_a") });
      assert.equal(ownPhases.status, 200);
      const otherPhases = await fetch(`${baseUrl}/api/phases?clientId=client_b`, { headers: as("coach_a") });
      assert.equal(otherPhases.status, 404);
      const otherPhase = await fetch(`${baseUrl}/api/phases/phase_b`, { headers: as("coach_a") });
      assert.equal(otherPhase.status, 404);
      const allPhases = await fetch(`${baseUrl}/api/phases`, { headers: as("coach_a") });
      assert.deepEqual(((await allPhases.json()) as Array<{ id: string }>).map((p) => p.id), ["phase_a"]);

      const otherNote = await fetch(`${baseUrl}/api/clients/client_b/specifics`, { headers: as("coach_a") });
      assert.equal(otherNote.status, 404);
      const otherCheckins = await fetch(`${baseUrl}/api/clients/client_b/checkins/summary`, { headers: as("coach_a") });
      assert.equal(otherCheckins.status, 404);
    });
  });
});

test("the owner sees every client", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  await withPatchedStorage(storage, baseStorage, async () => {
    await withTestServer(registerRoutes, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/phases`, { headers: as("owner_1") });
      assert.equal(((await res.json()) as unknown[]).length, 2);
      const one = await fetch(`${baseUrl}/api/phases/phase_b`, { headers: as("owner_1") });
      assert.equal(one.status, 200);
    });
  });
});

test("a coach cannot create plans for, remove, or message another coach's client", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  await withPatchedStorage(storage, baseStorage, async () => {
    await withTestServer(registerRoutes, async (baseUrl) => {
      const json = { "content-type": "application/json", ...as("coach_a") };
      const del = await fetch(`${baseUrl}/api/users/client_b`, { method: "DELETE", headers: as("coach_a") });
      assert.equal(del.status, 404);
      const status = await fetch(`${baseUrl}/api/users/client_b/status`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify({ status: "Inactive" }),
      });
      assert.equal(status.status, 404);
      const message = await fetch(`${baseUrl}/api/messages`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ clientId: "client_b", text: "hi" }),
      });
      assert.equal(message.status, 404);
    });
  });
});

test("coach management is owner only", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  await withPatchedStorage(storage, { ...baseStorage, getExerciseTemplates: async () => [] }, async () => {
    await withTestServer(registerRoutes, async (baseUrl) => {
      const asCoach = await fetch(`${baseUrl}/api/admin/coaches`, { headers: as("coach_a") });
      assert.equal(asCoach.status, 403);
      const asClient = await fetch(`${baseUrl}/api/admin/coaches`, { headers: as("client_a") });
      assert.equal(asClient.status, 403);
      const asOwner = await fetch(`${baseUrl}/api/admin/coaches`, { headers: as("owner_1") });
      assert.equal(asOwner.status, 200);
      const csv = await fetch(`${baseUrl}/api/admin/contacts.csv`, { headers: as("coach_a") });
      assert.equal(csv.status, 403);
    });
  });
});

test("a coach edits only the library items they added", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const exercises = [
    { id: "ex_a", name: "Mine", createdBy: "coach_a" },
    { id: "ex_b", name: "Theirs", createdBy: "coach_b" },
    { id: "ex_o", name: "Owner's", createdBy: null },
  ];
  await withPatchedStorage(
    storage,
    {
      ...baseStorage,
      getExerciseTemplates: async () => exercises,
      updateExerciseTemplate: async (id: string) => exercises.find((e) => e.id === id),
      deleteExerciseTemplate: async () => true,
    },
    async () => {
      await withTestServer(registerRoutes, async (baseUrl) => {
        const json = { "content-type": "application/json", ...as("coach_a") };
        const patch = (id: string) =>
          fetch(`${baseUrl}/api/exercise-templates/${id}`, {
            method: "PATCH",
            headers: json,
            body: JSON.stringify({ name: "Changed" }),
          });
        assert.equal((await patch("ex_a")).status, 200);
        assert.equal((await patch("ex_b")).status, 403);
        assert.equal((await patch("ex_o")).status, 403);
        const del = await fetch(`${baseUrl}/api/exercise-templates/ex_b`, { method: "DELETE", headers: as("coach_a") });
        assert.equal(del.status, 403);
        const ownerDel = await fetch(`${baseUrl}/api/exercise-templates/ex_b`, { method: "DELETE", headers: as("owner_1") });
        assert.equal(ownerDel.status, 200);
        // Everyone on the team can read the shared library.
        const list = await fetch(`${baseUrl}/api/exercise-templates`, { headers: as("coach_a") });
        assert.equal(list.status, 200);
      });
    },
  );
});
