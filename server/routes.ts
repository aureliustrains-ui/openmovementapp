import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/users", async (_req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  app.post("/api/users", async (req, res) => {
    const user = await storage.createUser(req.body);
    res.status(201).json(user);
  });

  app.get("/api/phases", async (req, res) => {
    const clientId = req.query.clientId as string | undefined;
    const result = clientId
      ? await storage.getPhasesByClient(clientId)
      : await storage.getPhases();
    res.json(result);
  });

  app.get("/api/phases/:id", async (req, res) => {
    const phase = await storage.getPhase(req.params.id);
    if (!phase) return res.status(404).json({ message: "Phase not found" });
    res.json(phase);
  });

  app.post("/api/phases", async (req, res) => {
    const phase = await storage.createPhase(req.body);
    res.status(201).json(phase);
  });

  app.patch("/api/phases/:id", async (req, res) => {
    const phase = await storage.updatePhase(req.params.id, req.body);
    if (!phase) return res.status(404).json({ message: "Phase not found" });
    res.json(phase);
  });

  app.delete("/api/phases/:id", async (req, res) => {
    const deleted = await storage.deletePhase(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Phase not found" });
    res.json({ success: true });
  });

  app.get("/api/sessions", async (req, res) => {
    const phaseId = req.query.phaseId as string | undefined;
    const result = phaseId
      ? await storage.getSessionsByPhase(phaseId)
      : await storage.getSessions();
    res.json(result);
  });

  app.get("/api/sessions/:id", async (req, res) => {
    const session = await storage.getSession(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  app.post("/api/sessions", async (req, res) => {
    const session = await storage.createSession(req.body);
    res.status(201).json(session);
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    const session = await storage.updateSession(req.params.id, req.body);
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    const deleted = await storage.deleteSession(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Session not found" });
    res.json({ success: true });
  });

  app.get("/api/exercise-templates", async (_req, res) => {
    const templates = await storage.getExerciseTemplates();
    res.json(templates);
  });

  app.post("/api/exercise-templates", async (req, res) => {
    const template = await storage.createExerciseTemplate(req.body);
    res.status(201).json(template);
  });

  app.patch("/api/exercise-templates/:id", async (req, res) => {
    const template = await storage.updateExerciseTemplate(req.params.id, req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/exercise-templates/:id", async (req, res) => {
    const deleted = await storage.deleteExerciseTemplate(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Template not found" });
    res.json({ success: true });
  });

  app.get("/api/section-templates", async (_req, res) => {
    const templates = await storage.getSectionTemplates();
    res.json(templates);
  });

  app.post("/api/section-templates", async (req, res) => {
    const template = await storage.createSectionTemplate(req.body);
    res.status(201).json(template);
  });

  app.patch("/api/section-templates/:id", async (req, res) => {
    const template = await storage.updateSectionTemplate(req.params.id, req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/section-templates/:id", async (req, res) => {
    const deleted = await storage.deleteSectionTemplate(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Template not found" });
    res.json({ success: true });
  });

  app.get("/api/session-templates", async (_req, res) => {
    const templates = await storage.getSessionTemplates();
    res.json(templates);
  });

  app.post("/api/session-templates", async (req, res) => {
    const template = await storage.createSessionTemplate(req.body);
    res.status(201).json(template);
  });

  app.patch("/api/session-templates/:id", async (req, res) => {
    const template = await storage.updateSessionTemplate(req.params.id, req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/session-templates/:id", async (req, res) => {
    const deleted = await storage.deleteSessionTemplate(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Template not found" });
    res.json({ success: true });
  });

  app.get("/api/phase-templates", async (_req, res) => {
    const templates = await storage.getPhaseTemplates();
    res.json(templates);
  });

  app.post("/api/phase-templates", async (req, res) => {
    const template = await storage.createPhaseTemplate(req.body);
    res.status(201).json(template);
  });

  app.patch("/api/phase-templates/:id", async (req, res) => {
    const template = await storage.updatePhaseTemplate(req.params.id, req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/phase-templates/:id", async (req, res) => {
    const deleted = await storage.deletePhaseTemplate(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Template not found" });
    res.json({ success: true });
  });

  app.get("/api/workout-logs", async (req, res) => {
    const clientId = req.query.clientId as string | undefined;
    const result = clientId
      ? await storage.getLogsByClient(clientId)
      : await storage.getWorkoutLogs();
    res.json(result);
  });

  app.post("/api/workout-logs", async (req, res) => {
    const log = await storage.createWorkoutLog(req.body);
    res.status(201).json(log);
  });

  app.get("/api/messages", async (req, res) => {
    const clientId = req.query.clientId as string | undefined;
    const result = clientId
      ? await storage.getMessagesByClient(clientId)
      : await storage.getMessages();
    res.json(result);
  });

  app.post("/api/messages", async (req, res) => {
    const message = await storage.createMessage(req.body);
    res.status(201).json(message);
  });

  app.get("/api/chat/unread", async (req, res) => {
    const userId = req.query.userId as string;
    const role = req.query.role as string;
    if (!userId) return res.status(400).json({ message: "userId required" });

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
    const { userId, clientId } = req.body;
    if (!userId || !clientId) return res.status(400).json({ message: "userId and clientId required" });
    const result = await storage.upsertChatReadStatus(userId, clientId, new Date().toISOString());
    res.json(result);
  });

  return httpServer;
}
