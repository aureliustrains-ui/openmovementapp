import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import type {
  Phase,
  ProgressReport,
  ProgressReportItem,
  User,
  WeeklyCheckin,
} from "@shared/schema";

type StorageLike = Record<string, unknown>;

async function loadRouteDeps() {
  const isolatedEnvKeys = [
    "BOOTSTRAP_ADMIN_EMAIL",
    "BOOTSTRAP_ADMIN_PASSWORD",
    "BOOTSTRAP_ADMIN_NAME",
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

function buildReport(overrides: Partial<ProgressReport> = {}): ProgressReport {
  return {
    id: "report_1",
    clientId: "client_1",
    phaseId: "phase_1",
    status: "requested",
    createdBy: "admin_1",
    createdAt: "2026-03-01T08:00:00.000Z",
    submittedAt: null,
    ...overrides,
  };
}

function buildItem(overrides: Partial<ProgressReportItem> = {}): ProgressReportItem {
  return {
    id: "item_1",
    progressReportId: "report_1",
    exerciseId: "exercise_1",
    exerciseName: "Squat",
    submissionSource: "link",
    submissionObjectKey: null,
    submissionMimeType: null,
    submissionOriginalFilename: null,
    submissionLink: "https://example.com/video",
    submissionNote: null,
    reviewStatus: "submitted",
    feedbackNote: null,
    reviewedAt: null,
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

test("GET /api/admin/clients/notification-summary aggregates chat, movement, and progress", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
  const phases: Phase[] = [
    buildPhase({
      id: "phase_1",
      clientId: "client_1",
      status: "Waiting for Movement Check",
      movementChecks: [{ status: "Pending" }],
    }),
  ];
  const reports: ProgressReport[] = [buildReport({ id: "report_1", status: "submitted" })];
  const reportItemsById = new Map<string, ProgressReportItem[]>([
    ["report_1", [buildItem({ reviewStatus: "submitted" })]],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getUsers: async () => Array.from(users.values()),
      getMessages: async () => [
        {
          id: "msg_1",
          clientId: "client_1",
          senderUserId: "client_1",
          sender: "Client",
          text: "Hi",
          time: "2026-03-01T10:00:00.000Z",
          isClient: true,
        },
      ],
      getPhases: async () => phases,
      getChatReadStatusByUser: async () => [
        {
          id: "read_1",
          userId: "admin_1",
          clientId: "client_1",
          lastReadAt: "2026-03-01T09:00:00.000Z",
        },
      ],
      getProgressReportsByClient: async (_clientId: string) => reports,
      getProgressReportItems: async (reportId: string) => reportItemsById.get(reportId) || [],
    },
    async () => {
      await withTestServer(registerRoutes, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/admin/clients/notification-summary`, {
          headers: { "x-test-user-id": "admin_1" },
        });
        assert.equal(response.status, 200);
        const body = (await response.json()) as {
          clients: Array<{
            clientId: string;
            unreadChatCount: number;
            movementAttentionCount: number;
            progressAttentionCount: number;
            totalAttentionCount: number;
          }>;
        };
        const row = body.clients.find((entry) => entry.clientId === "client_1");
        assert.ok(row);
        assert.equal(row?.unreadChatCount, 1);
        assert.equal(row?.movementAttentionCount, 1);
        assert.equal(row?.progressAttentionCount, 1);
        assert.equal(row?.totalAttentionCount, 3);
      });
    },
  );
});

test("GET /api/admin/clients/notification-summary excludes inactive clients from top-level triage", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_active", buildUser({ id: "client_active", role: "Client", status: "Active" })],
    ["client_inactive", buildUser({ id: "client_inactive", role: "Client", status: "Inactive" })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getUsers: async () => Array.from(users.values()),
      getMessages: async () => [
        {
          id: "msg_1",
          clientId: "client_inactive",
          senderUserId: "client_inactive",
          sender: "Client",
          text: "Old unread",
          time: "2026-03-01T10:00:00.000Z",
          isClient: true,
        },
      ],
      getPhases: async () => [],
      getChatReadStatusByUser: async () => [],
      getProgressReportsByClient: async () => [],
      getProgressReportItems: async () => [],
    },
    async () => {
      await withTestServer(registerRoutes, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/admin/clients/notification-summary`, {
          headers: { "x-test-user-id": "admin_1" },
        });
        assert.equal(response.status, 200);
        const body = (await response.json()) as {
          clients: Array<{ clientId: string }>;
        };
        assert.ok(body.clients.some((entry) => entry.clientId === "client_active"));
        assert.equal(
          body.clients.some((entry) => entry.clientId === "client_inactive"),
          false,
        );
      });
    },
  );
});

test("GET /api/admin/clients/notification-summary uses latest chat read status per client", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["admin_1", buildUser({ id: "admin_1", role: "Admin", email: "admin@example.com" })],
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getUsers: async () => Array.from(users.values()),
      getMessages: async () => [
        {
          id: "msg_1",
          clientId: "client_1",
          senderUserId: "client_1",
          sender: "Client",
          text: "Hello",
          time: "2026-03-10T10:00:00.000Z",
          isClient: true,
        },
      ],
      getPhases: async () => [],
      getProgressReportsByClient: async () => [],
      getProgressReportItems: async () => [],
      getChatReadStatusByUser: async () => [
        {
          id: "read_new",
          userId: "admin_1",
          clientId: "client_1",
          lastReadAt: "2026-03-10T10:30:00.000Z",
        },
        {
          id: "read_old",
          userId: "admin_1",
          clientId: "client_1",
          lastReadAt: "2026-03-10T09:00:00.000Z",
        },
      ],
    },
    async () => {
      await withTestServer(registerRoutes, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/admin/clients/notification-summary`, {
          headers: { "x-test-user-id": "admin_1" },
        });
        assert.equal(response.status, 200);
        const body = (await response.json()) as {
          clients: Array<{
            clientId: string;
            unreadChatCount: number;
            totalAttentionCount: number;
          }>;
        };
        const row = body.clients.find((entry) => entry.clientId === "client_1");
        assert.ok(row);
        assert.equal(row?.unreadChatCount, 0);
        assert.equal(row?.totalAttentionCount, 0);
      });
    },
  );
});

test("GET /api/notifications/me/summary returns client action buckets including weekly due", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const users = new Map<string, User>([
    ["client_1", buildUser({ id: "client_1", role: "Client" })],
  ]);
  const phases: Phase[] = [
    buildPhase({
      id: "phase_1",
      clientId: "client_1",
      status: "Active",
      movementChecks: [{ status: "Not Submitted" }],
      schedule: [{ week: 1, day: "Monday", slot: "AM", sessionId: "session_1" }],
      completedScheduleInstances: ["w1_Monday_AM_session_1"],
    }),
  ];
  const reports: ProgressReport[] = [buildReport({ id: "report_1", status: "requested" })];
  const weeklyCheckins: WeeklyCheckin[] = [];

  await withPatchedStorage(
    storage,
    {
      getUser: async (id: string) => users.get(id),
      getMessages: async () => [
        {
          id: "msg_1",
          clientId: "client_1",
          senderUserId: "admin_1",
          sender: "Coach",
          text: "Check in",
          time: "2026-03-01T10:00:00.000Z",
          isClient: false,
        },
      ],
      getChatReadStatus: async () => ({
        id: "read_1",
        userId: "client_1",
        clientId: "client_1",
        lastReadAt: "2026-03-01T09:00:00.000Z",
      }),
      getPhasesByClient: async () => phases,
      getWeeklyCheckinsByClient: async () => weeklyCheckins,
      getProgressReportsByClient: async () => reports,
      getWeeklyCheckinByClientAndPhaseWeek: async () => undefined,
    },
    async () => {
      await withTestServer(registerRoutes, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/notifications/me/summary`, {
          headers: { "x-test-user-id": "client_1" },
        });
        assert.equal(response.status, 200);
        const body = (await response.json()) as {
          unreadChatCount: number;
          movementActionCount: number;
          progressActionCount: number;
          weeklyCheckinDue: boolean;
          totalAttentionCount: number;
        };
        assert.equal(body.unreadChatCount, 1);
        assert.equal(body.movementActionCount, 1);
        assert.equal(body.progressActionCount, 1);
        assert.equal(body.weeklyCheckinDue, true);
        assert.equal(body.totalAttentionCount, 4);
      });
    },
  );
});
