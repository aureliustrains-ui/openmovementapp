import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { hashPassword } from "./auth";
import { getWeekStartDateUtc } from "./modules/checkins/checkins.service";
import type {
  InsertSessionCheckin,
  InsertWeeklyCheckin,
  Phase,
  Session,
  SessionCheckin,
  User,
  WeeklyCheckin,
  ProgressReport,
  ProgressReportItem,
} from "@shared/schema";

type StorageLike = Record<string, unknown>;

async function loadRouteDeps() {
  const isolatedEnvKeys = [
    "BOOTSTRAP_ADMIN_EMAIL",
    "BOOTSTRAP_ADMIN_PASSWORD",
    "BOOTSTRAP_ADMIN_NAME",
    "AWS_S3_BUCKET",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_S3_UPLOAD_URL_TTL_SECONDS",
    "AWS_S3_READ_URL_TTL_SECONDS",
    "OBJECT_STORAGE_BUCKET",
    "OBJECT_STORAGE_REGION",
    "OBJECT_STORAGE_ACCESS_KEY_ID",
    "OBJECT_STORAGE_SECRET_ACCESS_KEY",
    "OBJECT_STORAGE_ENDPOINT",
    "OBJECT_STORAGE_PUBLIC_BASE_URL",
    "OBJECT_STORAGE_FORCE_PATH_STYLE",
    "OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS",
    "OBJECT_STORAGE_READ_URL_TTL_SECONDS",
  ] as const;
  for (const key of isolatedEnvKeys) {
    delete process.env[key];
  }
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
    sessionVideoUrl: null,
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

function isEpermSocketError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "EPERM",
  );
}

