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

  app.delete("/api/sessions/:id", async (req, res) => {
    const deleted = await storage.deleteSession(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Session not found" });
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

  return httpServer;
}
