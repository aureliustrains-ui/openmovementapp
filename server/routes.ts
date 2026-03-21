import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { hashPassword, verifyPassword } from "./auth";
import type {
  Phase,
  User,
  WeeklyCheckin,
  Session,
  ProgressReport,
  ProgressReportItem,
  InsertPhase,
} from "@shared/schema";
import { createUserAccount } from "./modules/users/users.service";
import {
  changeAuthenticatedUserPassword,
  loginWithEmailPassword,
  requireAuthenticatedUser,
} from "./modules/auth/auth.service";
import { updateMyProfile } from "./modules/profile/profile.service";
import {
  assertCoachCanManageSpecifics,
  mapWorkoutHistoryForCoach,
  saveClientSpecifics,
} from "./modules/clients/specifics.service";
import { AppError } from "./http/error-handler";
import {
  createMessageSchema,
  createClientVideoUploadSchema,
  createSessionCheckinSchema,
  createWeeklyCheckinSchema,
  createProgressReportSchema,
  submitProgressReportSchema,
  reviewProgressReportItemSchema,
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
import {
  createClientVideoUploadTarget,
  isClientOwnedObjectKey,
  resolveClientVideoPlaybackUrl,
} from "./media/client-video-storage";
import { logError, logInfo } from "./http/logger";

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
  status: z.enum(["Active", "Inactive"]).optional(),
  avatar: z.string().url().nullable().optional(),
});

const updateUserStatusSchema = z.object({
  status: z.enum(["Active", "Inactive"]),
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
  confirmPassword: z.string().min(1).max(128),
});

const updateClientSpecificsSchema = z.object({
  specifics: z.string().max(8000).nullable(),
});

const maxAvatarSizeBytes = 5 * 1024 * 1024;
const allowedAvatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const uploadRoot = path.resolve(process.cwd(), "uploads");
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
      const safeBase =
        sanitizeFilename(path.basename(file.originalname, ext)).slice(0, 64) || "avatar";
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

function getFirstToken(value: string | null | undefined): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "";
  const [first] = normalized.split(/\s+/);
  return first || "";
}

function getProfileFirstName(user: User | undefined): string {
  if (!user) return "";
  const fromProfile = typeof user.infos === "string" ? user.infos.trim() : "";
  if (fromProfile) return fromProfile;
  return getFirstToken(user.name);
}

function parseOptionalPhaseHomeIntroVideoUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new AppError("homeIntroVideoUrl must be a string", 400);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError("Invalid home intro video URL", 400);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new AppError("Invalid home intro video URL protocol", 400);
  }
  return parsed.toString();
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
  const profileSource = senderUser || (message.isClient ? clientUser : undefined) || undefined;
  const senderFirstName = getProfileFirstName(profileSource) || getFirstToken(message.sender);
  const senderName = senderFirstName || message.sender || "Coach";
  const senderAvatar = profileSource?.avatar || null;
  return {
    ...message,
    sender: senderName,
    senderName,
    senderAvatar,
    senderProfile: profileSource
      ? {
          id: profileSource.id,
          name: profileSource.name,
          firstName: getProfileFirstName(profileSource) || null,
          avatar: profileSource.avatar,
          bio: profileSource.bio,
          height: profileSource.height,
          weight: profileSource.weight,
        }
      : null,
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
  if (user.status !== "Active") {
    req.session.destroy(() => {
      res.status(403).json({ message: "Account is inactive" });
    });
    return;
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

async function archiveClientPhases(clientId: string) {
  const clientPhases = await storage.getPhasesByClient(clientId);
  await Promise.all(
    clientPhases
      .filter((phase) => phase.status !== "Archived")
      .map((phase) => storage.updatePhase(phase.id, { status: "Archived" })),
  );
}

async function deleteClientPhases(clientId: string) {
  const clientPhases = await storage.getPhasesByClient(clientId);
  await Promise.all(clientPhases.map((phase) => storage.deletePhase(phase.id)));
}

function getWeekCompletionForPhase(
  phase: Phase,
  phaseWeek: number,
): { scheduledCount: number; completedCount: number } {
  const scheduleEntries = (
    (phase.schedule as Array<{ week?: number; day?: string; slot?: string; sessionId?: string }>) ||
    []
  ).filter((entry) => entry.week === phaseWeek && typeof entry.sessionId === "string");

  if (scheduleEntries.length === 0) {
    return { scheduledCount: 0, completedCount: 0 };
  }

  const completed = new Set(
    ((phase.completedScheduleInstances as string[]) || []).filter(
      (entry) => typeof entry === "string",
    ),
  );
  const completedCount = scheduleEntries.filter((entry) => {
    const day = entry.day || "Monday";
    const slot = entry.slot || "AM";
    return completed.has(`w${phaseWeek}_${day}_${slot}_${entry.sessionId}`);
  }).length;

  return { scheduledCount: scheduleEntries.length, completedCount };
}

function hasWeeklyCheckinForPhaseWeek(
  weeklyCheckins: WeeklyCheckin[],
  phaseId: string,
  phaseWeekNumber: number,
): boolean {
  return weeklyCheckins.some(
    (entry) => entry.phaseId === phaseId && entry.phaseWeekNumber === phaseWeekNumber,
  );
}

function getCurrentPhaseWeekByProgress(phase: Phase, weeklyCheckins: WeeklyCheckin[]): number {
  const duration = Math.max(1, phase.durationWeeks || 1);
  for (let week = 1; week <= duration; week += 1) {
    const { scheduledCount, completedCount } = getWeekCompletionForPhase(phase, week);
    const sessionsDone = scheduledCount > 0 && completedCount >= scheduledCount;
    const isCompleted =
      sessionsDone && hasWeeklyCheckinForPhaseWeek(weeklyCheckins, phase.id, week);
    if (scheduledCount > 0 && !isCompleted) {
      return week;
    }
  }

  for (let week = 1; week <= duration; week += 1) {
    const { scheduledCount, completedCount } = getWeekCompletionForPhase(phase, week);
    const sessionsDone = scheduledCount > 0 && completedCount >= scheduledCount;
    const isCompleted =
      sessionsDone && hasWeeklyCheckinForPhaseWeek(weeklyCheckins, phase.id, week);
    if (!isCompleted) {
      return week;
    }
  }

  return duration;
}

type PhaseExerciseSnapshot = {
  exerciseId: string;
  exerciseName: string;
};

function getPhaseExerciseSnapshots(phaseSessions: Session[]): PhaseExerciseSnapshot[] {
  const seen = new Set<string>();
  const snapshots: PhaseExerciseSnapshot[] = [];
  for (const session of phaseSessions) {
    const sections = Array.isArray(session.sections) ? session.sections : [];
    for (const section of sections) {
      if (!section || typeof section !== "object") continue;
      const maybeExercises = (section as { exercises?: unknown }).exercises;
      const exercises = Array.isArray(maybeExercises) ? maybeExercises : [];
      for (const exercise of exercises) {
        if (!exercise || typeof exercise !== "object") continue;
        const exerciseId =
          typeof (exercise as { id?: unknown }).id === "string"
            ? String((exercise as { id: string }).id)
            : "";
        const exerciseName =
          typeof (exercise as { name?: unknown }).name === "string"
            ? String((exercise as { name: string }).name)
            : "";
        if (!exerciseId || !exerciseName || seen.has(exerciseId)) continue;
        seen.add(exerciseId);
        snapshots.push({ exerciseId, exerciseName });
      }
    }
  }
  return snapshots;
}

async function hydrateProgressReport(
  report: ProgressReport,
): Promise<
  ProgressReport & { items: Array<ProgressReportItem & { submissionPlaybackUrl: string | null }> }
> {
  const items = await storage.getProgressReportItems(report.id);
  const hydratedItems = await Promise.all(
    items.map(async (item) => {
      const hasUpload =
        typeof item.submissionObjectKey === "string" && item.submissionObjectKey.trim().length > 0;
      const submissionPlaybackUrl = hasUpload
        ? await resolveClientVideoPlaybackUrl(item.submissionObjectKey!)
        : item.submissionLink;
      return {
        ...item,
        submissionPlaybackUrl,
      };
    }),
  );
  return { ...report, items: hydratedItems };
}

type ProgressItemReviewStatus = "requested" | "submitted" | "approved" | "resubmission_requested";

function normalizeProgressItemReviewStatus(
  item: ProgressReportItem,
  reportStatus: string,
): ProgressItemReviewStatus {
  if (
    item.reviewStatus === "requested" ||
    item.reviewStatus === "submitted" ||
    item.reviewStatus === "approved" ||
    item.reviewStatus === "resubmission_requested"
  ) {
    return item.reviewStatus;
  }
  if (reportStatus === "approved" || reportStatus === "reviewed") return "approved";
  if (reportStatus === "resubmission_requested") return "resubmission_requested";
  const hasSubmission =
    (typeof item.submissionLink === "string" && item.submissionLink.trim().length > 0) ||
    (typeof item.submissionObjectKey === "string" && item.submissionObjectKey.trim().length > 0);
  if (reportStatus === "submitted" && hasSubmission) return "submitted";
  return "requested";
}

function deriveProgressReportStatusFromItems(items: Array<ProgressReportItem>): string {
  if (items.length === 0) return "requested";
  const normalized = items.map((item) => normalizeProgressItemReviewStatus(item, "requested"));
  if (normalized.some((status) => status === "resubmission_requested")) {
    return "resubmission_requested";
  }
  if (normalized.every((status) => status === "approved")) {
    return "approved";
  }
  if (normalized.some((status) => status === "submitted" || status === "approved")) {
    return "submitted";
  }
  return "requested";
}

function isProgressReportSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = String((error as { code?: unknown }).code || "");
  return code === "42P01" || code === "42703";
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

async function maybeBootstrapAdminUser(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || "";
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() || "";
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Admin";

  if (!email || !password) {
    logInfo(
      "bootstrap",
      "Skipping admin bootstrap: BOOTSTRAP_ADMIN_EMAIL or BOOTSTRAP_ADMIN_PASSWORD missing",
    );
    return;
  }

  if (password.length < 8) {
    logError("bootstrap", "Skipping admin bootstrap due to invalid password length");
    return;
  }

  try {
    const passwordHash = await hashPassword(password);
    const existing = await storage.getUserByEmail(email);

    if (existing) {
      await storage.updateUser(existing.id, {
        name,
        role: "Admin",
        status: "Active",
        passwordHash,
      });
      logInfo("bootstrap", `Updated existing admin user: ${email}`);
      return;
    }

    await createUserAccount(
      {
        name,
        email,
        password,
        role: "Admin",
        status: "Active",
        avatar: null,
      },
      {
        users: storage,
        hashPassword,
      },
    );
    logInfo("bootstrap", `Created admin user: ${email}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const pgCode =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code)
        : null;
    logError("bootstrap", "Failed to bootstrap admin user", { message });
    if (pgCode === "42P01") {
      logError(
        "bootstrap",
        "users table missing. Run migrations (npm run db:push) on DATABASE_URL.",
      );
    }
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await maybeBootstrapAdminUser();

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
      if (error instanceof AppError && error.code === "ACCOUNT_INACTIVE") {
        return res.status(403).json({ message: "Account is inactive" });
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
      if (error instanceof AppError && error.code === "ACCOUNT_INACTIVE") {
        req.session.destroy(() => {
          res.status(403).json({ message: "Account is inactive" });
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

  app.post("/api/account/change-password", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid change password payload" });
    }

    try {
      await changeAuthenticatedUserPassword(
        {
          userId: authUser.id,
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.newPassword,
          confirmPassword: parsed.data.confirmPassword,
        },
        {
          users: storage,
          verifyPassword,
          hashPassword,
        },
      );
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.status || 400).json({ message: error.message, code: error.code });
      }
      throw error;
    }

    res.status(204).send();
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
        const avatarPath =
          markerIndex >= 0
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

  app.post("/api/client-videos/upload-url", async (req, res, next) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    if (authUser.role !== "Client") {
      return res.status(403).json({ message: "Only client accounts can upload submission videos" });
    }

    const parsed = createClientVideoUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join("; ");
      return res.status(400).json({ message: details || "Invalid client video upload payload" });
    }

    try {
      const target = await createClientVideoUploadTarget({
        clientId: authUser.id,
        purpose: parsed.data.purpose,
        fileName: parsed.data.fileName,
        fileSize: parsed.data.fileSize,
        contentType: parsed.data.contentType,
      });
      res.json(target);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.status || 400).json({ message: error.message });
      }
      next(error);
    }
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

  app.patch("/api/users/:id/status", async (req, res) => {
    const authUser = requireAdmin(req, res);
    if (!authUser) return;

    const parsed = updateUserStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join("; ");
      return res.status(400).json({ message: details || "Invalid status payload" });
    }

    const target = await storage.getUser(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (target.role !== "Client") {
      return res
        .status(400)
        .json({ message: "Only client accounts can be activated or deactivated" });
    }
    if (target.status === "Removed") {
      return res
        .status(400)
        .json({ message: "Removed clients cannot be reactivated. Create a new client account." });
    }

    if (parsed.data.status === "Inactive") {
      await archiveClientPhases(target.id);
    }

    const updated = await storage.updateUser(target.id, { status: parsed.data.status });
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(toPublicUser(updated));
  });

  app.delete("/api/users/:id", async (req, res) => {
    const authUser = requireAdmin(req, res);
    if (!authUser) return;
    if (authUser.id === req.params.id) {
      return res.status(400).json({ message: "You cannot remove your own account" });
    }

    const target = await storage.getUser(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (target.role !== "Client") {
      return res.status(400).json({ message: "Only client accounts can be removed" });
    }

    await deleteClientPhases(target.id);

    const removedEmail = target.email.includes("#removed#")
      ? target.email
      : `${Date.now()}#removed#${target.email}`;
    const removedName = target.name.endsWith(" (Removed)")
      ? target.name
      : `${target.name} (Removed)`;

    const updated = await storage.updateUser(target.id, {
      status: "Removed",
      email: removedEmail,
      name: removedName,
      passwordHash: null,
      avatar: null,
    });
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ removed: true, user: toPublicUser(updated) });
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
    const payload = { ...(req.body || {}) } as Record<string, unknown>;
    const client = await storage.getUser(String(payload.clientId || ""));
    if (!client || client.role !== "Client") {
      return res.status(400).json({ message: "Client not found" });
    }
    if (client.status === "Removed") {
      return res.status(400).json({ message: "Cannot create phases for removed clients" });
    }
    const parsedHomeIntroVideoUrl = parseOptionalPhaseHomeIntroVideoUrl(payload.homeIntroVideoUrl);
    if (parsedHomeIntroVideoUrl !== undefined) {
      payload.homeIntroVideoUrl = parsedHomeIntroVideoUrl;
    }
    const phase = await storage.createPhase(payload as InsertPhase);
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

      const allowedClientKeys = ["completedScheduleInstances", "movementChecks"];
      const payloadKeys = Object.keys(req.body || {});
      const hasOnlyAllowedKeys = payloadKeys.every((key) => allowedClientKeys.includes(key));
      if (!hasOnlyAllowedKeys || payloadKeys.length === 0) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const nextClientPayload: Record<string, unknown> = {};

      if ("completedScheduleInstances" in (req.body || {})) {
        nextClientPayload.completedScheduleInstances = req.body.completedScheduleInstances;
      }

      if ("movementChecks" in (req.body || {})) {
        if (!Array.isArray(req.body?.movementChecks)) {
          return res.status(400).json({ message: "Movement checks payload must be an array" });
        }

        const existingChecks = Array.isArray(phaseForClient.movementChecks)
          ? (phaseForClient.movementChecks as Array<Record<string, unknown>>)
          : [];
        if (existingChecks.length === 0) {
          return res.status(400).json({ message: "This phase has no movement checks to submit" });
        }

        const incomingByExerciseId = new Map<
          string,
          {
            videoUrl: string | null;
            clientNote: string;
            videoSource: "link" | "upload" | null;
            videoObjectKey: string | null;
            videoMimeType: string | null;
            videoOriginalFilename: string | null;
          }
        >();
        for (const rawEntry of req.body.movementChecks as unknown[]) {
          if (!rawEntry || typeof rawEntry !== "object") {
            return res.status(400).json({ message: "Invalid movement check entry" });
          }
          const exerciseId =
            typeof (rawEntry as { exerciseId?: unknown }).exerciseId === "string"
              ? String((rawEntry as { exerciseId: string }).exerciseId)
              : "";
          if (!exerciseId) {
            return res.status(400).json({ message: "Movement check exerciseId is required" });
          }
          const videoUrlRaw = (rawEntry as { videoUrl?: unknown }).videoUrl;
          const videoUrl = typeof videoUrlRaw === "string" ? String(videoUrlRaw).trim() : "";
          const videoObjectKeyRaw = (rawEntry as { videoObjectKey?: unknown }).videoObjectKey;
          const videoObjectKey =
            typeof videoObjectKeyRaw === "string" ? String(videoObjectKeyRaw).trim() : "";
          const videoSourceRaw = (rawEntry as { videoSource?: unknown }).videoSource;
          const videoSource =
            videoSourceRaw === "link" || videoSourceRaw === "upload" ? videoSourceRaw : null;
          const videoMimeTypeRaw = (rawEntry as { videoMimeType?: unknown }).videoMimeType;
          const videoMimeType =
            typeof videoMimeTypeRaw === "string" ? String(videoMimeTypeRaw).trim() : "";
          const videoOriginalFilenameRaw = (rawEntry as { videoOriginalFilename?: unknown })
            .videoOriginalFilename;
          const videoOriginalFilename =
            typeof videoOriginalFilenameRaw === "string"
              ? String(videoOriginalFilenameRaw).trim()
              : "";
          const clientNote =
            typeof (rawEntry as { clientNote?: unknown }).clientNote === "string"
              ? String((rawEntry as { clientNote: string }).clientNote).trim()
              : "";

          if (videoSource === "link" && !videoUrl) {
            return res
              .status(400)
              .json({ message: `Movement check link is required for ${exerciseId}` });
          }
          if (videoSource === "upload" && !videoObjectKey) {
            return res
              .status(400)
              .json({ message: `Movement check upload key is required for ${exerciseId}` });
          }
          if (videoUrl && videoObjectKey) {
            return res.status(400).json({
              message: `Movement check cannot include both link and upload for ${exerciseId}`,
            });
          }
          if (videoObjectKey && !isClientOwnedObjectKey(authUser.id, videoObjectKey)) {
            return res.status(403).json({ message: "Invalid movement check upload key ownership" });
          }
          if (videoUrl) {
            let parsedUrl: URL;
            try {
              parsedUrl = new URL(videoUrl);
            } catch {
              return res
                .status(400)
                .json({ message: `Invalid movement check video URL for ${exerciseId}` });
            }
            if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
              return res
                .status(400)
                .json({ message: `Invalid movement check video URL protocol for ${exerciseId}` });
            }
          }

          incomingByExerciseId.set(exerciseId, {
            videoUrl: videoUrl || null,
            clientNote,
            videoSource,
            videoObjectKey: videoObjectKey || null,
            videoMimeType: videoMimeType || null,
            videoOriginalFilename: videoOriginalFilename || null,
          });
        }

        const validExerciseIds = new Set(
          existingChecks
            .map((entry) => (typeof entry.exerciseId === "string" ? String(entry.exerciseId) : ""))
            .filter(Boolean),
        );
        let unknownExerciseId: string | null = null;
        incomingByExerciseId.forEach((_value, exerciseId) => {
          if (!validExerciseIds.has(exerciseId) && !unknownExerciseId) {
            unknownExerciseId = exerciseId;
          }
        });
        if (unknownExerciseId) {
          return res
            .status(400)
            .json({ message: `Unknown movement check exercise: ${unknownExerciseId}` });
        }

        const submittedAt = new Date().toISOString();
        const mergedChecks = existingChecks.map((entry) => {
          const exerciseId = typeof entry.exerciseId === "string" ? String(entry.exerciseId) : "";
          if (!exerciseId) return entry;
          const incoming = incomingByExerciseId.get(exerciseId);
          const hasIncomingVideo = Boolean(incoming?.videoUrl || incoming?.videoObjectKey);
          if (!incoming || !hasIncomingVideo) return entry;

          if (String(entry.status || "") === "Approved") {
            return entry;
          }

          return {
            ...entry,
            status: "Pending",
            videoSource: incoming.videoObjectKey ? "upload" : "link",
            videoUrl: incoming.videoObjectKey ? null : incoming.videoUrl,
            videoObjectKey: incoming.videoObjectKey,
            videoMimeType: incoming.videoObjectKey ? incoming.videoMimeType : null,
            videoOriginalFilename: incoming.videoObjectKey ? incoming.videoOriginalFilename : null,
            clientNote: incoming.clientNote,
            submittedAt,
          };
        });

        nextClientPayload.movementChecks = mergedChecks;
      }

      updatePayload = nextClientPayload;
    } else {
      const parsedHomeIntroVideoUrl = parseOptionalPhaseHomeIntroVideoUrl(
        (req.body || {}).homeIntroVideoUrl,
      );
      if (parsedHomeIntroVideoUrl !== undefined) {
        updatePayload = {
          ...(req.body || {}),
          homeIntroVideoUrl: parsedHomeIntroVideoUrl,
        };
      }
    }

    const requestedStatus =
      typeof (req.body as { status?: unknown } | undefined)?.status === "string"
        ? String((req.body as { status: string }).status)
        : null;
    try {
      const phase = await storage.updatePhase(req.params.id, updatePayload);
      if (!phase) return res.status(404).json({ message: "Phase not found" });
      res.json(phase);
    } catch (error) {
      logError("phase-update", "Failed to update phase", {
        phaseId: req.params.id,
        actorUserId: authUser.id,
        actorRole: authUser.role,
        requestedStatus,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
    let result = phaseId ? await storage.getSessionsByPhase(phaseId) : await storage.getSessions();

    if (!isAdmin(authUser)) {
      const allowedPhaseIds = new Set(
        (await storage.getPhasesByClient(authUser.id)).map((p) => p.id),
      );
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
        rpeOverall: parsed.data.sessionRpe,
        sleepLastNight: parsed.data.sleepLastNight,
        feltOff: parsed.data.feltOff ?? false,
        feltOffNote: parsed.data.feltOff ? parsed.data.whatFeltOff?.trim() || null : null,
        optionalNote: parsed.data.optionalNote?.trim() || null,
      });
      res.status(201).json(created);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: unknown }).code === "42P01"
      ) {
        return res
          .status(500)
          .json({ message: "Database not ready for check-ins. Run npm run db:push." });
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
    const weeklyCheckins = await storage.getWeeklyCheckinsByClient(authUser.id);

    const targetPhase = parsed.data.phaseId
      ? phases.find((phase) => phase.id === parsed.data.phaseId)
      : getActivePhase(phases);
    if (!targetPhase) {
      return res.status(400).json({ message: "No active phase found for weekly check-in" });
    }
    const computedPhaseWeekNumber = getCurrentPhaseWeekByProgress(targetPhase, weeklyCheckins);
    const requestedPhaseWeekNumber = parsed.data.phaseWeekNumber;
    const phaseWeekNumber = requestedPhaseWeekNumber ?? computedPhaseWeekNumber;
    if (
      requestedPhaseWeekNumber !== undefined &&
      requestedPhaseWeekNumber !== computedPhaseWeekNumber
    ) {
      return res.status(409).json({ message: "Weekly check-in is not due for this training week" });
    }
    const { scheduledCount, completedCount } = getWeekCompletionForPhase(
      targetPhase,
      phaseWeekNumber,
    );
    const sessionsDone = scheduledCount > 0 && completedCount >= scheduledCount;
    if (!sessionsDone) {
      return res.status(409).json({ message: "Weekly check-in is not due for this training week" });
    }

    try {
      await ensureWeeklyCheckinNotSubmitted(authUser.id, targetPhase.id, phaseWeekNumber, {
        getWeeklyCheckinByClientAndPhaseWeek:
          storage.getWeeklyCheckinByClientAndPhaseWeek.bind(storage),
      });
    } catch (error) {
      if (error instanceof AppError && error.code === "WEEKLY_CHECKIN_EXISTS") {
        return res
          .status(409)
          .json({ message: "Weekly check-in already submitted for this training week" });
      }
      throw error;
    }

    try {
      const created = await storage.createWeeklyCheckin(
        normalizeWeeklyCheckinInput(
          parsed.data,
          authUser.id,
          targetPhase.id,
          phaseWeekNumber,
          weekStartDate,
        ),
      );
      res.status(201).json(created);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: unknown }).code === "23505"
      ) {
        return res
          .status(409)
          .json({ message: "Weekly check-in already submitted for this training week" });
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
    const [phases, weeklyCheckins] = await Promise.all([
      storage.getPhasesByClient(authUser.id),
      storage.getWeeklyCheckinsByClient(authUser.id),
    ]);
    const activePhase = getActivePhase(phases);
    const phaseWeekNumber = activePhase
      ? getCurrentPhaseWeekByProgress(activePhase, weeklyCheckins)
      : null;

    let existing;
    if (activePhase && phaseWeekNumber !== null) {
      existing = await storage.getWeeklyCheckinByClientAndPhaseWeek(
        authUser.id,
        activePhase.id,
        phaseWeekNumber,
      );
    }

    let due = false;
    if (!existing && activePhase && phaseWeekNumber !== null) {
      const { scheduledCount, completedCount } = getWeekCompletionForPhase(
        activePhase,
        phaseWeekNumber,
      );
      due = scheduledCount > 0 && completedCount >= scheduledCount;
    }
    const weekState = existing ? "completed" : due ? "ready_for_checkin" : "current";

    res.json({
      phaseId: activePhase?.id || null,
      phaseWeekNumber,
      weekStartDate,
      due,
      weekState,
      current: existing || null,
    });
  });

  app.get("/api/clients/:clientId/progress-reports", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const client = await storage.getUser(req.params.clientId);
      if (!client || client.role !== "Client") {
        return res.status(404).json({ message: "Client not found" });
      }
      const reports = await storage.getProgressReportsByClient(req.params.clientId);
      reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const hydrated = await Promise.all(reports.map((report) => hydrateProgressReport(report)));
      res.json(hydrated);
    } catch (error) {
      if (isProgressReportSchemaError(error)) {
        return res
          .status(500)
          .json({ message: "Database not ready for progress reports. Run npm run db:push." });
      }
      throw error;
    }
  });

  app.get("/api/clients/:clientId/movement-checks/grouped", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const client = await storage.getUser(req.params.clientId);
    if (!client || client.role !== "Client") {
      return res.status(404).json({ message: "Client not found" });
    }

    const clientPhases = await storage.getPhasesByClient(req.params.clientId);
    const statusPriority: Record<string, number> = {
      "Waiting for Movement Check": 0,
      Active: 1,
      Draft: 2,
      Completed: 3,
    };
    const orderedPhases = [...clientPhases].sort((a, b) => {
      const aPriority = statusPriority[a.status] ?? 99;
      const bPriority = statusPriority[b.status] ?? 99;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.name.localeCompare(b.name);
    });

    const groups = (
      await Promise.all(
        orderedPhases.map(async (phase) => {
          let checksSource: unknown = phase.movementChecks;
          if (typeof checksSource === "string") {
            try {
              checksSource = JSON.parse(checksSource);
            } catch {
              checksSource = [];
            }
          }
          const checks = Array.isArray(checksSource) ? checksSource : [];
          const items = (
            await Promise.all(
              checks
                .filter((entry) => entry && typeof entry === "object")
                .map(async (entry) => {
                  const rawStatus =
                    typeof (entry as { status?: unknown }).status === "string"
                      ? String((entry as { status: string }).status)
                      : "Not Submitted";
                  const status =
                    rawStatus === "Approved"
                      ? "reviewed"
                      : rawStatus === "Pending"
                        ? "submitted"
                        : "requested";
                  const linkUrl =
                    typeof (entry as { videoUrl?: unknown }).videoUrl === "string"
                      ? String((entry as { videoUrl: string }).videoUrl)
                      : null;
                  const objectKey =
                    typeof (entry as { videoObjectKey?: unknown }).videoObjectKey === "string"
                      ? String((entry as { videoObjectKey: string }).videoObjectKey).trim()
                      : "";
                  const playbackUrl = objectKey
                    ? await resolveClientVideoPlaybackUrl(objectKey)
                    : linkUrl;
                  return {
                    exerciseId:
                      typeof (entry as { exerciseId?: unknown }).exerciseId === "string"
                        ? String((entry as { exerciseId: string }).exerciseId)
                        : "",
                    exerciseName:
                      typeof (entry as { name?: unknown }).name === "string"
                        ? String((entry as { name: string }).name)
                        : "Exercise",
                    rawStatus,
                    status,
                    videoUrl: playbackUrl,
                    videoSource:
                      typeof (entry as { videoSource?: unknown }).videoSource === "string"
                        ? String((entry as { videoSource: string }).videoSource)
                        : objectKey
                          ? "upload"
                          : "link",
                    videoObjectKey: objectKey || null,
                    clientNote:
                      typeof (entry as { clientNote?: unknown }).clientNote === "string"
                        ? String((entry as { clientNote: string }).clientNote)
                        : null,
                    approvedNote:
                      typeof (entry as { approvedNote?: unknown }).approvedNote === "string"
                        ? String((entry as { approvedNote: string }).approvedNote)
                        : null,
                    resubmitFeedback:
                      typeof (entry as { resubmitFeedback?: unknown }).resubmitFeedback === "string"
                        ? String((entry as { resubmitFeedback: string }).resubmitFeedback)
                        : null,
                    submittedAt:
                      typeof (entry as { submittedAt?: unknown }).submittedAt === "string"
                        ? String((entry as { submittedAt: string }).submittedAt)
                        : null,
                    decidedAt:
                      typeof (entry as { decidedAt?: unknown }).decidedAt === "string"
                        ? String((entry as { decidedAt: string }).decidedAt)
                        : null,
                  };
                }),
            )
          ).sort(
            (
              a: { decidedAt: string | null; submittedAt: string | null },
              b: { decidedAt: string | null; submittedAt: string | null },
            ) => {
              const aTime = a.decidedAt || a.submittedAt || "";
              const bTime = b.decidedAt || b.submittedAt || "";
              return bTime.localeCompare(aTime);
            },
          );
          return {
            phaseId: phase.id,
            phaseName: phase.name,
            phaseStatus: phase.status,
            items,
          };
        }),
      )
    ).filter((group) => group.items.length > 0);

    res.json(groups);
  });

  app.get("/api/clients/:clientId/progress-reports/grouped", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const client = await storage.getUser(req.params.clientId);
      if (!client || client.role !== "Client") {
        return res.status(404).json({ message: "Client not found" });
      }

      const [clientPhases, reports] = await Promise.all([
        storage.getPhasesByClient(req.params.clientId),
        storage.getProgressReportsByClient(req.params.clientId),
      ]);
      const phaseNameById = new Map(clientPhases.map((phase) => [phase.id, phase.name]));

      const groupsMap = new Map<
        string,
        {
          phaseId: string;
          phaseName: string;
          items: Array<{
            itemId: string;
            reportId: string;
            reportStatus: string;
            createdAt: string;
            submittedAt: string | null;
            exerciseId: string;
            exerciseName: string;
            submissionSource: string | null;
            submissionObjectKey: string | null;
            submissionLink: string | null;
            submissionPlaybackUrl: string | null;
            submissionNote: string | null;
            reviewStatus: ProgressItemReviewStatus;
            feedbackNote: string | null;
            reviewedAt: string | null;
          }>;
        }
      >();

      for (const report of reports) {
        const group = groupsMap.get(report.phaseId) || {
          phaseId: report.phaseId,
          phaseName: phaseNameById.get(report.phaseId) || "Phase",
          items: [],
        };
        const items = await storage.getProgressReportItems(report.id);
        for (const item of items) {
          const hasObjectKey =
            typeof item.submissionObjectKey === "string" &&
            item.submissionObjectKey.trim().length > 0;
          const playbackUrl = hasObjectKey
            ? await resolveClientVideoPlaybackUrl(item.submissionObjectKey!)
            : item.submissionLink;
          group.items.push({
            itemId: item.id,
            reportId: report.id,
            reportStatus: report.status,
            createdAt: report.createdAt,
            submittedAt: report.submittedAt,
            exerciseId: item.exerciseId,
            exerciseName: item.exerciseName,
            submissionSource: item.submissionSource || (hasObjectKey ? "upload" : "link"),
            submissionObjectKey: item.submissionObjectKey,
            submissionLink: item.submissionLink,
            submissionPlaybackUrl: playbackUrl,
            submissionNote: item.submissionNote,
            reviewStatus: normalizeProgressItemReviewStatus(item, report.status),
            feedbackNote: item.feedbackNote,
            reviewedAt: item.reviewedAt,
          });
        }
        groupsMap.set(report.phaseId, group);
      }

      const groups = Array.from(groupsMap.values()).filter((group) => group.items.length > 0);
      res.json(groups);
    } catch (error) {
      if (isProgressReportSchemaError(error)) {
        return res
          .status(500)
          .json({ message: "Database not ready for progress reports. Run npm run db:push." });
      }
      throw error;
    }
  });

  app.post("/api/clients/:clientId/progress-reports", async (req, res) => {
    const authUser = requireAdmin(req, res);
    if (!authUser) return;
    const parsed = createProgressReportSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join("; ");
      return res.status(400).json({ message: details || "Invalid progress report payload" });
    }

    try {
      const client = await storage.getUser(req.params.clientId);
      if (!client || client.role !== "Client") {
        return res.status(404).json({ message: "Client not found" });
      }

      const clientPhases = await storage.getPhasesByClient(req.params.clientId);
      const activePhase = parsed.data.phaseId
        ? clientPhases.find(
            (phase) => phase.id === parsed.data.phaseId && phase.status === "Active",
          )
        : clientPhases.find((phase) => phase.status === "Active");
      if (!activePhase) {
        return res.status(400).json({ message: "No active phase found for this client" });
      }

      const phaseSessions = await storage.getSessionsByPhase(activePhase.id);
      const availableExercises = getPhaseExerciseSnapshots(phaseSessions);
      if (availableExercises.length === 0) {
        return res.status(400).json({ message: "Active phase has no exercises to request" });
      }

      const availableById = new Map(
        availableExercises.map((exercise) => [exercise.exerciseId, exercise]),
      );
      const selectedExerciseIds = Array.from(new Set(parsed.data.exerciseIds));
      const invalidExerciseId = selectedExerciseIds.find(
        (exerciseId) => !availableById.has(exerciseId),
      );
      if (invalidExerciseId) {
        return res
          .status(400)
          .json({ message: `Exercise is not part of the active phase: ${invalidExerciseId}` });
      }

      const created = await storage.createProgressReport({
        clientId: req.params.clientId,
        phaseId: activePhase.id,
        status: "requested",
        createdBy: authUser.id,
        createdAt: new Date().toISOString(),
        submittedAt: null,
      });

      await Promise.all(
        selectedExerciseIds.map((exerciseId) =>
          storage.createProgressReportItem({
            progressReportId: created.id,
            exerciseId,
            exerciseName: availableById.get(exerciseId)?.exerciseName || "Unknown exercise",
            submissionSource: null,
            submissionObjectKey: null,
            submissionMimeType: null,
            submissionOriginalFilename: null,
            submissionLink: null,
            submissionNote: null,
            reviewStatus: "requested",
            feedbackNote: null,
            reviewedAt: null,
          }),
        ),
      );

      const hydrated = await hydrateProgressReport(created);
      res.status(201).json(hydrated);
    } catch (error) {
      if (isProgressReportSchemaError(error)) {
        return res
          .status(500)
          .json({ message: "Database not ready for progress reports. Run npm run db:push." });
      }
      throw error;
    }
  });

  app.get("/api/progress-reports/me/open", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    if (authUser.role !== "Client") {
      return res.status(403).json({ message: "Only client accounts can read progress reports" });
    }
    try {
      const reports = await storage.getProgressReportsByClient(authUser.id);
      const requested = reports
        .filter(
          (report) => report.status === "requested" || report.status === "resubmission_requested",
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const hydrated = await Promise.all(requested.map((report) => hydrateProgressReport(report)));
      res.json(hydrated);
    } catch (error) {
      if (isProgressReportSchemaError(error)) {
        return res
          .status(500)
          .json({ message: "Database not ready for progress reports. Run npm run db:push." });
      }
      throw error;
    }
  });

  app.get("/api/progress-reports/me/active-phase", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    if (authUser.role !== "Client") {
      return res.status(403).json({ message: "Only client accounts can read progress reports" });
    }
    try {
      const [phases, reports] = await Promise.all([
        storage.getPhasesByClient(authUser.id),
        storage.getProgressReportsByClient(authUser.id),
      ]);
      const activePhase = getActivePhase(phases);
      if (!activePhase) {
        return res.json([]);
      }
      const forActivePhase = reports
        .filter((report) => report.phaseId === activePhase.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const hydrated = await Promise.all(
        forActivePhase.map((report) => hydrateProgressReport(report)),
      );
      res.json(hydrated);
    } catch (error) {
      if (isProgressReportSchemaError(error)) {
        return res
          .status(500)
          .json({ message: "Database not ready for progress reports. Run npm run db:push." });
      }
      throw error;
    }
  });

  app.get("/api/progress-reports/:id", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    try {
      const report = await storage.getProgressReport(req.params.id);
      if (!report) return res.status(404).json({ message: "Progress report not found" });
      if (!isAdmin(authUser) && report.clientId !== authUser.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const hydrated = await hydrateProgressReport(report);
      res.json(hydrated);
    } catch (error) {
      if (isProgressReportSchemaError(error)) {
        return res
          .status(500)
          .json({ message: "Database not ready for progress reports. Run npm run db:push." });
      }
      throw error;
    }
  });

  app.patch("/api/progress-reports/:id/submit", async (req, res) => {
    const authUser = requireUser(req, res);
    if (!authUser) return;
    if (authUser.role !== "Client") {
      return res.status(403).json({ message: "Only client accounts can submit progress reports" });
    }
    let report;
    try {
      report = await storage.getProgressReport(req.params.id);
    } catch (error) {
      if (isProgressReportSchemaError(error)) {
        return res
          .status(500)
          .json({ message: "Database not ready for progress reports. Run npm run db:push." });
      }
      throw error;
    }
    if (!report) return res.status(404).json({ message: "Progress report not found" });
    if (report.clientId !== authUser.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (report.status !== "requested" && report.status !== "resubmission_requested") {
      return res.status(409).json({ message: "Progress report already submitted" });
    }

    const parsed = submitProgressReportSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join("; ");
      return res
        .status(400)
        .json({ message: details || "Invalid progress report submission payload" });
    }

    try {
      const existingItems = await storage.getProgressReportItems(report.id);
      const existingById = new Map(existingItems.map((item) => [item.id, item]));

      if (parsed.data.items.length !== existingItems.length) {
        return res.status(400).json({ message: "Submission must include all requested exercises" });
      }

      const nowIso = new Date().toISOString();
      for (const itemSubmission of parsed.data.items) {
        const existing = existingById.get(itemSubmission.itemId);
        if (!existing) {
          return res
            .status(400)
            .json({ message: `Unknown progress report item: ${itemSubmission.itemId}` });
        }
        const submissionLink =
          typeof itemSubmission.submissionLink === "string"
            ? itemSubmission.submissionLink.trim()
            : "";
        const submissionObjectKey =
          typeof itemSubmission.submissionObjectKey === "string"
            ? itemSubmission.submissionObjectKey.trim()
            : "";
        if (!submissionLink && !submissionObjectKey) {
          return res
            .status(400)
            .json({ message: `Missing submission video for item: ${itemSubmission.itemId}` });
        }
        if (submissionLink && submissionObjectKey) {
          return res.status(400).json({
            message: `Submission cannot include both link and upload for item: ${itemSubmission.itemId}`,
          });
        }
        if (submissionLink) {
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(submissionLink);
          } catch {
            return res
              .status(400)
              .json({ message: `Invalid submissionLink for item: ${itemSubmission.itemId}` });
          }
          if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
            return res.status(400).json({
              message: `Invalid submissionLink protocol for item: ${itemSubmission.itemId}`,
            });
          }
        }
        if (submissionObjectKey && !isClientOwnedObjectKey(authUser.id, submissionObjectKey)) {
          return res.status(403).json({ message: "Invalid upload key ownership" });
        }
        if (itemSubmission.submissionSource === "link" && !submissionLink) {
          return res
            .status(400)
            .json({ message: `submissionLink is required for item: ${itemSubmission.itemId}` });
        }
        if (itemSubmission.submissionSource === "upload" && !submissionObjectKey) {
          return res.status(400).json({
            message: `submissionObjectKey is required for item: ${itemSubmission.itemId}`,
          });
        }

        await storage.updateProgressReportItem(itemSubmission.itemId, {
          submissionSource:
            itemSubmission.submissionSource || (submissionObjectKey ? "upload" : "link"),
          submissionObjectKey: submissionObjectKey || null,
          submissionMimeType: submissionObjectKey
            ? itemSubmission.submissionMimeType?.trim() || null
            : null,
          submissionOriginalFilename: submissionObjectKey
            ? itemSubmission.submissionOriginalFilename?.trim() || null
            : null,
          submissionLink: submissionLink || null,
          submissionNote: itemSubmission.submissionNote?.trim() || null,
          reviewStatus: "submitted",
          feedbackNote: null,
          reviewedAt: null,
        });
      }

      const updated = await storage.updateProgressReport(report.id, {
        status: "submitted",
        submittedAt: report.submittedAt || nowIso,
      });
      if (!updated) return res.status(404).json({ message: "Progress report not found" });
      const hydrated = await hydrateProgressReport(updated);
      res.json(hydrated);
    } catch (error) {
      if (isProgressReportSchemaError(error)) {
        return res
          .status(500)
          .json({ message: "Database not ready for progress reports. Run npm run db:push." });
      }
      throw error;
    }
  });

  app.patch("/api/progress-reports/:id/items/:itemId/review", async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const parsed = reviewProgressReportItemSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join("; ");
      return res.status(400).json({ message: details || "Invalid progress report review payload" });
    }

    try {
      const report = await storage.getProgressReport(req.params.id);
      if (!report) return res.status(404).json({ message: "Progress report not found" });

      const items = await storage.getProgressReportItems(report.id);
      const target = items.find((item) => item.id === req.params.itemId);
      if (!target) return res.status(404).json({ message: "Progress report item not found" });
      const hasSubmission =
        (typeof target.submissionLink === "string" && target.submissionLink.trim().length > 0) ||
        (typeof target.submissionObjectKey === "string" &&
          target.submissionObjectKey.trim().length > 0);
      if (!hasSubmission) {
        return res
          .status(409)
          .json({ message: "Cannot review item before client submits a video" });
      }

      const nowIso = new Date().toISOString();
      const feedback = parsed.data.feedbackNote?.trim() || null;
      const reviewStatus: ProgressItemReviewStatus =
        parsed.data.decision === "approve" ? "approved" : "resubmission_requested";

      await storage.updateProgressReportItem(target.id, {
        reviewStatus,
        feedbackNote: feedback,
        reviewedAt: nowIso,
      });

      const refreshedItems = await storage.getProgressReportItems(report.id);
      const nextReportStatus = deriveProgressReportStatusFromItems(refreshedItems);
      const updatedReport = await storage.updateProgressReport(report.id, {
        status: nextReportStatus,
        submittedAt: nextReportStatus === "requested" ? null : report.submittedAt || nowIso,
      });
      if (!updatedReport) return res.status(404).json({ message: "Progress report not found" });
      const hydrated = await hydrateProgressReport(updatedReport);
      res.json(hydrated);
    } catch (error) {
      if (isProgressReportSchemaError(error)) {
        return res
          .status(500)
          .json({ message: "Database not ready for progress reports. Run npm run db:push." });
      }
      throw error;
    }
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
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .slice(0, 6);
    const avg = (values: number[]) =>
      values.length > 0
        ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
        : null;

    res.json({
      avgWeeklyRecovery: avg(lastWeekly.map((entry) => entry.sleepWeek)),
      avgWeeklyStress: avg(lastWeekly.map((entry) => entry.energyWeek)),
      avgSessionRpe: avg(sessionCheckins.map((entry) => entry.rpeOverall)),
      avgSessionSleepLastNight: avg(
        sessionCheckins
          .map((entry) => entry.sleepLastNight)
          .filter((value): value is number => typeof value === "number"),
      ),
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
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

    res.json({
      rangeDays: rangeDays ?? "all",
      sessions: sessionCheckins.map((entry) => ({
        id: entry.id,
        date: entry.submittedAt,
        sessionId: entry.sessionId,
        sessionName: sessionNameById.get(entry.sessionId) || "Session",
        rpeOverall: entry.rpeOverall,
        sleepLastNight: entry.sleepLastNight ?? null,
        feltOff: entry.feltOff,
        whatFeltOff: entry.feltOffNote || null,
        optionalNote: entry.optionalNote || null,
      })),
      weeks: weeklyCheckins.map((entry) => ({
        id: entry.id,
        phaseId: entry.phaseId || null,
        phaseWeekNumber: entry.phaseWeekNumber ?? null,
        weekStartDate: entry.weekStartDate,
        submittedAt: entry.submittedAt,
        recoveryThisTrainingWeek: entry.sleepWeek,
        stressOutsideTrainingThisWeek: entry.energyWeek,
        injuryAffectedTraining: entry.injuryAffectedTraining,
        injuryImpact: entry.injuryImpact,
        optionalNote: entry.coachNoteFromClient || null,
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
        sessionRpe: entry.rpeOverall,
        sleepLastNight: entry.sleepLastNight ?? null,
        whatFeltOff: entry.feltOffNote || null,
        optionalNote: entry.optionalNote || null,
        sessionName: sessionNameById.get(entry.sessionId) || "Session",
      }));

    const recentWeeks = [...weeklyCheckins]
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .slice(0, limit)
      .map((entry) => ({
        ...entry,
        recoveryThisTrainingWeek: entry.sleepWeek,
        stressOutsideTrainingThisWeek: entry.energyWeek,
        optionalNote: entry.coachNoteFromClient || null,
      }));

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
      new Set(
        result.map((message) => message.senderUserId).filter((id): id is string => Boolean(id)),
      ),
    );
    const [clientUsers, senderUsers] = await Promise.all([
      Promise.all(clientIds.map((id) => storage.getUser(id))),
      Promise.all(senderIds.map((id) => storage.getUser(id))),
    ]);

    const clientById = new Map(
      clientUsers.filter((user): user is User => Boolean(user)).map((user) => [user.id, user]),
    );
    const senderById = new Map(
      senderUsers.filter((user): user is User => Boolean(user)).map((user) => [user.id, user]),
    );

    const hasLegacyCoachMessages = result.some(
      (message) =>
        !message.isClient && (!message.senderUserId || !senderById.has(message.senderUserId)),
    );
    let soleAdminUser: User | undefined;
    const adminByAlias = new Map<string, User>();
    if (hasLegacyCoachMessages) {
      const allUsers = await storage.getUsers();
      const adminUsers = allUsers.filter((user) => user.role === "Admin");
      if (adminUsers.length === 1) {
        [soleAdminUser] = adminUsers;
      }
      for (const admin of adminUsers) {
        const aliases = [admin.name, admin.infos]
          .flatMap((value) => {
            const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
            if (!normalized) return [];
            const tokens = normalized.split(/[\s,]+/).filter(Boolean);
            return [normalized, ...tokens];
          })
          .filter(Boolean);
        for (const alias of aliases) {
          if (!adminByAlias.has(alias)) {
            adminByAlias.set(alias, admin);
          }
        }
      }
    }

    const resolveMessageSender = (message: (typeof result)[number]): User | undefined => {
      if (message.senderUserId) {
        const matchedSender = senderById.get(message.senderUserId);
        if (matchedSender) {
          return matchedSender;
        }
      }
      if (message.isClient) {
        return undefined;
      }
      const normalizedSender =
        typeof message.sender === "string" ? message.sender.trim().toLowerCase() : "";
      return (normalizedSender ? adminByAlias.get(normalizedSender) : undefined) || soleAdminUser;
    };

    res.json(
      result.map((message) =>
        toPublicMessage(message, resolveMessageSender(message), clientById.get(message.clientId)),
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
      const clientMessages = allMessages.filter((m) => m.clientId === userId && !m.isClient);
      const readStatus = readStatuses.find((s) => s.clientId === userId);
      const lastReadAt = readStatus?.lastReadAt || "1970-01-01T00:00:00.000Z";
      const unread = clientMessages.filter((m) => m.time > lastReadAt).length;
      res.json({ total: unread, conversations: [{ clientId: userId, unread }] });
    } else {
      const clientIds = Array.from(new Set(allMessages.map((m) => m.clientId)));
      let total = 0;
      const conversations: { clientId: string; unread: number }[] = [];
      for (const cid of clientIds) {
        const clientMsgs = allMessages.filter((m) => m.clientId === cid && m.isClient);
        const readStatus = readStatuses.find((s) => s.clientId === cid);
        const lastReadAt = readStatus?.lastReadAt || "1970-01-01T00:00:00.000Z";
        const unread = clientMsgs.filter((m) => m.time > lastReadAt).length;
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
