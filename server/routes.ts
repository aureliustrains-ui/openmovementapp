import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { hashPassword, verifyPassword } from "./auth";
import type { Phase, User } from "@shared/schema";
import { createUserAccount } from "./modules/users/users.service";
import { loginWithEmailPassword, requireAuthenticatedUser } from "./modules/auth/auth.service";
import { updateMyProfile } from "./modules/profile/profile.service";
import {
  assertCoachCanManageSpecifics,
  mapWorkoutHistoryForCoach,
  saveClientSpecifics,
} from "./modules/clients/specifics.service";
import { AppError } from "./http/error-handler";
import {
  createMessageSchema,
  createSessionCheckinSchema,
  createWeeklyCheckinSchema,
  createWorkoutLogSchema,
  markChatReadSchema,
} from "./http/request-schemas";
import {
  assertCanReadClientCheckins,
  assertSessionOwnedByClient,
  ensureWeeklyCheckinNotSubmitted,
  getWeekStartDateUtc,
  normalizeWeeklyCheckinInput,
} from "./modules/checkins/checkins.service";

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

const updateMyProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().max(320).optional(),
  avatar: z.string().max(2048).nullable().optional(),
  bio: z.string().max(4000).nullable().optional(),
  height: z.string().max(120).nullable().optional(),
  weight: z.string().max(120).nullable().optional(),
  goals: z.string().max(4000).nullable().optional(),
  infos: z.string().max(4000).nullable().optional(),
});

const updateClientSpecificsSchema = z.object({
  specifics: z.string().max(8000).nullable(),
});