function assertHttpUrl(value: unknown, label: string): void {
  assert.equal(typeof value, "string", `${label} should be a string URL`);
  if (typeof value !== "string") return;
  const parsed = new URL(value);
  assert.ok(
    parsed.protocol === "https:" || parsed.protocol === "http:",
    `${label} should use http or https`,
  );
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

test("POST /api/session-checkins inserts row and admin recent endpoint returns it", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);
  const sessionRows = new Map<string, Session>([
    ["session_1", buildSession({ id: "session_1", phaseId: "phase_1" })],
  ]);
  const phaseRows = new Map<string, Phase>([
    ["phase_1", buildPhase({ id: "phase_1", clientId: "client_1" })],
  ]);
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
              sessionRpe: 7,
              sleepLastNight: 4,
              feltOff: true,
              whatFeltOff: "Left shoulder felt off",
              optionalNote: "Anything to add?",
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("session video URL persists via /api/sessions create/update and is returned on read", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);
  const sessionRows = new Map<string, Session>();

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      createSession: async (payload: {
        phaseId: string;
        name: string;
        description?: string | null;
        sessionVideoUrl?: string | null;
        completedInstances?: unknown[];
        sections?: unknown[];
      }) => {
        const row = buildSession({
          id: "session_created",
          phaseId: payload.phaseId,
          name: payload.name,
          description: payload.description ?? null,
          sessionVideoUrl: payload.sessionVideoUrl ?? null,
          completedInstances: Array.isArray(payload.completedInstances)
            ? payload.completedInstances
            : [],
          sections: Array.isArray(payload.sections) ? payload.sections : [],
        });
        sessionRows.set(row.id, row);
        return row;
      },
      updateSession: async (
        id: string,
        payload: {
          name?: string;
          description?: string | null;
          sessionVideoUrl?: string | null;
          completedInstances?: unknown[];
          sections?: unknown[];
        },
      ) => {
        const existing = sessionRows.get(id);
        if (!existing) return undefined;
        const updated = {
          ...existing,
          ...payload,
          description:
            payload.description !== undefined ? payload.description : existing.description,
          sessionVideoUrl:
            payload.sessionVideoUrl !== undefined
              ? payload.sessionVideoUrl
              : existing.sessionVideoUrl,
        } as Session;
        sessionRows.set(id, updated);
        return updated;
      },
      getSession: async (id: string) => sessionRows.get(id),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const createdVideo = "https://www.youtube.com/watch?v=abc123xyz00";
          const createRes = await fetch(`${baseUrl}/api/sessions`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              phaseId: "phase_1",
              name: "Session 1",
              description: "Session intro",
              sessionVideoUrl: createdVideo,
              sections: [],
              completedInstances: [],
            }),
          });
          assert.equal(createRes.status, 201);
          const created = (await createRes.json()) as Session;
          assert.equal(created.sessionVideoUrl, createdVideo);

          const updatedVideo = "https://drive.google.com/file/d/demo/view";
          const updateRes = await fetch(`${baseUrl}/api/sessions/${created.id}`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              sessionVideoUrl: updatedVideo,
            }),
          });
          assert.equal(updateRes.status, 200);
          const updated = (await updateRes.json()) as Session;
          assert.equal(updated.sessionVideoUrl, updatedVideo);

          const readRes = await fetch(`${baseUrl}/api/sessions/${created.id}`, {
            headers: {
              "x-test-user-id": "admin_1",
            },
          });
          assert.equal(readRes.status, 200);
          const readBack = (await readRes.json()) as Session;
          assert.equal(readBack.sessionVideoUrl, updatedVideo);
        });
      } catch (error: unknown) {
        if (isEpermSocketError(error)) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/auth/me is reachable and returns authenticated user payload", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as {
            user?: { id?: string; email?: string; passwordHash?: string };
          };
          assert.equal(body.user?.id, "client_1");
          assert.equal(body.user?.email, "client@example.com");
          assert.equal(Boolean(body.user && "passwordHash" in body.user), false);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/account/change-password updates credentials and login accepts only new password", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const oldPassword = "OldPassword123!";
  const newPassword = "NewPassword123!";
  const users = new Map<string, User>([
    [
      "client_1",
      buildUser({
        id: "client_1",
        email: "client@example.com",
        role: "Client",
        passwordHash: await hashPassword(oldPassword),
      }),
    ],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getUserByEmail: async (email: string) => {
        const normalized = email.trim().toLowerCase();
        return Array.from(users.values()).find((user) => user.email === normalized);
      },
      updateUser: async (id: string, payload: Partial<User>) => {
        const existing = users.get(id);
        if (!existing) return undefined;
        const updated = { ...existing, ...payload };
        users.set(id, updated);
        return updated;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const wrongCurrentRes = await fetch(`${baseUrl}/api/account/change-password`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              currentPassword: "WrongPassword123!",
              newPassword,
              confirmPassword: newPassword,
            }),
          });
          assert.equal(wrongCurrentRes.status, 401);

          const mismatchRes = await fetch(`${baseUrl}/api/account/change-password`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              currentPassword: oldPassword,
              newPassword,
              confirmPassword: "DifferentPassword123!",
            }),
          });
          assert.equal(mismatchRes.status, 400);

          const changeRes = await fetch(`${baseUrl}/api/account/change-password`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              currentPassword: oldPassword,
              newPassword,
              confirmPassword: newPassword,
            }),
          });
          assert.equal(changeRes.status, 204);

          const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              email: "client@example.com",
              password: oldPassword,
            }),
          });
          assert.equal(oldLoginRes.status, 401);

          const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              email: "client@example.com",
              password: newPassword,
            }),
          });
          assert.equal(newLoginRes.status, 200);
        });
      } catch (error: unknown) {
        if (isEpermSocketError(error)) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
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
          const body = (await response.json()) as {
            id?: string;
            email?: string;
            role?: string;
            passwordHash?: string;
          };
          assert.equal(body.email, "newclient@example.com");
          assert.equal(body.role, "Client");
          assert.equal("passwordHash" in body, false);
          assert.equal(createdUsers.length, 1);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
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
        Array.from(users.values()).find(
          (entry) => entry.email.toLowerCase() === email.toLowerCase(),
        ),
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("PATCH /api/users/:id/status deactivates client and archives client phases", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client", status: "Active" })],
  ]);
  const phases = new Map<string, Phase>([
    ["phase_1", buildPhase({ id: "phase_1", clientId: "client_1", status: "Active" })],
    ["phase_2", buildPhase({ id: "phase_2", clientId: "client_1", status: "Draft" })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      updateUser: async (id: string, data: Partial<User>) => {
        const current = users.get(id);
        if (!current) return undefined;
        const updated = { ...current, ...data } as User;
        users.set(id, updated);
        return updated;
      },
      getPhasesByClient: async (clientId: string) =>
        Array.from(phases.values()).filter((phase) => phase.clientId === clientId),
      updatePhase: async (id: string, data: Partial<Phase>) => {
        const current = phases.get(id);
        if (!current) return undefined;
        const updated = { ...current, ...data } as Phase;
        phases.set(id, updated);
        return updated;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/users/client_1/status`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({ status: "Inactive" }),
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as { status?: string };
          assert.equal(body.status, "Inactive");
          assert.equal(phases.get("phase_1")?.status, "Archived");
          assert.equal(phases.get("phase_2")?.status, "Archived");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("DELETE /api/users/:id soft-removes client and deletes phases", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    [
      "client_1",
      buildUser({
        id: "client_1",
        role: "Client",
        status: "Inactive",
        email: "client@example.com",
      }),
    ],
  ]);
  const phases = new Map<string, Phase>([
    ["phase_1", buildPhase({ id: "phase_1", clientId: "client_1", status: "Active" })],
  ]);
  const deletedPhaseIds: string[] = [];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      updateUser: async (id: string, data: Partial<User>) => {
        const current = users.get(id);
        if (!current) return undefined;
        const updated = { ...current, ...data } as User;
        users.set(id, updated);
        return updated;
      },
      getPhasesByClient: async (clientId: string) =>
        Array.from(phases.values()).filter((phase) => phase.clientId === clientId),
      deletePhase: async (id: string) => {
        const existed = phases.delete(id);
        if (existed) deletedPhaseIds.push(id);
        return existed;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/users/client_1`, {
            method: "DELETE",
            headers: {
              "x-test-user-id": "admin_1",
            },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as {
            removed?: boolean;
            user?: { status?: string; email?: string };
          };
          assert.equal(body.removed, true);
          assert.equal(body.user?.status, "Removed");
          assert.ok(Boolean(body.user?.email?.includes("#removed#")));
          assert.deepEqual(deletedPhaseIds, ["phase_1"]);
          assert.equal(phases.size, 0);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("PATCH /api/phases/:id allows client to update completed schedule instances and movement-check links", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);
  const phases = new Map<string, Phase>([
    [
      "phase_1",
      buildPhase({
        id: "phase_1",
        clientId: "client_1",
        completedScheduleInstances: [],
        movementChecks: [
          {
            exerciseId: "ex_1",
            name: "Back Squat",
            status: "Not Submitted",
            videoUrl: "",
            clientNote: "",
            submittedAt: "",
          },
        ],
      }),
    ],
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

          const movementRes = await fetch(`${baseUrl}/api/phases/phase_1`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              movementChecks: [
                {
                  exerciseId: "ex_1",
                  videoUrl: "https://youtube.com/watch?v=demo",
                  clientNote: "Please check my depth",
                },
              ],
            }),
          });
          assert.equal(movementRes.status, 200);
          const movementBody = (await movementRes.json()) as Phase;
          const movementChecks = movementBody.movementChecks as Array<{
            exerciseId?: string;
            status?: string;
            videoUrl?: string;
            clientNote?: string;
          }>;
          const movementCheck = movementChecks.find((entry) => entry.exerciseId === "ex_1");
          assert.equal(movementCheck?.status, "Pending");
          assert.equal(movementCheck?.videoUrl, "https://youtube.com/watch?v=demo");
          assert.equal(movementCheck?.clientNote, "Please check my depth");

          const adminReadRes = await fetch(`${baseUrl}/api/phases/phase_1`, {
            headers: { "x-test-user-id": "admin_1" },
          });
          assert.equal(adminReadRes.status, 200);
          const adminReadBody = (await adminReadRes.json()) as Phase;
          const adminMovementChecks = adminReadBody.movementChecks as Array<{
            exerciseId?: string;
            videoUrl?: string;
          }>;
          const adminMovementCheck = adminMovementChecks.find(
            (entry) => entry.exerciseId === "ex_1",
          );
          assert.equal(adminMovementCheck?.videoUrl, "https://youtube.com/watch?v=demo");

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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("PATCH /api/phases/:id returns clear validation error for invalid movement-check video link", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const phases = new Map<string, Phase>([
    [
      "phase_1",
      buildPhase({
        id: "phase_1",
        clientId: "client_1",
        movementChecks: [
          {
            exerciseId: "ex_1",
            name: "Back Squat",
            status: "Not Submitted",
            videoUrl: "",
            clientNote: "",
            submittedAt: "",
          },
        ],
      }),
    ],
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
          const res = await fetch(`${baseUrl}/api/phases/phase_1`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              movementChecks: [{ exerciseId: "ex_1", videoUrl: "not-a-url" }],
            }),
          });
          assert.equal(res.status, 400);
          const body = (await res.json()) as { message?: string };
          assert.equal(body.message, "Invalid movement check video URL for ex_1");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("PATCH /api/phases/:id lets admin publish to Active or Waiting for Movement Check and persists status", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const phases = new Map<string, Phase>([
    [
      "phase_1",
      buildPhase({
        id: "phase_1",
        clientId: "client_1",
        name: "Publish target",
        status: "Draft",
        movementChecks: [],
      }),
    ],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      updatePhase: async (id: string, data: Partial<Phase>) => {
        const existing = phases.get(id);
        if (!existing) return undefined;
        const updated = { ...existing, ...data } as Phase;
        phases.set(id, updated);
        return updated;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const publishActive = await fetch(`${baseUrl}/api/phases/phase_1`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              status: "Active",
              movementChecks: [],
            }),
          });
          assert.equal(publishActive.status, 200);
          const activeBody = (await publishActive.json()) as Phase;
          assert.equal(activeBody.status, "Active");
          assert.equal(phases.get("phase_1")?.status, "Active");

          const movementChecks = [
            {
              exerciseId: "ex_1",
              name: "Back Squat",
              status: "Not Submitted",
              videoUrl: "",
              clientNote: "",
              submittedAt: "",
            },
          ];
          const publishWaiting = await fetch(`${baseUrl}/api/phases/phase_1`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              status: "Waiting for Movement Check",
              movementChecks,
            }),
          });
          assert.equal(publishWaiting.status, 200);
          const waitingBody = (await publishWaiting.json()) as Phase;
          assert.equal(waitingBody.status, "Waiting for Movement Check");
          assert.equal(phases.get("phase_1")?.status, "Waiting for Movement Check");
          assert.deepEqual(waitingBody.movementChecks, movementChecks);
        });
      } catch (error: unknown) {
        if (isEpermSocketError(error)) {
          t.skip("Sandbox blocks local socket binding; run on local machine to execute API route test.");
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/client-videos/upload-url allows client uploads and validates metadata", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const valid = await fetch(`${baseUrl}/api/client-videos/upload-url`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              purpose: "movement_check",
              fileName: "demo.mp4",
              fileSize: 1024,
              contentType: "video/mp4",
            }),
          });
          assert.equal(valid.status, 200);
          const validBody = (await valid.json()) as {
            objectKey?: string;
            uploadUrl?: string;
            expiresInSeconds?: number;
          };
          assert.ok(Boolean(validBody.objectKey?.includes("movement-checks/client_1/")));
          assertHttpUrl(validBody.uploadUrl, "uploadUrl");
          assert.equal(typeof validBody.expiresInSeconds, "number");

          const validProgress = await fetch(`${baseUrl}/api/client-videos/upload-url`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              purpose: "progress_report",
              fileName: "progress.mp4",
              fileSize: 2048,
              contentType: "video/mp4",
            }),
          });
          assert.equal(validProgress.status, 200);
          const validProgressBody = (await validProgress.json()) as { objectKey?: string };
          assert.ok(Boolean(validProgressBody.objectKey?.includes("progress-reports/client_1/")));

          const invalidType = await fetch(`${baseUrl}/api/client-videos/upload-url`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              purpose: "movement_check",
              fileName: "demo.jpg",
              fileSize: 1024,
              contentType: "image/jpeg",
            }),
          });
          assert.equal(invalidType.status, 400);
          const invalidTypeBody = (await invalidType.json()) as { message?: string };
          assert.equal(
            invalidTypeBody.message,
            "Invalid video file type. Use mp4, mov, webm, mkv, or 3gp.",
          );

          const tooLarge = await fetch(`${baseUrl}/api/client-videos/upload-url`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              purpose: "progress_report",
              fileName: "big.mp4",
              fileSize: 999999999,
              contentType: "video/mp4",
            }),
          });
          assert.equal(tooLarge.status, 400);
          const tooLargeBody = (await tooLarge.json()) as { message?: string };
          assert.equal(tooLargeBody.message, "Video is too large. Max size is 250MB.");

          const adminForbidden = await fetch(`${baseUrl}/api/client-videos/upload-url`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              purpose: "movement_check",
              fileName: "demo.mp4",
              fileSize: 1024,
              contentType: "video/mp4",
            }),
          });
          assert.equal(adminForbidden.status, 403);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("PATCH /api/phases/:id accepts movement-check upload metadata and grouped admin read resolves playback URL", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);
  const phases = new Map<string, Phase>([
    [
      "phase_1",
      buildPhase({
        id: "phase_1",
        clientId: "client_1",
        status: "Waiting for Movement Check",
        movementChecks: [
          {
            exerciseId: "ex_1",
            name: "Back Squat",
            status: "Not Submitted",
            videoUrl: "",
            clientNote: "",
            submittedAt: "",
          },
        ],
      }),
    ],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhase: async (id: string) => phases.get(id),
      getPhasesByClient: async (clientId: string) =>
        Array.from(phases.values()).filter((phase) => phase.clientId === clientId),
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
          const objectKey = "movement-checks/client_1/2026-03-11/video.mp4";
          const submitRes = await fetch(`${baseUrl}/api/phases/phase_1`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              movementChecks: [
                {
                  exerciseId: "ex_1",
                  videoSource: "upload",
                  videoObjectKey: objectKey,
                  videoMimeType: "video/mp4",
                  videoOriginalFilename: "video.mp4",
                  clientNote: "Upload submission",
                },
              ],
            }),
          });
          assert.equal(submitRes.status, 200);
          const submitBody = (await submitRes.json()) as Phase;
          const updatedChecks = submitBody.movementChecks as Array<{
            exerciseId?: string;
            status?: string;
            videoSource?: string;
            videoObjectKey?: string | null;
            videoUrl?: string | null;
          }>;
          const movementCheck = updatedChecks.find((entry) => entry.exerciseId === "ex_1");
          assert.equal(movementCheck?.status, "Pending");
          assert.equal(movementCheck?.videoSource, "upload");
          assert.equal(movementCheck?.videoObjectKey, objectKey);
          assert.equal(movementCheck?.videoUrl, null);

          const groupedRes = await fetch(
            `${baseUrl}/api/clients/client_1/movement-checks/grouped`,
            {
              headers: { "x-test-user-id": "admin_1" },
            },
          );
          assert.equal(groupedRes.status, 200);
          const grouped = (await groupedRes.json()) as Array<{
            phaseId: string;
            items: Array<{ exerciseId: string; videoUrl: string | null; videoSource?: string }>;
          }>;
          const phaseGroup = grouped.find((group) => group.phaseId === "phase_1");
          assert.ok(phaseGroup);
          const groupedItem = phaseGroup?.items.find((item) => item.exerciseId === "ex_1");
          assert.ok(groupedItem);
          assert.equal(groupedItem?.videoSource, "upload");
          assertHttpUrl(groupedItem?.videoUrl, "movement check playback URL");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
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
  const sessionRows = new Map<string, Session>([
    ["session_1", buildSession({ id: "session_1", phaseId: "phase_1" })],
  ]);
  const phaseRows = new Map<string, Phase>([
    ["phase_1", buildPhase({ id: "phase_1", clientId: "client_1" })],
  ]);

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
              sessionRpe: 6,
              sleepLastNight: 3,
            }),
          });

          assert.equal(res.status, 403);
          const body = (await res.json()) as { message?: string };
          assert.equal(body.message, "Only client accounts can submit session check-ins");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/weekly-checkins enforces one weekly check-in per client + phase + training week", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
  const weeklyCheckins: WeeklyCheckin[] = [];
  const currentWeekStart = getWeekStartDateUtc();
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    startDate: currentWeekStart,
    schedule: [{ week: 1, day: "Monday", slot: "AM", sessionId: "session_1" }],
    completedScheduleInstances: ["w1_Monday_AM_session_1"],
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (_clientId: string) => [phase],
      getWeeklyCheckinsByClient: async (_clientId: string) => weeklyCheckins,
      getWeeklyCheckinByClientAndPhaseWeek: async (
        clientId: string,
        phaseId: string,
        phaseWeekNumber: number,
      ) =>
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
              recoveryThisTrainingWeek: 4,
              stressOutsideTrainingThisWeek: 3,
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
              recoveryThisTrainingWeek: 3,
              stressOutsideTrainingThisWeek: 3,
              injuryAffectedTraining: false,
            }),
          });
          assert.equal(second.status, 409);
          assert.equal(weeklyCheckins.length, 1);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/weekly-checkins rejects admin users with client-only write error", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async () => [],
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const res = await fetch(`${baseUrl}/api/weekly-checkins`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              recoveryThisTrainingWeek: 3,
              stressOutsideTrainingThisWeek: 3,
              injuryAffectedTraining: false,
              injuryImpact: null,
              optionalNote: null,
            }),
          });

          assert.equal(res.status, 403);
          const body = (await res.json()) as { message?: string };
          assert.equal(body.message, "Only client accounts can submit weekly check-ins");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/weekly-checkins allows submissions for different training weeks of the same phase", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
  const weeklyCheckins: WeeklyCheckin[] = [];
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    durationWeeks: 3,
    schedule: [
      { week: 1, day: "Monday", slot: "AM", sessionId: "session_1" },
      { week: 2, day: "Monday", slot: "AM", sessionId: "session_2" },
      { week: 3, day: "Monday", slot: "AM", sessionId: "session_3" },
    ],
    completedScheduleInstances: [
      "w1_Monday_AM_session_1",
      "w2_Monday_AM_session_2",
      "w3_Monday_AM_session_3",
    ],
  });
  let call = 0;

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (_clientId: string) => {
        call += 1;
        const startDateByCall = [
          getWeekStartDateUtc(),
          getWeekStartDateUtc(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)),
          getWeekStartDateUtc(new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)),
        ] as const;
        return [
          {
            ...phase,
            // POSTs resolve to weeks 1, 2, and 3 in sequence.
            startDate: startDateByCall[call - 1] || startDateByCall[startDateByCall.length - 1],
          },
        ];
      },
      getWeeklyCheckinsByClient: async (_clientId: string) => weeklyCheckins,
      getWeeklyCheckinByClientAndPhaseWeek: async (
        clientId: string,
        phaseId: string,
        phaseWeekNumber: number,
      ) =>
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
            recoveryThisTrainingWeek: 4,
            stressOutsideTrainingThisWeek: 3,
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
          const third = await fetch(`${baseUrl}/api/weekly-checkins`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify(payload),
          });
          assert.equal(third.status, 201);
          assert.equal(weeklyCheckins.length, 3);
          assert.deepEqual(
            weeklyCheckins.map((entry) => entry.phaseWeekNumber),
            [1, 2, 3],
          );
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/weekly-checkins targets requested phase/week and does not use another phase submission", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
  const weeklyCheckins: WeeklyCheckin[] = [
    {
      id: "wc_phase_1_w1",
      clientId: "client_1",
      phaseId: "phase_1",
      phaseWeekNumber: 1,
      weekStartDate: getWeekStartDateUtc(),
      submittedAt: new Date().toISOString(),
      sleepWeek: 4,
      energyWeek: 4,
      injuryAffectedTraining: false,
      injuryImpact: null,
      coachNoteFromClient: null,
    } as WeeklyCheckin,
  ];
  const phaseOne = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    status: "Active",
    schedule: [{ week: 1, day: "Monday", slot: "AM", sessionId: "session_1" }],
    completedScheduleInstances: ["w1_Monday_AM_session_1"],
  });
  const phaseTwo = buildPhase({
    id: "phase_2",
    clientId: "client_1",
    status: "Waiting for Movement Check",
    schedule: [{ week: 1, day: "Tuesday", slot: "AM", sessionId: "session_2" }],
    completedScheduleInstances: ["w1_Tuesday_AM_session_2"],
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (_clientId: string) => [phaseOne, phaseTwo],
      getWeeklyCheckinsByClient: async (_clientId: string) => weeklyCheckins,
      getWeeklyCheckinByClientAndPhaseWeek: async (
        clientId: string,
        phaseId: string,
        phaseWeekNumber: number,
      ) =>
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
          const response = await fetch(`${baseUrl}/api/weekly-checkins`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              recoveryThisTrainingWeek: 4,
              stressOutsideTrainingThisWeek: 3,
              injuryAffectedTraining: false,
              injuryImpact: null,
              optionalNote: null,
              phaseId: "phase_2",
              phaseWeekNumber: 1,
            }),
          });

          assert.equal(response.status, 201);
          const body = (await response.json()) as WeeklyCheckin;
          assert.equal(body.phaseId, "phase_2");
          assert.equal(body.phaseWeekNumber, 1);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due does not treat week 1 submission as submitted for week 2", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    // Makes current training week = 2
    startDate: getWeekStartDateUtc(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)),
    durationWeeks: 8,
    schedule: [{ week: 2, day: "Monday", slot: "AM", sessionId: "session_1" }],
    completedScheduleInstances: ["w2_Monday_AM_session_1"],
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getWeeklyCheckinsByClient: async (_clientId: string) => [
        {
          id: "wc_week_1",
          clientId: "client_1",
          phaseId: "phase_1",
          phaseWeekNumber: 1,
          weekStartDate: getWeekStartDateUtc(),
          submittedAt: new Date().toISOString(),
          sleepWeek: 4,
          energyWeek: 4,
          injuryAffectedTraining: false,
          injuryImpact: null,
          coachNoteFromClient: null,
        } as WeeklyCheckin,
      ],
      getPhasesByClient: async (_clientId: string) => [phase],
      getWeeklyCheckinByClientAndPhaseWeek: async (
        _clientId: string,
        _phaseId: string,
        phaseWeekNumber: number,
      ) =>
        phaseWeekNumber === 1
          ? ({
              id: "wc_week_1",
              clientId: "client_1",
              phaseId: "phase_1",
              phaseWeekNumber: 1,
              weekStartDate: getWeekStartDateUtc(),
              submittedAt: new Date().toISOString(),
              sleepWeek: 4,
              energyWeek: 4,
              injuryAffectedTraining: false,
              injuryImpact: null,
              coachNoteFromClient: null,
            } as WeeklyCheckin)
          : undefined,
      getWeeklyCheckinByClientAndWeek: async () => {
        throw new Error("calendar-week fallback should not be used");
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/weekly-checkins/me/current-or-due`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as {
            due: boolean;
            phaseWeekNumber: number | null;
            current: WeeklyCheckin | null;
          };
          assert.equal(body.phaseWeekNumber, 2);
          assert.equal(body.current, null);
          assert.equal(body.due, true);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due advances to next week only after previous week check-in is submitted", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
  const weeklyRows: WeeklyCheckin[] = [];
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    durationWeeks: 4,
    schedule: [
      { week: 1, day: "Monday", slot: "AM", sessionId: "session_1" },
      { week: 2, day: "Wednesday", slot: "AM", sessionId: "session_2" },
    ],
    completedScheduleInstances: ["w1_Monday_AM_session_1"],
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (_clientId: string) => [phase],
      getWeeklyCheckinsByClient: async (_clientId: string) => weeklyRows,
      getWeeklyCheckinByClientAndPhaseWeek: async (
        clientId: string,
        phaseId: string,
        phaseWeekNumber: number,
      ) =>
        weeklyRows.find(
          (entry) =>
            entry.clientId === clientId &&
            entry.phaseId === phaseId &&
            entry.phaseWeekNumber === phaseWeekNumber,
        ),
      getWeeklyCheckinByClientAndWeek: async () => {
        throw new Error("calendar-week lookup should not be used");
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const before = await fetch(`${baseUrl}/api/weekly-checkins/me/current-or-due`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(before.status, 200);
          const beforeBody = (await before.json()) as {
            phaseWeekNumber: number | null;
            due: boolean;
          };
          assert.equal(beforeBody.phaseWeekNumber, 1);
          assert.equal(beforeBody.due, true);

          weeklyRows.push({
            id: "wc_week_1",
            clientId: "client_1",
            phaseId: "phase_1",
            phaseWeekNumber: 1,
            weekStartDate: getWeekStartDateUtc(),
            submittedAt: new Date().toISOString(),
            sleepWeek: 4,
            energyWeek: 3,
            injuryAffectedTraining: false,
            injuryImpact: null,
            coachNoteFromClient: null,
          });

          const after = await fetch(`${baseUrl}/api/weekly-checkins/me/current-or-due`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(after.status, 200);
          const afterBody = (await after.json()) as {
            phaseWeekNumber: number | null;
            due: boolean;
          };
          assert.equal(afterBody.phaseWeekNumber, 2);
          assert.equal(afterBody.due, false);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/weekly-checkins allows submissions for different phases", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
  const weeklyCheckins: WeeklyCheckin[] = [];
  const phaseOne = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    startDate: getWeekStartDateUtc(),
    schedule: [{ week: 1, day: "Monday", slot: "AM", sessionId: "session_1" }],
    completedScheduleInstances: ["w1_Monday_AM_session_1"],
  });
  const phaseTwo = buildPhase({
    id: "phase_2",
    clientId: "client_1",
    startDate: getWeekStartDateUtc(),
    schedule: [{ week: 1, day: "Monday", slot: "AM", sessionId: "session_2" }],
    completedScheduleInstances: ["w1_Monday_AM_session_2"],
  });
  let call = 0;

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (_clientId: string) => {
        call += 1;
        return [call === 1 ? phaseOne : phaseTwo];
      },
      getWeeklyCheckinsByClient: async (_clientId: string) => weeklyCheckins,
      getWeeklyCheckinByClientAndPhaseWeek: async (
        clientId: string,
        phaseId: string,
        phaseWeekNumber: number,
      ) =>
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
            recoveryThisTrainingWeek: 4,
            stressOutsideTrainingThisWeek: 3,
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due returns due when current week schedule is fully completed", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
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
    completedScheduleInstances: ["w1_Monday_AM_session_1", "w1_Wednesday_PM_session_2"],
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getWeeklyCheckinsByClient: async (_clientId: string) => [],
      getWeeklyCheckinByClientAndPhaseWeek: async (
        _clientId: string,
        _phaseId: string,
        _phaseWeekNumber: number,
      ) => undefined,
      getWeeklyCheckinByClientAndWeek: async (_clientId: string, _weekStartDate: string) =>
        undefined,
      getPhasesByClient: async (_clientId: string) => [phase],
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/weekly-checkins/me/current-or-due`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as { due: boolean; phaseWeekNumber: number | null };
          assert.equal(body.due, true);
          assert.equal(body.phaseWeekNumber, 1);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due returns not due when current week has incomplete scheduled sessions", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
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
      getWeeklyCheckinsByClient: async (_clientId: string) => [],
      getWeeklyCheckinByClientAndPhaseWeek: async (
        _clientId: string,
        _phaseId: string,
        _phaseWeekNumber: number,
      ) => undefined,
      getWeeklyCheckinByClientAndWeek: async (_clientId: string, _weekStartDate: string) =>
        undefined,
      getPhasesByClient: async (_clientId: string) => [phase],
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/weekly-checkins/me/current-or-due`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as {
            due: boolean;
            current: WeeklyCheckin | null;
            phaseWeekNumber?: number | null;
          };
          assert.equal(body.due, false);
          assert.equal(body.phaseWeekNumber, 1);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due returns not due when current training week check-in already exists", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
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
      getWeeklyCheckinsByClient: async (_clientId: string) => [
        {
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
        } as WeeklyCheckin,
      ],
      getWeeklyCheckinByClientAndPhaseWeek: async (
        _clientId: string,
        _phaseId: string,
        _phaseWeekNumber: number,
      ) =>
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
      getWeeklyCheckinByClientAndWeek: async (_clientId: string, _weekStartDate: string) =>
        undefined,
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due returns not due when zero sessions are scheduled for the current training week", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
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
      getWeeklyCheckinsByClient: async (_clientId: string) => [],
      getWeeklyCheckinByClientAndPhaseWeek: async (
        _clientId: string,
        _phaseId: string,
        _phaseWeekNumber: number,
      ) => undefined,
      getWeeklyCheckinByClientAndWeek: async (_clientId: string, _weekStartDate: string) =>
        undefined,
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/weekly-checkins/me/current-or-due ignores legacy/calendar rows and only checks exact phase week submission", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    // Forces current training week to 2.
    startDate: getWeekStartDateUtc(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)),
    durationWeeks: 8,
    schedule: [{ week: 2, day: "Monday", slot: "AM", sessionId: "session_1" }],
    completedScheduleInstances: ["w2_Monday_AM_session_1"],
  });

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getWeeklyCheckinsByClient: async (_clientId: string) => [
        {
          id: "wc_legacy",
          clientId: "client_1",
          phaseId: null,
          phaseWeekNumber: null,
          weekStartDate: getWeekStartDateUtc(),
          submittedAt: new Date().toISOString(),
          sleepWeek: 4,
          energyWeek: 4,
          injuryAffectedTraining: false,
          injuryImpact: null,
          coachNoteFromClient: null,
        } as WeeklyCheckin,
      ],
      getWeeklyCheckinByClientAndPhaseWeek: async (
        _clientId: string,
        _phaseId: string,
        _phaseWeekNumber: number,
      ) => undefined,
      getWeeklyCheckinByClientAndWeek: async () => {
        throw new Error("calendar-week lookup should not be used");
      },
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("client can access own client analytics endpoint", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getSessionCheckinsByClient: async () => [],
      getWeeklyCheckinsByClient: async () => [],
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/clients/client_1/checkins/summary`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 200);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("POST /api/clients/:clientId/progress-reports allows admin to create request from active phase exercises", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    status: "Active",
  });
  const phaseSessions: Session[] = [
    buildSession({
      id: "session_1",
      phaseId: "phase_1",
      sections: [
        {
          id: "sec_1",
          name: "Main",
          exercises: [
            { id: "ex_1", name: "Back Squat", sets: "3", reps: "6", tempo: "3010" },
            { id: "ex_2", name: "RDL", sets: "3", reps: "8", tempo: "2020" },
          ],
        },
      ],
    }),
  ];
  const reports: ProgressReport[] = [];
  const items: ProgressReportItem[] = [];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (clientId: string) => (clientId === "client_1" ? [phase] : []),
      getSessionsByPhase: async (phaseId: string) => (phaseId === "phase_1" ? phaseSessions : []),
      createProgressReport: async (payload: Omit<ProgressReport, "id">) => {
        const created: ProgressReport = { id: `pr_${reports.length + 1}`, ...payload };
        reports.push(created);
        return created;
      },
      createProgressReportItem: async (payload: Omit<ProgressReportItem, "id">) => {
        const created: ProgressReportItem = { id: `pri_${items.length + 1}`, ...payload };
        items.push(created);
        return created;
      },
      getProgressReportItems: async (reportId: string) =>
        items.filter((item) => item.progressReportId === reportId),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/clients/client_1/progress-reports`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              exerciseIds: ["ex_1", "ex_2"],
            }),
          });
          assert.equal(response.status, 201);
          const body = (await response.json()) as ProgressReport & { items: ProgressReportItem[] };
          assert.equal(body.phaseId, "phase_1");
          assert.equal(body.status, "requested");
          assert.equal(body.items.length, 2);

          const invalid = await fetch(`${baseUrl}/api/clients/client_1/progress-reports`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              exerciseIds: ["ex_999"],
            }),
          });
          assert.equal(invalid.status, 400);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("client can submit progress report and admin can read submitted data without blocking active phase access", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const phase = buildPhase({ id: "phase_1", clientId: "client_1", status: "Active" });
  const reports: ProgressReport[] = [
    {
      id: "pr_1",
      clientId: "client_1",
      phaseId: "phase_1",
      status: "requested",
      createdBy: "admin_1",
      createdAt: new Date().toISOString(),
      submittedAt: null,
    },
  ];
  const items: ProgressReportItem[] = [
    {
      id: "pri_1",
      progressReportId: "pr_1",
      exerciseId: "ex_1",
      exerciseName: "Back Squat",
      submissionLink: null,
      submissionNote: null,
      reviewStatus: "requested",
      feedbackNote: null,
      reviewedAt: null,
    },
  ];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getProgressReportsByClient: async (clientId: string) =>
        reports.filter((report) => report.clientId === clientId),
      getProgressReport: async (id: string) => reports.find((report) => report.id === id),
      getProgressReportItems: async (reportId: string) =>
        items.filter((item) => item.progressReportId === reportId),
      updateProgressReport: async (id: string, data: Partial<ProgressReport>) => {
        const row = reports.find((report) => report.id === id);
        if (!row) return undefined;
        Object.assign(row, data);
        return row;
      },
      updateProgressReportItem: async (id: string, data: Partial<ProgressReportItem>) => {
        const row = items.find((item) => item.id === id);
        if (!row) return undefined;
        Object.assign(row, data);
        return row;
      },
      getPhasesByClient: async (clientId: string) => (clientId === "client_1" ? [phase] : []),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const openRes = await fetch(`${baseUrl}/api/progress-reports/me/open`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(openRes.status, 200);
          const openBody = (await openRes.json()) as Array<
            ProgressReport & { items: ProgressReportItem[] }
          >;
          assert.equal(openBody.length, 1);
          assert.equal(openBody[0].status, "requested");

          const submitRes = await fetch(`${baseUrl}/api/progress-reports/pr_1/submit`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              items: [
                {
                  itemId: "pri_1",
                  submissionLink: "https://youtube.com/watch?v=demo",
                  submissionNote: "Depth feels stronger",
                },
              ],
            }),
          });
          assert.equal(submitRes.status, 200);
          const submitBody = (await submitRes.json()) as ProgressReport & {
            items: ProgressReportItem[];
          };
          assert.equal(submitBody.status, "submitted");
          assert.equal(submitBody.items[0].submissionLink, "https://youtube.com/watch?v=demo");

          const adminReadRes = await fetch(`${baseUrl}/api/clients/client_1/progress-reports`, {
            headers: { "x-test-user-id": "admin_1" },
          });
          assert.equal(adminReadRes.status, 200);
          const adminReports = (await adminReadRes.json()) as Array<
            ProgressReport & { items: ProgressReportItem[] }
          >;
          assert.equal(adminReports[0].items[0].submissionNote, "Depth feels stronger");

          const phasesRes = await fetch(`${baseUrl}/api/phases`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(phasesRes.status, 200);
          const clientPhases = (await phasesRes.json()) as Phase[];
          assert.equal(clientPhases.length, 1);
          assert.equal(clientPhases[0].status, "Active");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("client can submit uploaded progress-report video and admin can review it", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const phase = buildPhase({
    id: "phase_1",
    clientId: "client_1",
    status: "Active",
    name: "Active phase",
  });
  const reports: ProgressReport[] = [
    {
      id: "pr_upload",
      clientId: "client_1",
      phaseId: "phase_1",
      status: "requested",
      createdBy: "admin_1",
      createdAt: "2026-03-10T10:00:00.000Z",
      submittedAt: null,
    },
  ];
  const items: ProgressReportItem[] = [
    {
      id: "pri_upload",
      progressReportId: "pr_upload",
      exerciseId: "ex_1",
      exerciseName: "Back Squat",
      submissionSource: null,
      submissionObjectKey: null,
      submissionMimeType: null,
      submissionOriginalFilename: null,
      submissionLink: null,
      submissionNote: null,
      reviewStatus: "requested",
      feedbackNote: null,
      reviewedAt: null,
    },
  ];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getProgressReport: async (id: string) => reports.find((report) => report.id === id),
      getProgressReportsByClient: async (clientId: string) =>
        reports.filter((report) => report.clientId === clientId),
      getProgressReportItems: async (reportId: string) =>
        items.filter((item) => item.progressReportId === reportId),
      updateProgressReportItem: async (id: string, data: Partial<ProgressReportItem>) => {
        const row = items.find((item) => item.id === id);
        if (!row) return undefined;
        Object.assign(row, data);
        return row;
      },
      updateProgressReport: async (id: string, data: Partial<ProgressReport>) => {
        const row = reports.find((report) => report.id === id);
        if (!row) return undefined;
        Object.assign(row, data);
        return row;
      },
      getPhasesByClient: async (clientId: string) => (clientId === "client_1" ? [phase] : []),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const objectKey = "progress-reports/client_1/2026-03-11/progress.mp4";
          const submitRes = await fetch(`${baseUrl}/api/progress-reports/pr_upload/submit`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              items: [
                {
                  itemId: "pri_upload",
                  submissionSource: "upload",
                  submissionObjectKey: objectKey,
                  submissionMimeType: "video/mp4",
                  submissionOriginalFilename: "progress.mp4",
                  submissionNote: "Added 2 reps with same load",
                },
              ],
            }),
          });
          assert.equal(submitRes.status, 200);
          const submitBody = (await submitRes.json()) as ProgressReport & {
            items: Array<ProgressReportItem & { submissionPlaybackUrl?: string | null }>;
          };
          assert.equal(submitBody.status, "submitted");
          assert.equal(submitBody.items[0].submissionSource, "upload");
          assert.equal(submitBody.items[0].submissionObjectKey, objectKey);
          assert.equal(submitBody.items[0].submissionLink, null);
          assertHttpUrl(submitBody.items[0].submissionPlaybackUrl, "progress report playback URL");

          const groupedRes = await fetch(
            `${baseUrl}/api/clients/client_1/progress-reports/grouped`,
            {
              headers: { "x-test-user-id": "admin_1" },
            },
          );
          assert.equal(groupedRes.status, 200);
          const groupedBody = (await groupedRes.json()) as Array<{
            phaseId: string;
            items: Array<{
              itemId: string;
              submissionSource?: string | null;
              submissionObjectKey?: string | null;
              submissionPlaybackUrl?: string | null;
            }>;
          }>;
          const group = groupedBody.find((entry) => entry.phaseId === "phase_1");
          assert.ok(group);
          const groupedItem = group?.items.find((entry) => entry.itemId === "pri_upload");
          assert.equal(groupedItem?.submissionSource, "upload");
          assert.equal(groupedItem?.submissionObjectKey, objectKey);
          assertHttpUrl(groupedItem?.submissionPlaybackUrl, "grouped progress report playback URL");

          const reviewRes = await fetch(
            `${baseUrl}/api/progress-reports/pr_upload/items/pri_upload/review`,
            {
              method: "PATCH",
              headers: {
                "content-type": "application/json",
                "x-test-user-id": "admin_1",
              },
              body: JSON.stringify({
                decision: "approve",
                feedbackNote: "Great progress this week.",
              }),
            },
          );
          assert.equal(reviewRes.status, 200);
          const reviewed = (await reviewRes.json()) as ProgressReport & {
            items: Array<ProgressReportItem>;
          };
          assert.equal(reviewed.status, "approved");
          assert.equal(reviewed.items[0].reviewStatus, "approved");
          assert.equal(reviewed.items[0].feedbackNote, "Great progress this week.");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("admin can approve progress report item and feedback is visible to client", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const reports: ProgressReport[] = [
    {
      id: "pr_1",
      clientId: "client_1",
      phaseId: "phase_1",
      status: "submitted",
      createdBy: "admin_1",
      createdAt: "2026-03-08T10:00:00.000Z",
      submittedAt: "2026-03-08T11:00:00.000Z",
    },
  ];
  const items: ProgressReportItem[] = [
    {
      id: "pri_1",
      progressReportId: "pr_1",
      exerciseId: "ex_1",
      exerciseName: "Back Squat",
      submissionLink: "https://youtube.com/watch?v=demo",
      submissionNote: "2 extra reps",
      reviewStatus: "submitted",
      feedbackNote: null,
      reviewedAt: null,
    },
  ];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getProgressReport: async (id: string) => reports.find((report) => report.id === id),
      getProgressReportItems: async (reportId: string) =>
        items.filter((item) => item.progressReportId === reportId),
      updateProgressReportItem: async (id: string, data: Partial<ProgressReportItem>) => {
        const row = items.find((item) => item.id === id);
        if (!row) return undefined;
        Object.assign(row, data);
        return row;
      },
      updateProgressReport: async (id: string, data: Partial<ProgressReport>) => {
        const row = reports.find((report) => report.id === id);
        if (!row) return undefined;
        Object.assign(row, data);
        return row;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const reviewRes = await fetch(`${baseUrl}/api/progress-reports/pr_1/items/pri_1/review`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              decision: "approve",
              feedbackNote: "Great improvement in control and range",
            }),
          });
          assert.equal(reviewRes.status, 200);
          const reviewed = (await reviewRes.json()) as ProgressReport & {
            items: ProgressReportItem[];
          };
          assert.equal(reviewed.status, "approved");
          assert.equal(reviewed.items[0].reviewStatus, "approved");
          assert.equal(reviewed.items[0].feedbackNote, "Great improvement in control and range");

          const clientReadRes = await fetch(`${baseUrl}/api/progress-reports/pr_1`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(clientReadRes.status, 200);
          const clientRead = (await clientReadRes.json()) as ProgressReport & {
            items: ProgressReportItem[];
          };
          assert.equal(clientRead.items[0].feedbackNote, "Great improvement in control and range");
          assert.equal(clientRead.items[0].reviewStatus, "approved");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("admin can request progress report resubmission and client can submit again", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const reports: ProgressReport[] = [
    {
      id: "pr_1",
      clientId: "client_1",
      phaseId: "phase_1",
      status: "submitted",
      createdBy: "admin_1",
      createdAt: "2026-03-08T10:00:00.000Z",
      submittedAt: "2026-03-08T11:00:00.000Z",
    },
  ];
  const items: ProgressReportItem[] = [
    {
      id: "pri_1",
      progressReportId: "pr_1",
      exerciseId: "ex_1",
      exerciseName: "Back Squat",
      submissionLink: "https://youtube.com/watch?v=demo",
      submissionNote: "2 extra reps",
      reviewStatus: "submitted",
      feedbackNote: null,
      reviewedAt: null,
    },
  ];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getProgressReport: async (id: string) => reports.find((report) => report.id === id),
      getProgressReportItems: async (reportId: string) =>
        items.filter((item) => item.progressReportId === reportId),
      updateProgressReportItem: async (id: string, data: Partial<ProgressReportItem>) => {
        const row = items.find((item) => item.id === id);
        if (!row) return undefined;
        Object.assign(row, data);
        return row;
      },
      updateProgressReport: async (id: string, data: Partial<ProgressReport>) => {
        const row = reports.find((report) => report.id === id);
        if (!row) return undefined;
        Object.assign(row, data);
        return row;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const reviewRes = await fetch(`${baseUrl}/api/progress-reports/pr_1/items/pri_1/review`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              decision: "resubmit",
              feedbackNote: "Please use a clearer side camera angle",
            }),
          });
          assert.equal(reviewRes.status, 200);
          const reviewed = (await reviewRes.json()) as ProgressReport & {
            items: ProgressReportItem[];
          };
          assert.equal(reviewed.status, "resubmission_requested");
          assert.equal(reviewed.items[0].reviewStatus, "resubmission_requested");

          const resubmit = await fetch(`${baseUrl}/api/progress-reports/pr_1/submit`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              items: [
                {
                  itemId: "pri_1",
                  submissionLink: "https://youtube.com/watch?v=demo2",
                  submissionNote: "Cleaner form at same load",
                },
              ],
            }),
          });
          assert.equal(resubmit.status, 200);
          const body = (await resubmit.json()) as ProgressReport & { items: ProgressReportItem[] };
          assert.equal(body.status, "submitted");
          assert.equal(body.items[0].reviewStatus, "submitted");
          assert.equal(body.items[0].feedbackNote, null);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/progress-reports/me/active-phase keeps submitted progress reports visible while phase is active", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const phases: Phase[] = [
    buildPhase({
      id: "phase_active",
      clientId: "client_1",
      status: "Active",
      name: "Active phase",
    }),
    buildPhase({ id: "phase_old", clientId: "client_1", status: "Completed", name: "Old phase" }),
  ];
  const reports: ProgressReport[] = [
    {
      id: "pr_requested",
      clientId: "client_1",
      phaseId: "phase_active",
      status: "requested",
      createdBy: "admin_1",
      createdAt: "2026-03-08T10:00:00.000Z",
      submittedAt: null,
    },
    {
      id: "pr_submitted",
      clientId: "client_1",
      phaseId: "phase_active",
      status: "submitted",
      createdBy: "admin_1",
      createdAt: "2026-03-08T11:00:00.000Z",
      submittedAt: "2026-03-08T12:00:00.000Z",
    },
    {
      id: "pr_old_phase",
      clientId: "client_1",
      phaseId: "phase_old",
      status: "submitted",
      createdBy: "admin_1",
      createdAt: "2026-03-08T09:00:00.000Z",
      submittedAt: "2026-03-08T09:30:00.000Z",
    },
  ];
  const items: ProgressReportItem[] = [
    {
      id: "item_requested",
      progressReportId: "pr_requested",
      exerciseId: "ex_1",
      exerciseName: "Back Squat",
      submissionLink: null,
      submissionNote: null,
      reviewStatus: "requested",
      feedbackNote: null,
      reviewedAt: null,
    },
    {
      id: "item_submitted",
      progressReportId: "pr_submitted",
      exerciseId: "ex_2",
      exerciseName: "RDL",
      submissionLink: "https://youtube.com/watch?v=submitted",
      submissionNote: "Felt stronger",
      reviewStatus: "submitted",
      feedbackNote: null,
      reviewedAt: null,
    },
    {
      id: "item_old",
      progressReportId: "pr_old_phase",
      exerciseId: "ex_3",
      exerciseName: "Push-up",
      submissionLink: "https://youtube.com/watch?v=old",
      submissionNote: "From old phase",
      reviewStatus: "submitted",
      feedbackNote: null,
      reviewedAt: null,
    },
  ];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (clientId: string) => (clientId === "client_1" ? phases : []),
      getProgressReportsByClient: async (clientId: string) =>
        reports.filter((report) => report.clientId === clientId),
      getProgressReportItems: async (reportId: string) =>
        items.filter((item) => item.progressReportId === reportId),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/progress-reports/me/active-phase`, {
            headers: { "x-test-user-id": "client_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as Array<
            ProgressReport & { items: ProgressReportItem[] }
          >;
          assert.equal(body.length, 2);
          assert.deepEqual(
            body.map((report) => report.id),
            ["pr_submitted", "pr_requested"],
          );
          assert.equal(body[0].phaseId, "phase_active");
          assert.equal(body[1].phaseId, "phase_active");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("progress report auth boundaries are enforced", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
    ["client_2", buildUser({ id: "client_2", role: "Client", email: "client2@example.com" })],
  ]);
  const phase = buildPhase({ id: "phase_1", clientId: "client_1", status: "Active" });
  const reports: ProgressReport[] = [
    {
      id: "pr_1",
      clientId: "client_1",
      phaseId: "phase_1",
      status: "requested",
      createdBy: "admin_1",
      createdAt: new Date().toISOString(),
      submittedAt: null,
    },
  ];
  const items: ProgressReportItem[] = [
    {
      id: "pri_1",
      progressReportId: "pr_1",
      exerciseId: "ex_1",
      exerciseName: "Back Squat",
      submissionLink: null,
      submissionNote: null,
      reviewStatus: "requested",
      feedbackNote: null,
      reviewedAt: null,
    },
  ];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (clientId: string) => (clientId === "client_1" ? [phase] : []),
      getSessionsByPhase: async () => [],
      getProgressReport: async (id: string) => reports.find((report) => report.id === id),
      getProgressReportItems: async (reportId: string) =>
        items.filter((item) => item.progressReportId === reportId),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const clientCreate = await fetch(`${baseUrl}/api/clients/client_1/progress-reports`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({ exerciseIds: ["ex_1"] }),
          });
          assert.equal(clientCreate.status, 403);

          const adminSubmit = await fetch(`${baseUrl}/api/progress-reports/pr_1/submit`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "admin_1",
            },
            body: JSON.stringify({
              items: [{ itemId: "pri_1", submissionLink: "https://youtube.com/watch?v=demo" }],
            }),
          });
          assert.equal(adminSubmit.status, 403);

          const otherClientSubmit = await fetch(`${baseUrl}/api/progress-reports/pr_1/submit`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_2",
            },
            body: JSON.stringify({
              items: [{ itemId: "pri_1", submissionLink: "https://youtube.com/watch?v=demo" }],
            }),
          });
          assert.equal(otherClientSubmit.status, 403);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/clients/:clientId/movement-checks/grouped keeps movement checks siloed by phase and omits empty phases", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const phases: Phase[] = [
    buildPhase({
      id: "phase_1",
      clientId: "client_1",
      name: "Phase Alpha",
      status: "Active",
      movementChecks: [
        {
          exerciseId: "ex_1",
          name: "Split Squat",
          status: "Pending",
          videoUrl: "https://youtube.com/watch?v=split",
          clientNote: "Feels stable",
          submittedAt: new Date().toISOString(),
        },
      ],
    }),
    buildPhase({
      id: "phase_2",
      clientId: "client_1",
      name: "Phase Beta",
      status: "Draft",
      movementChecks: [],
    }),
    buildPhase({
      id: "phase_3",
      clientId: "client_1",
      name: "Phase Gamma",
      status: "Waiting for Movement Check",
      movementChecks: JSON.stringify([
        {
          exerciseId: "ex_1",
          name: "Split Squat",
          status: "Approved",
          approvedNote: "Good control",
          decidedAt: new Date().toISOString(),
        },
      ]) as unknown as Phase["movementChecks"],
    }),
  ];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (clientId: string) => (clientId === "client_1" ? phases : []),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/clients/client_1/movement-checks/grouped`, {
            headers: { "x-test-user-id": "admin_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as Array<{
            phaseId: string;
            phaseName: string;
            items: Array<{ exerciseId: string; status: string; videoUrl: string | null }>;
          }>;

          assert.equal(body.length, 2);
          assert.deepEqual(body.map((group) => group.phaseId).sort(), ["phase_1", "phase_3"]);
          const alpha = body.find((group) => group.phaseId === "phase_1");
          assert.ok(alpha);
          assert.equal(alpha.items[0].exerciseId, "ex_1");
          assert.equal(alpha.items[0].status, "submitted");
          const gamma = body.find((group) => group.phaseId === "phase_3");
          assert.ok(gamma);
          assert.equal(gamma.items[0].exerciseId, "ex_1");
          assert.equal(gamma.items[0].status, "reviewed");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("GET /api/clients/:clientId/progress-reports/grouped returns phase-grouped submitted data and omits empty groups", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const phases: Phase[] = [
    buildPhase({ id: "phase_1", clientId: "client_1", name: "Phase Alpha", status: "Active" }),
    buildPhase({ id: "phase_2", clientId: "client_1", name: "Phase Beta", status: "Active" }),
  ];
  const reports: ProgressReport[] = [
    {
      id: "pr_1",
      clientId: "client_1",
      phaseId: "phase_1",
      status: "submitted",
      createdBy: "admin_1",
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
    },
    {
      id: "pr_2",
      clientId: "client_1",
      phaseId: "phase_2",
      status: "requested",
      createdBy: "admin_1",
      createdAt: new Date().toISOString(),
      submittedAt: null,
    },
  ];
  const items: ProgressReportItem[] = [
    {
      id: "pri_1",
      progressReportId: "pr_1",
      exerciseId: "ex_1",
      exerciseName: "Back Squat",
      submissionLink: "https://youtube.com/watch?v=squat",
      submissionNote: "2 more reps this week",
      reviewStatus: "submitted",
      feedbackNote: null,
      reviewedAt: null,
    },
  ];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhasesByClient: async (clientId: string) => (clientId === "client_1" ? phases : []),
      getProgressReportsByClient: async (clientId: string) =>
        reports.filter((report) => report.clientId === clientId),
      getProgressReportItems: async (reportId: string) =>
        items.filter((item) => item.progressReportId === reportId),
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/clients/client_1/progress-reports/grouped`, {
            headers: { "x-test-user-id": "admin_1" },
          });
          assert.equal(response.status, 200);
          const body = (await response.json()) as Array<{
            phaseId: string;
            phaseName: string;
            items: Array<{
              exerciseId: string;
              reportStatus: string;
              reviewStatus: string;
              submissionNote: string | null;
            }>;
          }>;

          assert.equal(body.length, 1);
          assert.equal(body[0].phaseId, "phase_1");
          assert.equal(body[0].phaseName, "Phase Alpha");
          assert.equal(body[0].items.length, 1);
          assert.equal(body[0].items[0].exerciseId, "ex_1");
          assert.equal(body[0].items[0].reportStatus, "submitted");
          assert.equal(body[0].items[0].reviewStatus, "submitted");
          assert.equal(body[0].items[0].submissionNote, "2 more reps this week");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});

