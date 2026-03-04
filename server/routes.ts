import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { hashPassword, verifyPassword } from "./auth";
import type { User } from "@shared/schema";

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  role: z.enum(["Admin", "Client"]).optional(),
  status: z.string().max(64).optional(),
  avatar: z.string().url().nullable().optional(),
});

function toPublicUser(user: User) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

declare module "express-serve-static-core" {
  interface Request {
    authUser?: User;
  }
}

async function attachAuthUser(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.authUser = user;
  next();
}

function isAdmin(user: User) {
  return user.role === "Admin";
}

function requireAdmin(req: Request, res: Response): User | null {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  if (!isAdmin(user)) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  return user;
}

function requireUser(req: Request, res: Response): User | null {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return user;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid registration payload" });
    }

    const existing = await storage.getUserByEmail(parsed.data.email.toLowerCase());
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const created = await storage.createUser({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      role: "Client",
      status: "Active",
      avatar: null,
    });

    req.session.userId = created.id;
    res.status(201).json({ user: toPublicUser(created) });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login payload" });
    }

    const user = await storage.getUserByEmail(parsed.data.email.toLowerCase());
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    req.session.userId = user.id;
    res.json({ user: toPublicUser(user) });
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.status(204).send();
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      req.session.destroy(() => {
        res.status(401).json({ message: "Unauthorized" });
      });
      return;
    }

    res.json({ user: toPublicUser(user) });
  });

  app.use("/api", requireAuth, attachAuthUser);

  app.get("/api/users", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const users = await storage.getUsers();
    res.json(users.map(toPublicUser));
  });

  app.get("/api/users/:id", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    if (!isAdmin(authUser) && authUser.id !== req.params.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(toPublicUser(user));
  });

  app.post("/api/users", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid user payload" });
    }

    const existing = await storage.getUserByEmail(parsed.data.email.toLowerCase());
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const user = await storage.createUser({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role ?? "Client",
      status: parsed.data.status ?? "Active",
      avatar: parsed.data.avatar ?? null,
    });
    res.status(201).json(toPublicUser(user));
  });

  app.get("/api/phases", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const clientId = req.query.clientId as string | undefined;
    if (!isAdmin(authUser) && clientId && clientId !== authUser.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const result = clientId
      ? await storage.getPhasesByClient(clientId)
      : isAdmin(authUser)
        ? await storage.getPhases()
        : await storage.getPhasesByClient(authUser.id);
    res.json(result);
  });

  app.get("/api/phases/:id", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const phase = await storage.getPhase(req.params.id);
    if (!phase) return res.status(404).json({ message: "Phase not found" });
    if (!isAdmin(authUser) && phase.clientId !== authUser.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(phase);
  });

  app.post("/api/phases", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const phase = await storage.createPhase(req.body);
    res.status(201).json(phase);
  });

  app.patch("/api/phases/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const phase = await storage.updatePhase(req.params.id, req.body);
    if (!phase) return res.status(404).json({ message: "Phase not found" });
    res.json(phase);
  });

  app.delete("/api/phases/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const deleted = await storage.deletePhase(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Phase not found" });
    res.json({ success: true });
  });

  app.get("/api/sessions", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const phaseId = req.query.phaseId as string | undefined;
    let result = phaseId
      ? await storage.getSessionsByPhase(phaseId)
      : await storage.getSessions();

    if (!isAdmin(authUser)) {
      const allowedPhaseIds = new Set((await storage.getPhasesByClient(authUser.id)).map((p) => p.id));
      result = result.filter((session) => allowedPhaseIds.has(session.phaseId));
    }
    res.json(result);
  });

  app.get("/api/sessions/:id", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const session = await storage.getSession(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (!isAdmin(authUser)) {
      const phase = await storage.getPhase(session.phaseId);
      if (!phase || phase.clientId !== authUser.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }
    res.json(session);
  });

  app.post("/api/sessions", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const session = await storage.createSession(req.body);
    res.status(201).json(session);
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const session = await storage.updateSession(req.params.id, req.body);
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const deleted = await storage.deleteSession(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Session not found" });
    res.json({ success: true });
  });

  app.get("/api/exercise-templates", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const templates = await storage.getExerciseTemplates();
    res.json(templates);
  });

  app.post("/api/exercise-templates", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const template = await storage.createExerciseTemplate(req.body);
    res.status(201).json(template);
  });

  app.patch("/api/exercise-templates/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const template = await storage.updateExerciseTemplate(req.params.id, req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/exercise-templates/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const deleted = await storage.deleteExerciseTemplate(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Template not found" });
    res.json({ success: true });
  });

  app.get("/api/section-templates", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const templates = await storage.getSectionTemplates();
    res.json(templates);
  });

  app.post("/api/section-templates", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const template = await storage.createSectionTemplate(req.body);
    res.status(201).json(template);
  });

  app.patch("/api/section-templates/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const template = await storage.updateSectionTemplate(req.params.id, req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/section-templates/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const deleted = await storage.deleteSectionTemplate(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Template not found" });
    res.json({ success: true });
  });

  app.get("/api/session-templates", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const templates = await storage.getSessionTemplates();
    res.json(templates);
  });

  app.post("/api/session-templates", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const template = await storage.createSessionTemplate(req.body);
    res.status(201).json(template);
  });

  app.patch("/api/session-templates/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const template = await storage.updateSessionTemplate(req.params.id, req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/session-templates/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const deleted = await storage.deleteSessionTemplate(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Template not found" });
    res.json({ success: true });
  });

  app.get("/api/phase-templates", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const templates = await storage.getPhaseTemplates();
    res.json(templates);
  });

  app.post("/api/phase-templates", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const template = await storage.createPhaseTemplate(req.body);
    res.status(201).json(template);
  });

  app.patch("/api/phase-templates/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const template = await storage.updatePhaseTemplate(req.params.id, req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/phase-templates/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const deleted = await storage.deletePhaseTemplate(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Template not found" });
    res.json({ success: true });
  });

  app.get("/api/workout-logs", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const clientId = req.query.clientId as string | undefined;
    if (!isAdmin(authUser) && clientId && clientId !== authUser.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const result = clientId
      ? await storage.getLogsByClient(clientId)
      : isAdmin(authUser)
        ? await storage.getWorkoutLogs()
        : await storage.getLogsByClient(authUser.id);
    res.json(result);
  });

  app.post("/api/workout-logs", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    if (!isAdmin(authUser) && req.body.clientId !== authUser.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!isAdmin(authUser)) {
      const phase = await storage.getPhase(req.body.phaseId);
      if (!phase || phase.clientId !== authUser.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }
    const log = await storage.createWorkoutLog(req.body);
    res.status(201).json(log);
  });

  app.get("/api/messages", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const clientId = req.query.clientId as string | undefined;
    if (!isAdmin(authUser) && clientId && clientId !== authUser.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const result = clientId
      ? await storage.getMessagesByClient(clientId)
      : isAdmin(authUser)
        ? await storage.getMessages()
        : await storage.getMessagesByClient(authUser.id);
    res.json(result);
  });

  app.post("/api/messages", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    if (!isAdmin(authUser) && req.body.clientId !== authUser.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const message = await storage.createMessage(req.body);
    res.status(201).json(message);
  });

  app.get("/api/chat/unread", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const userId = authUser.id;
    const role = authUser.role;

    const readStatuses = await storage.getChatReadStatusByUser(userId);
    const allMessages = await storage.getMessages();

    if (role === "Client") {
      const clientMessages = allMessages.filter(m => m.clientId === userId && !m.isClient);
      const readStatus = readStatuses.find(s => s.clientId === userId);
      const lastReadAt = readStatus?.lastReadAt || "1970-01-01T00:00:00.000Z";
      const unread = clientMessages.filter(m => m.time > lastReadAt).length;
      res.json({ total: unread, conversations: [{ clientId: userId, unread }] });
    } else {
      const clientIds = [...new Set(allMessages.map(m => m.clientId))];
      let total = 0;
      const conversations: { clientId: string; unread: number }[] = [];
      for (const cid of clientIds) {
        const clientMsgs = allMessages.filter(m => m.clientId === cid && m.isClient);
        const readStatus = readStatuses.find(s => s.clientId === cid);
        const lastReadAt = readStatus?.lastReadAt || "1970-01-01T00:00:00.000Z";
        const unread = clientMsgs.filter(m => m.time > lastReadAt).length;
        if (unread > 0) {
          conversations.push({ clientId: cid, unread });
          total += unread;
        }
      }
      res.json({ total, conversations });
    }
  });

  app.post("/api/chat/read", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const clientId = String(req.body?.clientId || "");
    if (!clientId) return res.status(400).json({ message: "clientId required" });
    const userId = authUser.id;
    if (!isAdmin(authUser) && clientId !== authUser.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const result = await storage.upsertChatReadStatus(userId, clientId, new Date().toISOString());
    res.json(result);
  });

  return httpServer;
}
