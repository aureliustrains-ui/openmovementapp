import type { NextFunction, Request, Response } from "express";
import type { User } from "@shared/schema";
import { storage } from "../storage";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: User;
  }
}

export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export async function attachAuthUser(req: Request, res: Response, next: NextFunction) {
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

export function isAdmin(user: User) {
  return user.role === "Admin";
}

export function requireUser(req: Request, res: Response): User | null {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return user;
}

export function requireAdmin(req: Request, res: Response): User | null {
  const user = requireUser(req, res);
  if (!user) {
    return null;
  }
  if (!isAdmin(user)) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  return user;
}
