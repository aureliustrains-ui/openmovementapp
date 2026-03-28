import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import type { TemplateFolder, User } from "@shared/schema";

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

test("DELETE /api/template-folders/:id removes folder and leaves templates uncategorized", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const admin = buildUser();
  const folders: TemplateFolder[] = [
    {
      id: "folder_phase_1",
      name: "Main",
      type: "phase",
      parentId: null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const phaseTemplates = [
    {
      id: "phase_tpl_1",
      name: "Phase A",
      folderId: "folder_phase_1",
      sortOrder: 0,
      goal: null,
      durationWeeks: 4,
      sessions: [],
      schedule: [],
      movementCheckEnabled: false,
    },
  ];

  await withPatchedStorage(
    storage,
    {
      getUser: async () => admin,
      getTemplateFolder: async (id: string) => folders.find((folder) => folder.id === id),
      getTemplateFolders: async (type: string) => folders.filter((folder) => folder.type === type),
      deleteTemplateFolder: async (id: string) => {
        for (const template of phaseTemplates) {
          if (template.folderId === id) template.folderId = null;
        }
        const index = folders.findIndex((folder) => folder.id === id);
        if (index >= 0) folders.splice(index, 1);
        return index >= 0;
      },
      getPhaseTemplates: async () => phaseTemplates,
    },
    async () => {
      await withTestServer(registerRoutes, async (baseUrl) => {
        const deleteRes = await fetch(`${baseUrl}/api/template-folders/folder_phase_1`, {
          method: "DELETE",
          headers: { "x-test-user-id": "admin_1" },
        });
        assert.equal(deleteRes.status, 200);

        const templatesRes = await fetch(`${baseUrl}/api/phase-templates`, {
          headers: { "x-test-user-id": "admin_1" },
        });
        assert.equal(templatesRes.status, 200);
        const templates = (await templatesRes.json()) as Array<{ folderId: string | null }>;
        assert.equal(templates[0]?.folderId, null);
      });
    },
  );
});

test("POST /api/template-folders/move-template updates folderId", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const admin = buildUser();
  const folders: TemplateFolder[] = [
    {
      id: "folder_session_1",
      name: "Session folder",
      type: "session",
      parentId: null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const sessionTemplates = [
    {
      id: "session_tpl_1",
      name: "Session A",
      folderId: null as string | null,
      sortOrder: 0,
      description: null,
      sections: [],
    },
  ];

  await withPatchedStorage(
    storage,
    {
      getUser: async () => admin,
      getTemplateFolder: async (id: string) => folders.find((folder) => folder.id === id),
      getSessionTemplates: async () => sessionTemplates,
      moveTemplateToFolder: async (_type: string, templateId: string, folderId: string | null) => {
        const target = sessionTemplates.find((template) => template.id === templateId);
        if (!target) return false;
        target.folderId = folderId;
        return true;
      },
    },
    async () => {
      await withTestServer(registerRoutes, async (baseUrl) => {
        const moveRes = await fetch(`${baseUrl}/api/template-folders/move-template`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-test-user-id": "admin_1",
          },
          body: JSON.stringify({
            type: "session",
            templateId: "session_tpl_1",
            folderId: "folder_session_1",
          }),
        });
        assert.equal(moveRes.status, 200);
        assert.equal(sessionTemplates[0]?.folderId, "folder_session_1");
      });
    },
  );
});

test("POST /api/template-folders/reorder-templates persists sort order", async () => {
  const { registerRoutes, storage } = await loadRouteDeps();
  const admin = buildUser();
  const sectionTemplates = [
    {
      id: "section_tpl_1",
      name: "A",
      folderId: null as string | null,
      sortOrder: 0,
      description: null,
      exercises: [],
    },
    {
      id: "section_tpl_2",
      name: "B",
      folderId: null as string | null,
      sortOrder: 1,
      description: null,
      exercises: [],
    },
  ];

  await withPatchedStorage(
    storage,
    {
      getUser: async () => admin,
      getSectionTemplates: async () => sectionTemplates,
      getTemplateFolder: async () => undefined,
      reorderTemplates: async (
        _type: string,
        items: Array<{ id: string; sortOrder: number; folderId: string | null }>,
      ) => {
        for (const item of items) {
          const target = sectionTemplates.find((template) => template.id === item.id);
          if (!target) continue;
          target.sortOrder = item.sortOrder;
          target.folderId = item.folderId;
        }
      },
    },
    async () => {
      await withTestServer(registerRoutes, async (baseUrl) => {
        const reorderRes = await fetch(`${baseUrl}/api/template-folders/reorder-templates`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-test-user-id": "admin_1",
          },
          body: JSON.stringify({
            type: "section",
            items: [
              { id: "section_tpl_2", sortOrder: 0, folderId: null },
              { id: "section_tpl_1", sortOrder: 1, folderId: null },
            ],
          }),
        });
        assert.equal(reorderRes.status, 200);
        assert.equal(sectionTemplates[0]?.sortOrder, 1);
        assert.equal(sectionTemplates[1]?.sortOrder, 0);
      });
    },
  );
});