const maxAvatarSizeBytes = 5 * 1024 * 1024;
const allowedAvatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const routesDirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.resolve(routesDirname, "..", "uploads");
const avatarUploadDir = path.join(uploadRoot, "avatars");
const invalidAvatarFileTypeError = "INVALID_AVATAR_FILE_TYPE";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const authUserId = req.authUser?.id;
      if (!authUserId) {
        cb(new Error("UNAUTHORIZED_AVATAR_UPLOAD"), avatarUploadDir);
        return;
      }
      const userDir = path.join(avatarUploadDir, authUserId);
      fs.mkdirSync(userDir, { recursive: true });
      cb(null, userDir);
    },
    filename: (req, file, cb) => {
      if (!req.authUser?.id) {
        cb(new Error("UNAUTHORIZED_AVATAR_UPLOAD"), "avatar");
        return;
      }
      const ext = path.extname(file.originalname).toLowerCase();
      const safeBase = sanitizeFilename(path.basename(file.originalname, ext)).slice(0, 64) || "avatar";
      cb(null, `${Date.now()}-${safeBase}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (!allowedAvatarMimeTypes.has(file.mimetype)) {
      cb(new Error(invalidAvatarFileTypeError));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: maxAvatarSizeBytes,
    files: 1,
  },
});

function toPublicUser(user: User) {
  const { passwordHash, ...safeUser } = user;
  void passwordHash;
  return safeUser;
}

function toPublicMessage(
  message: {
    id: string;
    clientId: string;
    senderUserId: string | null;
    sender: string;
    text: string;
    time: string;
    isClient: boolean;
  },
  senderUser: User | undefined,
  clientUser: User | undefined,
) {
  const senderName = senderUser?.name || message.sender || (message.isClient ? clientUser?.name : undefined) || "Coach";
  const senderAvatar = senderUser?.avatar || (message.isClient ? clientUser?.avatar : null) || null;
  return {
    ...message,
    sender: senderName,
    senderName,
    senderAvatar,
  };
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

function parseCheckinsRange(rangeRaw: string | undefined): number | null {
  if (!rangeRaw || rangeRaw === "all") return null;
  const mapping: Record<string, number> = {
    "2w": 14,
    "4w": 28,
    "8w": 56,
    "12w": 84,
  };
  return mapping[rangeRaw] ?? 28;
}

function getActivePhase(phases: Phase[]): Phase | undefined {
  return (
    phases.find((phase) => phase.status === "Active") ??
    phases.find((phase) => phase.status === "Waiting for Movement Check") ??
    phases[0]
  );
}

function getCurrentPhaseWeek(phase: Phase, now = new Date()): number {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startDate = phase.startDate ? new Date(`${phase.startDate}T00:00:00.000Z`) : null;
  const startUtc = startDate ? Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()) : null;
  const elapsedDays = startUtc === null ? 0 : Math.max(0, Math.floor((todayUtc - startUtc) / (24 * 60 * 60 * 1000)));
  const phaseWeekRaw = Math.floor(elapsedDays / 7) + 1;
  return Math.min(Math.max(phaseWeekRaw, 1), Math.max(1, phase.durationWeeks || 1));
}

function getWeekCompletionForPhase(phase: Phase, phaseWeek: number): { scheduledCount: number; completedCount: number } {
  const scheduleEntries = (
    (phase.schedule as Array<{ week?: number; day?: string; slot?: string; sessionId?: string }>) || []
  ).filter((entry) => entry.week === phaseWeek && typeof entry.sessionId === "string");

  if (scheduleEntries.length === 0) {
    return { scheduledCount: 0, completedCount: 0 };
  }

  const completed = new Set(
    ((phase.completedScheduleInstances as string[]) || []).filter((entry) => typeof entry === "string"),
  );
  const completedCount = scheduleEntries.filter((entry) => {
    const day = entry.day || "Monday";
    const slot = entry.slot || "AM";
    return completed.has(`w${phaseWeek}_${day}_${slot}_${entry.sessionId}`);
  }).length;

  return { scheduledCount: scheduleEntries.length, completedCount };
}

async function persistSession(session: Request["session"]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    session.save((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    "/uploads",
    (_req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      next();
    },
    express.static(uploadRoot, {
      index: false,
      redirect: false,
      fallthrough: true,
    }),
  );

  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid registration payload" });
    }

    let created;
    try {
      created = await createUserAccount(
        {
          name: parsed.data.name,
          email: parsed.data.email,
          password: parsed.data.password,
          role: "Client",
          status: "Active",
          avatar: null,
        },
        {
          users: storage,
          hashPassword,
        },
      );
    } catch (error) {
      if (error instanceof AppError && error.code === "EMAIL_IN_USE") {
        return res.status(409).json({ message: "Email already in use" });
      }
      throw error;
    }

    req.session.userId = created.id;
    await persistSession(req.session);
    res.status(201).json({ user: toPublicUser(created) });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login payload" });
    }

    let user;
    try {
      user = await loginWithEmailPassword(
        { email: parsed.data.email, password: parsed.data.password },
        { users: storage, verifyPassword },
      );
    } catch (error) {
      if (error instanceof AppError && error.code === "INVALID_CREDENTIALS") {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      throw error;
    }

    req.session.userId = user.id;
    await persistSession(req.session);
    res.json({ user: toPublicUser(user) });
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.status(204).send();
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    let user;
    try {
      user = await requireAuthenticatedUser(req.session?.userId, { users: storage });
    } catch (error) {
      if (error instanceof AppError && error.code === "UNAUTHORIZED") {
        req.session.destroy(() => {
          res.status(401).json({ message: "Unauthorized" });
        });
        return;
      }
      throw error;
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

  app.get("/api/me", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const user = await storage.getUser(authUser.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(toPublicUser(user));
  });

  app.patch("/api/me", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const parsed = updateMyProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid profile payload" });
    }
    let updated;
    try {
      updated = await updateMyProfile(authUser.id, parsed.data, { users: storage });
    } catch (error) {
      if (error instanceof AppError && error.code === "USER_NOT_FOUND") {
        return res.status(404).json({ message: "User not found" });
      }
      if (error instanceof AppError && error.code === "EMAIL_IN_USE") {
        return res.status(409).json({ message: "Email already in use" });
      }
      throw error;
    }
    res.json(toPublicUser(updated));
  });

  app.post("/api/me/avatar", (req, res, next) => {
    avatarUpload.single("avatar")(req, res, async (err: unknown) => {
      if (err) {
        if (err instanceof Error && err.message === "UNAUTHORIZED_AVATAR_UPLOAD") {
          return res.status(401).json({ message: "Unauthorized" });
        }
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "Avatar is too large (max 5MB)" });
        }
        if (err instanceof Error && err.message === invalidAvatarFileTypeError) {
          return res.status(400).json({ message: "Invalid avatar file. Use png, jpg, or webp." });
        }
        return res.status(400).json({ message: "Invalid avatar file. Use png, jpg, or webp." });
      }

      const authUser = requireUser(req, res);
      if (!authUser) return;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "Avatar file is required" });
      }

      try {
        const normalizedPath = file.path.replaceAll("\\", "/");
        const marker = `/uploads/avatars/${authUser.id}/`;
        const markerIndex = normalizedPath.indexOf(marker);
        const avatarPath = markerIndex >= 0
          ? normalizedPath.slice(markerIndex)
          : `/uploads/avatars/${authUser.id}/${file.filename}`;
        const updated = await storage.updateUser(authUser.id, { avatar: avatarPath });
        if (!updated) return res.status(404).json({ message: "User not found" });
        res.json({ avatar: updated.avatar, user: toPublicUser(updated) });
      } catch (error) {
        next(error);
      }
    });
  });

  app.post("/api/users", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join("; ");
      return res.status(400).json({ message: details || "Invalid user payload" });
    }

    let user;
    try {
      user = await createUserAccount(
        {
          name: parsed.data.name,
          email: parsed.data.email,
          password: parsed.data.password,
          role: parsed.data.role ?? "Client",
          status: parsed.data.status ?? "Active",
          avatar: parsed.data.avatar ?? null,
        },
        {
          users: storage,
          hashPassword,
        },
      );
    } catch (error) {
      if (error instanceof AppError && error.code === "EMAIL_IN_USE") {
        return res.status(409).json({ message: "Email already in use" });
      }
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: unknown }).code === "23505"
      ) {
        return res.status(409).json({ message: "Email already in use" });
      }
      throw error;
    }

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
    const authUser = requireUser(req, res);
    if (!authUser) return;

    let updatePayload = req.body;
    if (!isAdmin(authUser)) {
      const phaseForClient = await storage.getPhase(req.params.id);
      if (!phaseForClient || phaseForClient.clientId !== authUser.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const allowedClientKeys = ["completedScheduleInstances"];
      const payloadKeys = Object.keys(req.body || {});
      const hasOnlyAllowedKeys = payloadKeys.every((key) => allowedClientKeys.includes(key));
      if (!hasOnlyAllowedKeys || payloadKeys.length === 0) {
        return res.status(403).json({ message: "Forbidden" });
      }

      updatePayload = {
        completedScheduleInstances: req.body.completedScheduleInstances,
      };
    }

    const phase = await storage.updatePhase(req.params.id, updatePayload);
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

  app.get("/api/phase-templates/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const template = await storage.getPhaseTemplate(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
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
    if (isAdmin(authUser)) {
      return res.json(mapWorkoutHistoryForCoach(result));
    }
    res.json(result);
  });

  app.get("/api/clients/:id/specifics", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    try {
      assertCoachCanManageSpecifics(authUser);
    } catch (error) {
      if (error instanceof AppError && error.code === "FORBIDDEN") {
        return res.status(403).json({ message: "Forbidden" });
      }
      throw error;
    }
    const client = await storage.getUser(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json({
      specifics: client.specifics || "",
      specificsUpdatedAt: client.specificsUpdatedAt || null,
      specificsUpdatedBy: client.specificsUpdatedBy || null,
    });
  });

  app.patch("/api/clients/:id/specifics", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    try {
      assertCoachCanManageSpecifics(authUser);
    } catch (error) {
      if (error instanceof AppError && error.code === "FORBIDDEN") {
        return res.status(403).json({ message: "Forbidden" });
      }
      throw error;
    }
    const parsed = updateClientSpecificsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid specifics payload" });
    }
    try {
      const specifics = await saveClientSpecifics(
        req.params.id,
        parsed.data.specifics ?? null,
        authUser.name,
        {
        users: storage,
        },
      );
      res.json(specifics);
    } catch (error) {
      if (error instanceof AppError && error.code === "CLIENT_NOT_FOUND") {
        return res.status(404).json({ message: "Client not found" });
      }
      throw error;
    }
  });

  app.post("/api/workout-logs", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const parsed = createWorkoutLogSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid workout log payload" });
    }
    if (!isAdmin(authUser) && parsed.data.clientId !== authUser.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!isAdmin(authUser)) {
      const phase = await storage.getPhase(parsed.data.phaseId);
      if (!phase || phase.clientId !== authUser.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }
    const phaseSessions = await storage.getSessionsByPhase(parsed.data.phaseId);
    let exerciseName: string | null = null;
    for (const session of phaseSessions) {
      const sections = Array.isArray(session.sections) ? session.sections : [];
      for (const section of sections) {
        if (!section || typeof section !== "object") continue;
        const maybeExercises = (section as { exercises?: unknown }).exercises;
        const exercises = Array.isArray(maybeExercises) ? maybeExercises : [];
        const match = exercises.find((ex) => {
          if (!ex || typeof ex !== "object") return false;
          return (ex as { id?: unknown }).id === parsed.data.exerciseId;
        });
        if (match && typeof (match as { name?: unknown }).name === "string") {
          exerciseName = (match as { name: string }).name;
          break;
        }
      }
      if (exerciseName) break;
    }

    const log = await storage.createWorkoutLog({
      ...parsed.data,
      exerciseName: exerciseName || "Unknown exercise",
      clientNotes: parsed.data.clientNotes ?? null,
    });
    res.status(201).json(log);
  });

  app.post("/api/session-checkins", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    if (authUser.role !== "Client") {
      return res.status(403).json({
        message: "Only client accounts can submit session check-ins",
      });
    }
    const parsed = createSessionCheckinSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join("; ");
      return res.status(400).json({ message: details || "Invalid session check-in payload" });
    }

    try {
      await assertSessionOwnedByClient(parsed.data.sessionId, authUser.id, {
        getSession: storage.getSession.bind(storage),
        getPhase: storage.getPhase.bind(storage),
      });
    } catch (error) {
      if (error instanceof AppError && error.code === "FORBIDDEN") {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (error instanceof AppError && error.code === "SESSION_NOT_FOUND") {
        return res.status(404).json({ message: "Session not found" });
      }
      throw error;
    }

    try {
      const created = await storage.createSessionCheckin({
        clientId: authUser.id,
        sessionId: parsed.data.sessionId,
        submittedAt: new Date().toISOString(),
        rpeOverall: parsed.data.rpeOverall,
        feltOff: parsed.data.feltOff ?? false,
        feltOffNote: parsed.data.feltOff ? parsed.data.feltOffNote?.trim() || null : null,
      });
      res.status(201).json(created);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: unknown }).code === "42P01"
      ) {
        return res.status(500).json({ message: "Database not ready for check-ins. Run npm run db:push." });
      }
      throw error;
    }
  });

  app.get("/api/session-checkins/me", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const checkins = await storage.getSessionCheckinsByClient(authUser.id);
    checkins.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    res.json(checkins);
  });

  app.post("/api/weekly-checkins", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    if (authUser.role !== "Client") {
      return res.status(403).json({
        message: "Only client accounts can submit weekly check-ins",
      });
    }
    const parsed = createWeeklyCheckinSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join("; ");
      return res.status(400).json({ message: details || "Invalid weekly check-in payload" });
    }

    const weekStartDate = getWeekStartDateUtc();
    const phases = await storage.getPhasesByClient(authUser.id);
    const activePhase = getActivePhase(phases);
    if (!activePhase) {
      return res.status(400).json({ message: "No active phase found for weekly check-in" });
    }
    const phaseWeekNumber = getCurrentPhaseWeek(activePhase);

    const legacyCurrentWeek = await storage.getWeeklyCheckinByClientAndWeek(authUser.id, weekStartDate);
    if (legacyCurrentWeek && !legacyCurrentWeek.phaseId && legacyCurrentWeek.phaseWeekNumber == null) {
      await storage.updateWeeklyCheckinIdentity(legacyCurrentWeek.id, {
        phaseId: activePhase.id,
        phaseWeekNumber,
        weekStartDate,
      });
    }

    try {
      await ensureWeeklyCheckinNotSubmitted(authUser.id, activePhase.id, phaseWeekNumber, {
        getWeeklyCheckinByClientAndPhaseWeek: storage.getWeeklyCheckinByClientAndPhaseWeek.bind(storage),
      });
    } catch (error) {
      if (error instanceof AppError && error.code === "WEEKLY_CHECKIN_EXISTS") {
        return res.status(409).json({ message: "Weekly check-in already submitted for this training week" });
      }
      throw error;
    }

    try {
      const created = await storage.createWeeklyCheckin(
        normalizeWeeklyCheckinInput(parsed.data, authUser.id, activePhase.id, phaseWeekNumber, weekStartDate),
      );
      res.status(201).json(created);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: unknown }).code === "23505"
      ) {
        return res.status(409).json({ message: "Weekly check-in already submitted for this training week" });
      }
      throw error;
    }
  });

  app.get("/api/weekly-checkins/me", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const checkins = await storage.getWeeklyCheckinsByClient(authUser.id);
    checkins.sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
    res.json(checkins);
  });

  app.get("/api/weekly-checkins/me/current-or-due", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const weekStartDate = getWeekStartDateUtc();
    const phases = await storage.getPhasesByClient(authUser.id);
    const activePhase = getActivePhase(phases);
    const phaseWeekNumber = activePhase ? getCurrentPhaseWeek(activePhase) : null;

    let existing;
    if (activePhase && phaseWeekNumber !== null) {
      existing = await storage.getWeeklyCheckinByClientAndPhaseWeek(authUser.id, activePhase.id, phaseWeekNumber);
    }
    if (!existing && activePhase && phaseWeekNumber !== null) {
      const legacyCurrentWeek = await storage.getWeeklyCheckinByClientAndWeek(authUser.id, weekStartDate);
      if (legacyCurrentWeek && !legacyCurrentWeek.phaseId && legacyCurrentWeek.phaseWeekNumber == null) {
        existing =
          (await storage.updateWeeklyCheckinIdentity(legacyCurrentWeek.id, {
            phaseId: activePhase.id,
            phaseWeekNumber,
            weekStartDate,
          })) || legacyCurrentWeek;
      }
    }

    let due = false;
    if (!existing && activePhase && phaseWeekNumber !== null) {
      const { scheduledCount, completedCount } = getWeekCompletionForPhase(activePhase, phaseWeekNumber);
      due = scheduledCount > 0 && completedCount >= scheduledCount;
    }

    res.json({
      weekStartDate,
      due,
      current: existing || null,
    });
  });

  app.get("/api/clients/:clientId/checkins/summary", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const clientId = req.params.clientId;
    try {
      assertCanReadClientCheckins(authUser, clientId);
    } catch (error) {
      if (error instanceof AppError && error.code === "FORBIDDEN") {
        return res.status(403).json({ message: "Forbidden" });
      }
      throw error;
    }
    const [sessionCheckins, weeklyCheckins] = await Promise.all([
      storage.getSessionCheckinsByClient(clientId),
      storage.getWeeklyCheckinsByClient(clientId),
    ]);

    const lastWeekly = [...weeklyCheckins]
      .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))
      .slice(0, 6);
    const avg = (values: number[]) =>
      values.length > 0
        ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
        : null;

    res.json({
      avgWeeklySleep: avg(lastWeekly.map((entry) => entry.sleepWeek)),
      avgWeeklyEnergy: avg(lastWeekly.map((entry) => entry.energyWeek)),
      avgSessionRpe: avg(sessionCheckins.map((entry) => entry.rpeOverall)),
      feltOffFlags: sessionCheckins.filter((entry) => entry.feltOff).length,
      injuryAffectedWeeks: weeklyCheckins.filter((entry) => entry.injuryAffectedTraining).length,
      sessionCheckinsCount: sessionCheckins.length,
      weeklyCheckinsCount: weeklyCheckins.length,
    });
  });

  app.get("/api/clients/:clientId/checkins/trends", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const clientId = req.params.clientId;
    try {
      assertCanReadClientCheckins(authUser, clientId);
    } catch (error) {
      if (error instanceof AppError && error.code === "FORBIDDEN") {
        return res.status(403).json({ message: "Forbidden" });
      }
      throw error;
    }
    const rangeDays = parseCheckinsRange(req.query.range as string | undefined);
    const now = new Date();
    const cutoffDate = rangeDays ? new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000) : null;
    const cutoffDateYmd = cutoffDate ? cutoffDate.toISOString().slice(0, 10) : null;

    const [sessionCheckinsAll, weeklyCheckinsAll, sessionsAll] = await Promise.all([
      storage.getSessionCheckinsByClient(clientId),
      storage.getWeeklyCheckinsByClient(clientId),
      storage.getSessions(),
    ]);
    const sessionNameById = new Map(sessionsAll.map((session) => [session.id, session.name]));

    const sessionCheckins = sessionCheckinsAll
      .filter((entry) => !cutoffDate || new Date(entry.submittedAt) >= cutoffDate)
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

    const weeklyCheckins = weeklyCheckinsAll
      .filter((entry) => !cutoffDateYmd || entry.weekStartDate >= cutoffDateYmd)
      .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));

    res.json({
      rangeDays: rangeDays ?? "all",
      sessions: sessionCheckins.map((entry) => ({
        id: entry.id,
        date: entry.submittedAt,
        sessionId: entry.sessionId,
        sessionName: sessionNameById.get(entry.sessionId) || "Session",
        rpeOverall: entry.rpeOverall,
        feltOff: entry.feltOff,
        feltOffNote: entry.feltOffNote || null,
      })),
      weeks: weeklyCheckins.map((entry) => ({
        id: entry.id,
        weekStartDate: entry.weekStartDate,
        submittedAt: entry.submittedAt,
        sleepWeek: entry.sleepWeek,
        energyWeek: entry.energyWeek,
        injuryAffectedTraining: entry.injuryAffectedTraining,
        injuryImpact: entry.injuryImpact,
        coachNoteFromClient: entry.coachNoteFromClient || null,
      })),
    });
  });

  app.get("/api/clients/:clientId/checkins/recent", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const clientId = req.params.clientId;
    try {
      assertCanReadClientCheckins(authUser, clientId);
    } catch (error) {
      if (error instanceof AppError && error.code === "FORBIDDEN") {
        return res.status(403).json({ message: "Forbidden" });
      }
      throw error;
    }
    const limitParsed = Number.parseInt(String(req.query.limit ?? "8"), 10);
    const limit = Number.isFinite(limitParsed) ? Math.max(1, Math.min(20, limitParsed)) : 8;
    const [sessionCheckins, weeklyCheckins, sessionsAll] = await Promise.all([
      storage.getSessionCheckinsByClient(clientId),
      storage.getWeeklyCheckinsByClient(clientId),
      storage.getSessions(),
    ]);
    const sessionNameById = new Map(sessionsAll.map((session) => [session.id, session.name]));

    const recentSessions = [...sessionCheckins]
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .slice(0, limit)
      .map((entry) => ({
        ...entry,
        sessionName: sessionNameById.get(entry.sessionId) || "Session",
      }));

    const recentWeeks = [...weeklyCheckins]
      .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))
      .slice(0, limit);

    res.json({
      sessions: recentSessions,
      weeks: recentWeeks,
    });
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

    const clientIds = Array.from(new Set(result.map((message) => message.clientId)));
    const senderIds = Array.from(
      new Set(result.map((message) => message.senderUserId).filter((id): id is string => Boolean(id))),
    );
    const [clientUsers, senderUsers] = await Promise.all([
      Promise.all(clientIds.map((id) => storage.getUser(id))),
      Promise.all(senderIds.map((id) => storage.getUser(id))),
    ]);

    const clientById = new Map(clientUsers.filter((user): user is User => Boolean(user)).map((user) => [user.id, user]));
    const senderById = new Map(senderUsers.filter((user): user is User => Boolean(user)).map((user) => [user.id, user]));

    res.json(
      result.map((message) =>
        toPublicMessage(
          message,
          message.senderUserId ? senderById.get(message.senderUserId) : undefined,
          clientById.get(message.clientId),
        ),
      ),
    );
  });

  app.post("/api/messages", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid message payload" });
    }
    if (!isAdmin(authUser) && parsed.data.clientId !== authUser.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const message = await storage.createMessage({
      clientId: parsed.data.clientId,
      senderUserId: authUser.id,
      text: parsed.data.text,
      sender: authUser.name,
      isClient: authUser.role === "Client",
      time: new Date().toISOString(),
    });
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
      const clientIds = Array.from(new Set(allMessages.map(m => m.clientId)));
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
    const parsed = markChatReadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid read payload" });
    }
    const clientId = parsed.data.clientId;
    const userId = authUser.id;
    if (!isAdmin(authUser) && clientId !== authUser.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const result = await storage.upsertChatReadStatus(userId, clientId, new Date().toISOString());
    res.json(result);
  });

  return httpServer;
}
