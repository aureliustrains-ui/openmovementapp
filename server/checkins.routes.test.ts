import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { getWeekStartDateUtc } from "./modules/checkins/checkins.service";
import type {
  InsertSessionCheckin,
  InsertWeeklyCheckin,
  Phase,
  Session,
  SessionCheckin,
  User,
  WeeklyCheckin,
} from "@shared/schema";

type StorageLike = Record<string, unknown>;

async function loadRouteDeps() {
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
    id: "client_1",
    name: "Client One",
    email: "client@example.com",
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

function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session_1",
    phaseId: "phase_1",
    name: "Session 1",
    description: null,
    completedInstances: [],
    sections: [],
    ...overrides,
  };
}

function buildPhase(overrides: Partial<Phase> = {}): Phase {
  return {
    id: "phase_1",
    clientId: "client_1",
    name: "Phase 1",
    goal: null,
    startDate: null,
    durationWeeks: 4,
    status: "Active",
    movementChecks: [],
    schedule: [],
    completedScheduleInstances: [],
    ...overrides,
  };
}

async function withPatchedStorage<T>(
  storage: StorageLike,
  patches: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const originalEntries = Object.entries(patches).map(([key]) => [key, storage[key]] as const);
  for (const [key, value] of Object.entries(patches)) {
    storage[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of originalEntries) {
      storage[key] = value;
    }
  }
}