test("movement checks remain phase-siloed when client submits checks in parallel phases", async (t) => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client", email: "client@example.com" })],
  ]);
  const phases = new Map<string, Phase>([
    [
      "phase_1",
      buildPhase({
        id: "phase_1",
        clientId: "client_1",
        name: "Phase One",
        status: "Waiting for Movement Check",
        movementChecks: [
          {
            exerciseId: "ex_shared",
            name: "Back Squat",
            status: "Pending",
            videoUrl: "https://youtube.com/watch?v=phase1",
            clientNote: "Week 1 baseline",
            submittedAt: new Date().toISOString(),
          },
        ],
      }),
    ],
    [
      "phase_2",
      buildPhase({
        id: "phase_2",
        clientId: "client_1",
        name: "Phase Two",
        status: "Waiting for Movement Check",
        movementChecks: [
          {
            exerciseId: "ex_shared",
            name: "Back Squat",
            status: "Not Submitted",
            videoUrl: "",
            clientNote: "",
            submittedAt: "",
          },
        ],
      }),
    ],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getPhase: async (id: string) => phases.get(id),
      getPhasesByClient: async (clientId: string) =>
        clientId === "client_1" ? Array.from(phases.values()) : [],
      updatePhase: async (id: string, data: Partial<Phase>) => {
        const phase = phases.get(id);
        if (!phase) return undefined;
        const updated = { ...phase, ...data };
        phases.set(id, updated);
        return updated;
      },
    },
    async () => {
      try {
        await withTestServer(registerRoutes, async (baseUrl) => {
          const submitPhaseTwo = await fetch(`${baseUrl}/api/phases/phase_2`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "client_1",
            },
            body: JSON.stringify({
              movementChecks: [
                {
                  exerciseId: "ex_shared",
                  videoUrl: "https://youtube.com/watch?v=phase2",
                  clientNote: "Phase 2 submission",
                },
              ],
            }),
          });
          assert.equal(submitPhaseTwo.status, 200);

          const grouped = await fetch(`${baseUrl}/api/clients/client_1/movement-checks/grouped`, {
            headers: { "x-test-user-id": "admin_1" },
          });
          assert.equal(grouped.status, 200);
          const body = (await grouped.json()) as Array<{
            phaseId: string;
            phaseName: string;
            items: Array<{
              exerciseId: string;
              videoUrl: string | null;
              status: string;
              note?: string;
            }>;
          }>;

          const phaseOne = body.find((entry) => entry.phaseId === "phase_1");
          const phaseTwo = body.find((entry) => entry.phaseId === "phase_2");
          assert.ok(phaseOne, "Phase one movement checks should remain visible");
          assert.ok(phaseTwo, "Phase two movement checks should appear after submission");
          assert.equal(phaseOne.items[0].videoUrl, "https://youtube.com/watch?v=phase1");
          assert.equal(phaseTwo.items[0].videoUrl, "https://youtube.com/watch?v=phase2");
          assert.equal(phaseOne.items[0].status, "submitted");
          assert.equal(phaseTwo.items[0].status, "submitted");
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EPERM"
        ) {
          t.skip(
            "Sandbox blocks local socket binding; run on local machine to execute API route test.",
          );
          return;
        }
        throw error;
      }
    },
  );
});
