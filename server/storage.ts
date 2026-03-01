import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  users, phases, sessions, exerciseTemplates, sectionTemplates, sessionTemplates, phaseTemplates, workoutLogs, messages, chatReadStatus,
  type User, type InsertUser,
  type Phase, type InsertPhase,
  type Session, type InsertSession,
  type ExerciseTemplate, type InsertExerciseTemplate,
  type SectionTemplate, type InsertSectionTemplate,
  type SessionTemplate, type InsertSessionTemplate,
  type PhaseTemplate, type InsertPhaseTemplate,
  type WorkoutLog, type InsertWorkoutLog,
  type Message, type InsertMessage,
  type ChatReadStatus, type InsertChatReadStatus,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;

  getPhases(): Promise<Phase[]>;
  getPhasesByClient(clientId: string): Promise<Phase[]>;
  getPhase(id: string): Promise<Phase | undefined>;
  createPhase(phase: InsertPhase): Promise<Phase>;
  updatePhase(id: string, data: Partial<InsertPhase>): Promise<Phase | undefined>;
  deletePhase(id: string): Promise<boolean>;

  getSessions(): Promise<Session[]>;
  getSessionsByPhase(phaseId: string): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<boolean>;

  getExerciseTemplates(): Promise<ExerciseTemplate[]>;
  createExerciseTemplate(template: InsertExerciseTemplate): Promise<ExerciseTemplate>;
  updateExerciseTemplate(id: string, data: Partial<InsertExerciseTemplate>): Promise<ExerciseTemplate | undefined>;
  deleteExerciseTemplate(id: string): Promise<boolean>;

  getSectionTemplates(): Promise<SectionTemplate[]>;
  createSectionTemplate(template: InsertSectionTemplate): Promise<SectionTemplate>;
  updateSectionTemplate(id: string, data: Partial<InsertSectionTemplate>): Promise<SectionTemplate | undefined>;
  deleteSectionTemplate(id: string): Promise<boolean>;

  getSessionTemplates(): Promise<SessionTemplate[]>;
  createSessionTemplate(template: InsertSessionTemplate): Promise<SessionTemplate>;
  updateSessionTemplate(id: string, data: Partial<InsertSessionTemplate>): Promise<SessionTemplate | undefined>;
  deleteSessionTemplate(id: string): Promise<boolean>;

  getPhaseTemplates(): Promise<PhaseTemplate[]>;
  createPhaseTemplate(template: InsertPhaseTemplate): Promise<PhaseTemplate>;
  updatePhaseTemplate(id: string, data: Partial<InsertPhaseTemplate>): Promise<PhaseTemplate | undefined>;
  deletePhaseTemplate(id: string): Promise<boolean>;

  getWorkoutLogs(): Promise<WorkoutLog[]>;
  getLogsByClient(clientId: string): Promise<WorkoutLog[]>;
  createWorkoutLog(log: InsertWorkoutLog): Promise<WorkoutLog>;

  getMessages(): Promise<Message[]>;
  getMessagesByClient(clientId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  getChatReadStatus(userId: string, clientId: string): Promise<ChatReadStatus | undefined>;
  upsertChatReadStatus(userId: string, clientId: string, lastReadAt: string): Promise<ChatReadStatus>;
  getChatReadStatusByUser(userId: string): Promise<ChatReadStatus[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getPhases(): Promise<Phase[]> {
    return db.select().from(phases);
  }

  async getPhasesByClient(clientId: string): Promise<Phase[]> {
    return db.select().from(phases).where(eq(phases.clientId, clientId));
  }

  async getPhase(id: string): Promise<Phase | undefined> {
    const [phase] = await db.select().from(phases).where(eq(phases.id, id));
    return phase;
  }

  async createPhase(phase: InsertPhase): Promise<Phase> {
    const [created] = await db.insert(phases).values(phase).returning();
    return created;
  }

  async updatePhase(id: string, data: Partial<InsertPhase>): Promise<Phase | undefined> {
    const [updated] = await db.update(phases).set(data).where(eq(phases.id, id)).returning();
    return updated;
  }

  async deletePhase(id: string): Promise<boolean> {
    await db.delete(sessions).where(eq(sessions.phaseId, id));
    await db.delete(workoutLogs).where(eq(workoutLogs.phaseId, id));
    const result = await db.delete(phases).where(eq(phases.id, id)).returning();
    return result.length > 0;
  }

  async getSessions(): Promise<Session[]> {
    return db.select().from(sessions);
  }

  async getSessionsByPhase(phaseId: string): Promise<Session[]> {
    return db.select().from(sessions).where(eq(sessions.phaseId, phaseId));
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async createSession(session: InsertSession): Promise<Session> {
    const [created] = await db.insert(sessions).values(session).returning();
    return created;
  }

  async updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined> {
    const [updated] = await db.update(sessions).set(data).where(eq(sessions.id, id)).returning();
    return updated;
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.id, id)).returning();
    return result.length > 0;
  }

  async getExerciseTemplates(): Promise<ExerciseTemplate[]> {
    return db.select().from(exerciseTemplates);
  }

  async createExerciseTemplate(template: InsertExerciseTemplate): Promise<ExerciseTemplate> {
    const [created] = await db.insert(exerciseTemplates).values(template).returning();
    return created;
  }

  async updateExerciseTemplate(id: string, data: Partial<InsertExerciseTemplate>): Promise<ExerciseTemplate | undefined> {
    const [updated] = await db.update(exerciseTemplates).set(data).where(eq(exerciseTemplates.id, id)).returning();
    return updated;
  }

  async deleteExerciseTemplate(id: string): Promise<boolean> {
    const result = await db.delete(exerciseTemplates).where(eq(exerciseTemplates.id, id)).returning();
    return result.length > 0;
  }

  async getSectionTemplates(): Promise<SectionTemplate[]> {
    return db.select().from(sectionTemplates);
  }

  async createSectionTemplate(template: InsertSectionTemplate): Promise<SectionTemplate> {
    const [created] = await db.insert(sectionTemplates).values(template).returning();
    return created;
  }

  async updateSectionTemplate(id: string, data: Partial<InsertSectionTemplate>): Promise<SectionTemplate | undefined> {
    const [updated] = await db.update(sectionTemplates).set(data).where(eq(sectionTemplates.id, id)).returning();
    return updated;
  }

  async deleteSectionTemplate(id: string): Promise<boolean> {
    const result = await db.delete(sectionTemplates).where(eq(sectionTemplates.id, id)).returning();
    return result.length > 0;
  }

  async getSessionTemplates(): Promise<SessionTemplate[]> {
    return db.select().from(sessionTemplates);
  }

  async createSessionTemplate(template: InsertSessionTemplate): Promise<SessionTemplate> {
    const [created] = await db.insert(sessionTemplates).values(template).returning();
    return created;
  }

  async updateSessionTemplate(id: string, data: Partial<InsertSessionTemplate>): Promise<SessionTemplate | undefined> {
    const [updated] = await db.update(sessionTemplates).set(data).where(eq(sessionTemplates.id, id)).returning();
    return updated;
  }

  async deleteSessionTemplate(id: string): Promise<boolean> {
    const result = await db.delete(sessionTemplates).where(eq(sessionTemplates.id, id)).returning();
    return result.length > 0;
  }

  async getPhaseTemplates(): Promise<PhaseTemplate[]> {
    return db.select().from(phaseTemplates);
  }

  async createPhaseTemplate(template: InsertPhaseTemplate): Promise<PhaseTemplate> {
    const [created] = await db.insert(phaseTemplates).values(template).returning();
    return created;
  }

  async updatePhaseTemplate(id: string, data: Partial<InsertPhaseTemplate>): Promise<PhaseTemplate | undefined> {
    const [updated] = await db.update(phaseTemplates).set(data).where(eq(phaseTemplates.id, id)).returning();
    return updated;
  }

  async deletePhaseTemplate(id: string): Promise<boolean> {
    const result = await db.delete(phaseTemplates).where(eq(phaseTemplates.id, id)).returning();
    return result.length > 0;
  }

  async getWorkoutLogs(): Promise<WorkoutLog[]> {
    return db.select().from(workoutLogs);
  }

  async getLogsByClient(clientId: string): Promise<WorkoutLog[]> {
    return db.select().from(workoutLogs).where(eq(workoutLogs.clientId, clientId));
  }

  async createWorkoutLog(log: InsertWorkoutLog): Promise<WorkoutLog> {
    const [created] = await db.insert(workoutLogs).values(log).returning();
    return created;
  }

  async getMessages(): Promise<Message[]> {
    return db.select().from(messages);
  }

  async getMessagesByClient(clientId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.clientId, clientId));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  async getChatReadStatus(userId: string, clientId: string): Promise<ChatReadStatus | undefined> {
    const [status] = await db.select().from(chatReadStatus).where(
      and(eq(chatReadStatus.userId, userId), eq(chatReadStatus.clientId, clientId))
    );
    return status;
  }

  async upsertChatReadStatus(userId: string, clientId: string, lastReadAt: string): Promise<ChatReadStatus> {
    const existing = await this.getChatReadStatus(userId, clientId);
    if (existing) {
      const [updated] = await db.update(chatReadStatus)
        .set({ lastReadAt })
        .where(eq(chatReadStatus.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(chatReadStatus)
      .values({ userId, clientId, lastReadAt })
      .returning();
    return created;
  }

  async getChatReadStatusByUser(userId: string): Promise<ChatReadStatus[]> {
    return db.select().from(chatReadStatus).where(eq(chatReadStatus.userId, userId));
  }
}

export const storage = new DatabaseStorage();