async function withTestServer<T>(
  registerRoutes: (httpServer: ReturnType<typeof createServer>, app: express.Express) => Promise<unknown>,
  fn: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userIdHeader = req.headers["x-test-user-id"];
    const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
    (req as { session?: { userId?: string; destroy: (cb: () => void) => void } }).session = {
      userId: userId || undefined,
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

test("POST /api/session-checkins inserts row and admin recent endpoint returns it", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);
  const sessionRows = new Map<string, Session>([["session_1", buildSession({ id: "session_1", phaseId: "phase_1" })]]);
  const phaseRows = new Map<string, Phase>([["phase_1", buildPhase({ id: "phase_1", clientId: "client_1" })]]);
  const sessionCheckins: SessionCheckin[] = [];
  const weeklyCheckins: WeeklyCheckin[] = [];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getSession: async (id: string) => sessionRows.get(id),
      getPhase: async (id: string) => phaseRows.get(id),
      createSessionCheckin: async (payload: InsertSessionCheckin) => {
        const row: SessionCheckin = { id: `sc_${sessionCheckins.length + 1}`, ...payload };
        sessionCheckins.push(row);
        return row;
      },
      getSessionCheckinsByClient: async (clientId: string) =>
        sessionCheckins.filter((entry) => entry.clientId === clientId),
      getWeeklyCheckinsByClient: async (_clientId: string) => weeklyCheckins,
      getSessions: async () => Array.from(sessionRows.values()),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const createRes = await fetch(`${baseUrl}/api/session-checkins`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              sessionId: "session_1",
              rpeOverall: 7,
              feltOff: true,
              feltOffNote: "Left shoulder felt off",
            }),
          });

          assert.equal(createRes.status, 201);
          const created = (await createRes.json()) as SessionCheckin;
          assert.equal(created.clientId, "client_1");
          assert.equal(created.sessionId, "session_1");
          assert.equal(sessionCheckins.length, 1);

          const recentRes = await fetch(`${baseUrl}/api/clients/client_1/checkins/recent`, {
            headers: { "x-test-user-id": "admin_1" },
          });
          assert.equal(recentRes.status, 200);
          const recent = (await recentRes.json()) as { sessions: Array<{ id: string }> };
          assert.ok(recent.sessions.some((entry) => entry.id === created.id));
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/users allows admin to create a client account", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);
  const createdUsers: User[] = [];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getUserByEmail: async (email: string) => {
        const normalized = email.toLowerCase();
        return (
          Array.from(users.values()).find((entry) => entry.email.toLowerCase() === normalized) ||
          createdUsers.find((entry) => entry.email.toLowerCase() === normalized)
        );
      },
      createUser: async (payload: {
        name: string;
        email: string;
        passwordHash: string | null;
        role: string;
        status: string;
        avatar: string | null;
      }) => {
        const created = buildUser({
          id: `created_${createdUsers.length + 1}`,
          name: payload.name,
          email: payload.email,
          passwordHash: payload.passwordHash,
          role: payload.role,
          status: payload.status,
          avatar: payload.avatar,
        });
        createdUsers.push(created);
        return created;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              name: "New Client",
              email: "newclient@example.com",
              password: "password123",
              role: "Client",
            }),
          });

          assert.equal(response.status, 201);
          const body = (await response.json()) as { id?: string; email?: string; role?: string; passwordHash?: string };
          assert.equal(body.email, "newclient@example.com");
          assert.equal(body.role, "Client");
          assert.equal("passwordHash" in body, false);
          assert.equal(createdUsers.length, 1);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/users returns duplicate email error for admin", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["existing_1", buildUser({ id: "existing_1", role: "Client", email: "duplicate@example.com" })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getUserByEmail: async (email: string) =>
        Array.from(users.values()).find((entry) => entry.email.toLowerCase() === email.toLowerCase()),
      createUser: async () => {
        throw new Error("should not be called when duplicate email exists");
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              name: "Duplicate User",
              email: "duplicate@example.com",
              password: "password123",
              role: "Client",
            }),
          });

          assert.equal(response.status, 409);
          const body = (await response.json()) as { message?: string };
          assert.equal(body.message, "Email already in use");
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/users returns validation details for admin invalid payload", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getUserByEmail: async (_email: string) => undefined,
      createUser: async () => {
        throw new Error("should not be called for invalid payload");
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              name: "A",
              email: "invalid-email",
              password: "short",
              role: "Client",
            }),
          });

          assert.equal(response.status, 400);
          const body = (await response.json()) as { message?: string };
          assert.ok(Boolean(body.message && body.message.length > 0));
          assert.notEqual(body.message, "Invalid user payload");
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/users rejects client sessions", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getUserByEmail: async (_email: string) => undefined,
      createUser: async () => {
        throw new Error("should not be called for client");
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              name: "Blocked Client",
              email: "blocked@example.com",
              password: "password123",
              role: "Client",
            }),
          });
          assert.equal(response.status, 403);
          const body = (await response.json()) as { message?: string };
          assert.equal(body.message, "Forbidden");
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/phase-templates allows admin to create a phase template", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);
  const createdRows: Array<{ id: string; name: string }> = [];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      createPhaseTemplate: async (payload: { name: string } & Record<string, unknown>) => {
        const row = { id: `pt_${createdRows.length + 1}`, ...payload };
        createdRows.push(row);
        return row;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/phase-templates`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              name: "Phase Template A",
              goal: "Build consistency",
              durationWeeks: 4,
              movementCheckEnabled: false,
              sessions: [],
              schedule: [],
            }),
          });
          assert.equal(response.status, 201);
          const body = (await response.json()) as { name?: string };
          assert.equal(body.name, "Phase Template A");
          assert.equal(createdRows.length, 1);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/session-templates allows admin to create a session template", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);
  const createdRows: Array<{ id: string; name: string }> = [];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      createSessionTemplate: async (payload: { name: string } & Record<string, unknown>) => {
        const row = { id: `st_${createdRows.length + 1}`, ...payload };
        createdRows.push(row);
        return row;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/session-templates`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              name: "Session Template A",
              description: "Upper day",
              sections: [],
            }),
          });
          assert.equal(response.status, 201);
          const body = (await response.json()) as { name?: string };
          assert.equal(body.name, "Session Template A");
          assert.equal(createdRows.length, 1);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/section-templates allows admin to create a section template", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);
  const createdRows: Array<{ id: string; name: string }> = [];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      createSectionTemplate: async (payload: { name: string } & Record<string, unknown>) => {
        const row = { id: `sect_${createdRows.length + 1}`, ...payload };
        createdRows.push(row);
        return row;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/section-templates`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              name: "Section Template A",
              description: "Main block",
              exercises: [],
            }),
          });
          assert.equal(response.status, 201);
          const body = (await response.json()) as { name?: string };
          assert.equal(body.name, "Section Template A");
          assert.equal(createdRows.length, 1);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/exercise-templates allows admin to create an exercise template", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);
  const createdRows: Array<{ id: string; name: string }> = [];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      createExerciseTemplate: async (payload: { name: string } & Record<string, unknown>) => {
        const row = { id: `et_${createdRows.length + 1}`, ...payload };
        createdRows.push(row);
        return row;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/exercise-templates`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              name: "Exercise Template A",
              targetMuscle: "Legs",
              demoUrl: null,
              sets: "3",
              reps: "8",
              load: "Moderate",
              tempo: "3010",
              notes: null,
              goal: null,
              additionalInstructions: null,
              requiresMovementCheck: false,
              enableStructuredLogging: false,
            }),
          });
          assert.equal(response.status, 201);
          const body = (await response.json()) as { name?: string };
          assert.equal(body.name, "Exercise Template A");
          assert.equal(createdRows.length, 1);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("PATCH /api/phases/:id allows client to update completed schedule instances only", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const phases = new Map<string, Phase>([
    ["phase_1", buildPhase({ id: "phase_1", clientId: "client_1", completedScheduleInstances: [] })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhase: async (id: string) => phases.get(id),
      updatePhase: async (id: string, data: Partial<Phase>) => {
        const phase = phases.get(id);
        if (!phase) return undefined;
        const updated: Phase = { ...phase, ...data };
        phases.set(id, updated);
        return updated;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const okRes = await fetch(`${baseUrl}/api/phases/phase_1`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              completedScheduleInstances: ["w1_Monday_AM_session_1"],
            }),
          });
          assert.equal(okRes.status, 200);
          const okBody = (await okRes.json()) as Phase;
          assert.deepEqual(okBody.completedScheduleInstances, ["w1_Monday_AM_session_1"]);

          const forbiddenRes = await fetch(`${baseUrl}/api/phases/phase_1`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              name: "Trying to edit phase name",
            }),
          });
          assert.equal(forbiddenRes.status, 403);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/session-checkins rejects admin users with client-only write error", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);
  const sessionRows = new Map<string, Session>([["session_1", buildSession({ id: "session_1", phaseId: "phase_1" })]]);
  const phaseRows = new Map<string, Phase>([["phase_1", buildPhase({ id: "phase_1", clientId: "client_1" })]]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getSession: async (id: string) => sessionRows.get(id),
      getPhase: async (id: string) => phaseRows.get(id),
      createSessionCheckin: async (_payload: InsertSessionCheckin) => {
        throw new Error("should not be called for admin user");
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const res = await fetch(`${baseUrl}/api/session-checkins`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              sessionId: "session_1",
              rpeOverall: 6,
            }),
          });

          assert.equal(res.status, 403);
          const body = (await res.json()) as { message?: string };
          assert.equal(body.message, "Only client accounts can submit session check-ins");
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/weekly-checkins enforces one weekly check-in per client + phase + training week", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([["client_1", buildUser({ id: "client_1", role: "Client" })]]);
  const weeklyCheckins: WeeklyCheckin[] = [];
  const currentWeekStart = getWeekStartDateUtc();
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    startDate: currentWeekStart,
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (_clientId: string) => [phase],
      getWeeklyCheckinByClientAndPhaseWeek: async (clientId: string, phaseId: string, phaseWeekNumber: number) =>
        weeklyCheckins.find(
          (entry) =>
            entry.clientId === clientId &&
            entry.phaseId === phaseId &&
            entry.phaseWeekNumber === phaseWeekNumber,
        ),
      getWeeklyCheckinByClientAndWeek: async () => undefined,
      createWeeklyCheckin: async (payload: InsertWeeklyCheckin) => {
        const row: WeeklyCheckin = { id: `wc_${weeklyCheckins.length + 1}`, ...payload };
        weeklyCheckins.push(row);
        return row;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const first = await fetch(`${baseUrl}/api/weekly-checkins`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              sleepWeek: 4,
              energyWeek: 3,
              injuryAffectedTraining: false,
            }),
          });
          assert.equal(first.status, 201);

          const second = await fetch(`${baseUrl}/api/weekly-checkins`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              sleepWeek: 3,
              energyWeek: 3,
              injuryAffectedTraining: false,
            }),
          });
          assert.equal(second.status, 409);
          assert.equal(weeklyCheckins.length, 1);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/weekly-checkins allows submissions for different training weeks of the same phase", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([["client_1", buildUser({ id: "client_1", role: "Client" })]]);
  const weeklyCheckins: WeeklyCheckin[] = [];
  const phase = buildPhase({ id: "phase_1", clientId: "client_1" });
  let call = 0;

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (_clientId: string) => {
        call += 1;
        return [
          {
            ...phase,
            // First POST resolves to week 1, second POST resolves to week 2.
            startDate: call === 1 ? getWeekStartDateUtc() : getWeekStartDateUtc(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)),
          },
        ];
      },
      getWeeklyCheckinByClientAndPhaseWeek: async (clientId: string, phaseId: string, phaseWeekNumber: number) =>
        weeklyCheckins.find(
          (entry) =>
            entry.clientId === clientId &&
            entry.phaseId === phaseId &&
            entry.phaseWeekNumber === phaseWeekNumber,
        ),
      getWeeklyCheckinByClientAndWeek: async () => undefined,
      createWeeklyCheckin: async (payload: InsertWeeklyCheckin) => {
        const row: WeeklyCheckin = { id: `wc_${weeklyCheckins.length + 1}`, ...payload };
        weeklyCheckins.push(row);
        return row;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const payload = {
            sleepWeek: 4,
            energyWeek: 3,
            injuryAffectedTraining: false,
          };
          const first = await fetch(`${baseUrl}/api/weekly-checkins`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify(payload),
          });
          assert.equal(first.status, 201);

          const second = await fetch(`${baseUrl}/api/weekly-checkins`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify(payload),
          });
          assert.equal(second.status, 201);
          assert.equal(weeklyCheckins.length, 2);
          assert.notEqual(weeklyCheckins[0].phaseWeekNumber, weeklyCheckins[1].phaseWeekNumber);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/weekly-checkins allows submissions for different phases", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([["client_1", buildUser({ id: "client_1", role: "Client" })]]);
  const weeklyCheckins: WeeklyCheckin[] = [];
  const phaseOne = buildPhase({ id: "phase_1", clientId: "client_1", startDate: getWeekStartDateUtc() });
  const phaseTwo = buildPhase({ id: "phase_2", clientId: "client_1", startDate: getWeekStartDateUtc() });
  let call = 0;

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (_clientId: string) => {
        call += 1;
        return [call === 1 ? phaseOne : phaseTwo];
      },
      getWeeklyCheckinByClientAndPhaseWeek: async (clientId: string, phaseId: string, phaseWeekNumber: number) =>
        weeklyCheckins.find(
          (entry) =>
            entry.clientId === clientId &&
            entry.phaseId === phaseId &&
            entry.phaseWeekNumber === phaseWeekNumber,
        ),
      getWeeklyCheckinByClientAndWeek: async () => undefined,
      createWeeklyCheckin: async (payload: InsertWeeklyCheckin) => {
        const row: WeeklyCheckin = { id: `wc_${weeklyCheckins.length + 1}`, ...payload };
        weeklyCheckins.push(row);
        return row;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const payload = {
            sleepWeek: 4,
            energyWeek: 3,
            injuryAffectedTraining: false,
          };
          const first = await fetch(`${baseUrl}/api/weekly-checkins`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify(payload),
          });
          assert.equal(first.status, 201);

          const second = await fetch(`${baseUrl}/api/weekly-checkins`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify(payload),
          });
          assert.equal(second.status, 201);
          assert.equal(weeklyCheckins.length, 2);
          assert.notEqual(weeklyCheckins[0].phaseId, weeklyCheckins[1].phaseId);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due returns due when current week schedule is fully completed", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([["client_1", buildUser({ id: "client_1", role: "Client" })]]);
  const currentWeekStart = getWeekStartDateUtc();
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    startDate: currentWeekStart,
    durationWeeks: 4,
    schedule: [
      { week: 1, day: "Monday", slot: "AM", sessionId: "session_1" },
      { week: 1, day: "Wednesday", slot: "PM", sessionId: "session_2" },
    ],
    completedScheduleInstances: [
      "w1_Monday_AM_session_1",
      "w1_Wednesday_PM_session_2",
    ],
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getWeeklyCheckinByClientAndPhaseWeek: async (_clientId: string, _phaseId: string, _phaseWeekNumber: number) => undefined,
      getWeeklyCheckinByClientAndWeek: async (_clientId: string, _weekStartDate: string) => undefined,
      getPhasesByClient: async (_clientId: string) => [phase],
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/weekly-checkins/me/current-or-due`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as { due: boolean };
          assert.equal(body.due, true);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due returns not due when current week has incomplete scheduled sessions", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([["client_1", buildUser({ id: "client_1", role: "Client" })]]);
  const currentWeekStart = getWeekStartDateUtc();
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    startDate: currentWeekStart,
    durationWeeks: 4,
    schedule: [
      { week: 1, day: "Monday", slot: "AM", sessionId: "session_1" },
      { week: 1, day: "Wednesday", slot: "PM", sessionId: "session_2" },
    ],
    completedScheduleInstances: ["w1_Monday_AM_session_1"],
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getWeeklyCheckinByClientAndPhaseWeek: async (_clientId: string, _phaseId: string, _phaseWeekNumber: number) => undefined,
      getWeeklyCheckinByClientAndWeek: async (_clientId: string, _weekStartDate: string) => undefined,
      getPhasesByClient: async (_clientId: string) => [phase],
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/weekly-checkins/me/current-or-due`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as { due: boolean };
          assert.equal(body.due, false);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due returns not due when current training week check-in already exists", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([["client_1", buildUser({ id: "client_1", role: "Client" })]]);
  const currentWeekStart = getWeekStartDateUtc();
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    startDate: currentWeekStart,
    durationWeeks: 4,
    schedule: [{ week: 1, day: "Monday", slot: "AM", sessionId: "session_1" }],
    completedScheduleInstances: ["w1_Monday_AM_session_1"],
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getWeeklyCheckinByClientAndPhaseWeek: async (_clientId: string, _phaseId: string, _phaseWeekNumber: number) =>
        ({
          id: "wc_1",
          clientId: "client_1",
          phaseId: "phase_1",
          phaseWeekNumber: 1,
          weekStartDate: currentWeekStart,
          submittedAt: new Date().toISOString(),
          sleepWeek: 4,
          energyWeek: 4,
          injuryAffectedTraining: false,
          injuryImpact: null,
          coachNoteFromClient: null,
        }) as WeeklyCheckin,
      getWeeklyCheckinByClientAndWeek: async (_clientId: string, _weekStartDate: string) => undefined,
      getPhasesByClient: async (_clientId: string) => [phase],
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/weekly-checkins/me/current-or-due`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as { due: boolean };
          assert.equal(body.due, false);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due returns not due when zero sessions are scheduled for the current training week", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([["client_1", buildUser({ id: "client_1", role: "Client" })]]);
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    startDate: getWeekStartDateUtc(),
    schedule: [],
    completedScheduleInstances: [],
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getWeeklyCheckinByClientAndPhaseWeek: async (_clientId: string, _phaseId: string, _phaseWeekNumber: number) => undefined,
      getWeeklyCheckinByClientAndWeek: async (_clientId: string, _weekStartDate: string) => undefined,
      getPhasesByClient: async (_clientId: string) => [phase],
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/weekly-checkins/me/current-or-due`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as { due: boolean };
          assert.equal(body.due, false);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due ignores same-calendar-week submissions from a different training week", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([["client_1", buildUser({ id: "client_1", role: "Client" })]]);
  const currentWeekStart = getWeekStartDateUtc();
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    // Forces current training week to 2 while still in the current calendar week bucket.
    startDate: getWeekStartDateUtc(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)),
    durationWeeks: 8,
    schedule: [{ week: 2, day: "Monday", slot: "AM", sessionId: "session_1" }],
    completedScheduleInstances: ["w2_Monday_AM_session_1"],
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getWeeklyCheckinByClientAndPhaseWeek: async (_clientId: string, _phaseId: string, _phaseWeekNumber: number) => undefined,
      getWeeklyCheckinByClientAndWeek: async (_clientId: string, _weekStartDate: string) =>
        ({
          id: "wc_legacy",
          clientId: "client_1",
          phaseId: "phase_1",
          phaseWeekNumber: 1,
          weekStartDate: currentWeekStart,
          submittedAt: new Date().toISOString(),
          sleepWeek: 4,
          energyWeek: 4,
          injuryAffectedTraining: false,
          injuryImpact: null,
          coachNoteFromClient: null,
        }) as WeeklyCheckin,
      getPhasesByClient: async (_clientId: string) => [phase],
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/weekly-checkins/me/current-or-due`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as { due: boolean; current: WeeklyCheckin | null };
          assert.equal(body.due, true);
          assert.equal(body.current, null);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("client cannot access admin client analytics endpoints", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
    ["client_2", buildUser({ id: "client_2", role: "Client", email: "client2@example.com" })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/clients/client_2/checkins/summary`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 403);
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPERM") {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});
