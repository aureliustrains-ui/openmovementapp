import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  phases,
  sessions,
  exerciseTemplates,
  sectionTemplates,
  sessionTemplates,
  phaseTemplates,
  workoutLogs,
  sessionCheckins,
  weeklyCheckins,
  progressReports,
  progressReportItems,
  messages,
  chatReadStatus,
  type User,
  type InsertUser,
  type Phase,
  type InsertPhase,
  type Session,
  type InsertSession,
  type ExerciseTemplate,
  type InsertExerciseTemplate,
  type SectionTemplate,
  type InsertSectionTemplate,
  type SessionTemplate,
  type InsertSessionTemplate,
  type PhaseTemplate,
  type InsertPhaseTemplate,
  type WorkoutLog,
  type InsertWorkoutLog,
  type SessionCheckin,
  type InsertSessionCheckin,
  type WeeklyCheckin,
  type InsertWeeklyCheckin,
  type ProgressReport,
  type InsertProgressReport,
  type ProgressReportItem,
  type InsertProgressReportItem,
  type Message,
  type InsertMessage,
  type ChatReadStatus,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

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
  updateExerciseTemplate(
    id: string,
    data: Partial<InsertExerciseTemplate>,
  ): Promise<ExerciseTemplate | undefined>;
  deleteExerciseTemplate(id: string): Promise<boolean>;

  getSectionTemplates(): Promise<SectionTemplate[]>;
  createSectionTemplate(template: InsertSectionTemplate): Promise<SectionTemplate>;
  updateSectionTemplate(
    id: string,
    data: Partial<InsertSectionTemplate>,
  ): Promise<SectionTemplate | undefined>;
  deleteSectionTemplate(id: string): Promise<boolean>;

  getSessionTemplates(): Promise<SessionTemplate[]>;
  createSessionTemplate(template: InsertSessionTemplate): Promise<SessionTemplate>;
  updateSessionTemplate(
    id: string,
    data: Partial<InsertSessionTemplate>,
  ): Promise<SessionTemplate | undefined>;
  deleteSessionTemplate(id: string): Promise<boolean>;

  getPhaseTemplates(): Promise<PhaseTemplate[]>;
  getPhaseTemplate(id: string): Promise<PhaseTemplate | undefined>;
  createPhaseTemplate(template: InsertPhaseTemplate): Promise<PhaseTemplate>;
  updatePhaseTemplate(
    id: string,
    data: Partial<InsertPhaseTemplate>,
  ): Promise<PhaseTemplate | undefined>;
  deletePhaseTemplate(id: string): Promise<boolean>;

  getWorkoutLogs(): Promise<WorkoutLog[]>;
  getLogsByClient(clientId: string): Promise<WorkoutLog[]>;
  createWorkoutLog(log: InsertWorkoutLog): Promise<WorkoutLog>;
  getSessionCheckinsByClient(clientId: string): Promise<SessionCheckin[]>;
  createSessionCheckin(checkin: InsertSessionCheckin): Promise<SessionCheckin>;
  getWeeklyCheckinsByClient(clientId: string): Promise<WeeklyCheckin[]>;
  getWeeklyCheckinByClientAndPhaseWeek(
    clientId: string,
    phaseId: string,
    phaseWeekNumber: number,
  ): Promise<WeeklyCheckin | undefined>;
  createWeeklyCheckin(checkin: InsertWeeklyCheckin): Promise<WeeklyCheckin>;
  getWeeklyCheckinByClientAndWeek(
    clientId: string,
    weekStartDate: string,
  ): Promise<WeeklyCheckin | undefined>;
  updateWeeklyCheckinIdentity(
    id: string,
    data: Pick<InsertWeeklyCheckin, "phaseId" | "phaseWeekNumber" | "weekStartDate">,
  ): Promise<WeeklyCheckin | undefined>;

  getProgressReportsByClient(clientId: string): Promise<ProgressReport[]>;
  getProgressReport(id: string): Promise<ProgressReport | undefined>;
  createProgressReport(report: InsertProgressReport): Promise<ProgressReport>;
  updateProgressReport(
    id: string,
    data: Partial<InsertProgressReport>,
  ): Promise<ProgressReport | undefined>;
  getProgressReportItems(reportId: string): Promise<ProgressReportItem[]>;
  createProgressReportItem(item: InsertProgressReportItem): Promise<ProgressReportItem>;
  updateProgressReportItem(
    id: string,
    data: Partial<InsertProgressReportItem>,
  ): Promise<ProgressReportItem | undefined>;

  getMessages(): Promise<Message[]>;
  getMessagesByClient(clientId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  getChatReadStatus(userId: string, clientId: string): Promise<ChatReadStatus | undefined>;
  upsertChatReadStatus(
    userId: string,
    clientId: string,
    lastReadAt: string,
  ): Promise<ChatReadStatus>;
  getChatReadStatusByUser(userId: string): Promise<ChatReadStatus[]>;
}

export class DatabaseStorage implements IStorage {
  private isMissingColumnError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    if (code === "42703") return true;
    const message =
      "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
    return /column .* does not exist/i.test(message);
  }

  private toCompatUser(row: {
    id: string;
    name: string;
    email: string;
    password_hash: string | null;
    role: string | null;
    status: string | null;
  }): User {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role || "Client",
      status: row.status || "Active",
      avatar: null,
      bio: null,
      height: null,
      weight: null,
      goals: null,
      infos: null,
      specifics: null,
      specificsUpdatedAt: null,
      specificsUpdatedBy: null,
    };
  }

  private async getUserCompatById(id: string): Promise<User | undefined> {
    const result = await db.execute(sql`
      select id, name, email, password_hash, role, status
      from users
      where id = ${id}
      limit 1
    `);
    const row = result.rows[0] as
      | {
          id: string;
          name: string;
          email: string;
          password_hash: string | null;
          role: string | null;
          status: string | null;
        }
      | undefined;
    return row ? this.toCompatUser(row) : undefined;
  }

  private async getUserCompatByEmail(email: string): Promise<User | undefined> {
    const result = await db.execute(sql`
      select id, name, email, password_hash, role, status
      from users
      where email = ${email}
      limit 1
    `);
    const row = result.rows[0] as
      | {
          id: string;
          name: string;
          email: string;
          password_hash: string | null;
          role: string | null;
          status: string | null;
        }
      | undefined;
    return row ? this.toCompatUser(row) : undefined;
  }

  private async getUsersCompat(): Promise<User[]> {
    const result = await db.execute(sql`
      select id, name, email, password_hash, role, status
      from users
    `);
    const rows = result.rows as Array<{
      id: string;
      name: string;
      email: string;
      password_hash: string | null;
      role: string | null;
      status: string | null;
    }>;
    return rows.map((row) => this.toCompatUser(row));
  }

  private parseJsonArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private toCompatSession(row: {
    id: string;
    phase_id: string;
    name: string;
    description: string | null;
    completed_instances: unknown;
    sections: unknown;
  }): Session {
    return {
      id: row.id,
      phaseId: row.phase_id,
      name: row.name,
      description: row.description ?? null,
      sessionVideoUrl: null,
      completedInstances: this.parseJsonArray(row.completed_instances),
      sections: this.parseJsonArray(row.sections),
    };
  }

  private async getSessionsCompat(): Promise<Session[]> {
    const result = await db.execute(sql`
      select id, phase_id, name, description, completed_instances, sections
      from sessions
    `);
    const rows = result.rows as Array<{
      id: string;
      phase_id: string;
      name: string;
      description: string | null;
      completed_instances: unknown;
      sections: unknown;
    }>;
    return rows.map((row) => this.toCompatSession(row));
  }

  private async getSessionsByPhaseCompat(phaseId: string): Promise<Session[]> {
    const result = await db.execute(sql`
      select id, phase_id, name, description, completed_instances, sections
      from sessions
      where phase_id = ${phaseId}
    `);
    const rows = result.rows as Array<{
      id: string;
      phase_id: string;
      name: string;
      description: string | null;
      completed_instances: unknown;
      sections: unknown;
    }>;
    return rows.map((row) => this.toCompatSession(row));
  }

  private async getSessionCompatById(id: string): Promise<Session | undefined> {
    const result = await db.execute(sql`
      select id, phase_id, name, description, completed_instances, sections
      from sessions
      where id = ${id}
      limit 1
    `);
    const row = result.rows[0] as
      | {
          id: string;
          phase_id: string;
          name: string;
          description: string | null;
          completed_instances: unknown;
          sections: unknown;
        }
      | undefined;
    return row ? this.toCompatSession(row) : undefined;
  }

  private async createSessionCompat(session: InsertSession): Promise<Session> {
    const completedInstances = JSON.stringify(
      Array.isArray(session.completedInstances) ? session.completedInstances : [],
    );
    const sectionsJson = JSON.stringify(Array.isArray(session.sections) ? session.sections : []);
    const result = await db.execute(sql`
      insert into sessions (phase_id, name, description, completed_instances, sections)
      values (
        ${session.phaseId},
        ${session.name},
        ${session.description ?? null},
        ${completedInstances}::jsonb,
        ${sectionsJson}::jsonb
      )
      returning id, phase_id, name, description, completed_instances, sections
    `);
    const row = result.rows[0] as {
      id: string;
      phase_id: string;
      name: string;
      description: string | null;
      completed_instances: unknown;
      sections: unknown;
    };
    return this.toCompatSession(row);
  }

  private async updateSessionCompat(
    id: string,
    data: Partial<InsertSession>,
  ): Promise<Session | undefined> {
    const existing = await this.getSessionCompatById(id);
    if (!existing) return undefined;

    const merged: Session = {
      ...existing,
      ...data,
      sessionVideoUrl: null,
      completedInstances: this.parseJsonArray(data.completedInstances ?? existing.completedInstances),
      sections: this.parseJsonArray(data.sections ?? existing.sections),
    };

    const completedInstances = JSON.stringify(merged.completedInstances);
    const sectionsJson = JSON.stringify(merged.sections);
    const result = await db.execute(sql`
      update sessions
      set
        phase_id = ${merged.phaseId},
        name = ${merged.name},
        description = ${merged.description ?? null},
        completed_instances = ${completedInstances}::jsonb,
        sections = ${sectionsJson}::jsonb
      where id = ${id}
      returning id, phase_id, name, description, completed_instances, sections
    `);
    const row = result.rows[0] as
      | {
          id: string;
          phase_id: string;
          name: string;
          description: string | null;
          completed_instances: unknown;
          sections: unknown;
        }
      | undefined;
    return row ? this.toCompatSession(row) : undefined;
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      if (!this.isMissingColumnError(error)) throw error;
      return this.getUserCompatById(id);
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      if (!this.isMissingColumnError(error)) throw error;
      return this.getUserCompatByEmail(email);
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      return db.select().from(users);
    } catch (error) {
      if (!this.isMissingColumnError(error)) throw error;
      return this.getUsersCompat();
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
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
    try {
      return db.select().from(sessions);
    } catch (error) {
      if (!this.isMissingColumnError(error)) throw error;
      return this.getSessionsCompat();
    }
  }

  async getSessionsByPhase(phaseId: string): Promise<Session[]> {
    try {
      return db.select().from(sessions).where(eq(sessions.phaseId, phaseId));
    } catch (error) {
      if (!this.isMissingColumnError(error)) throw error;
      return this.getSessionsByPhaseCompat(phaseId);
    }
  }

  async getSession(id: string): Promise<Session | undefined> {
    try {
      const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
      return session;
    } catch (error) {
      if (!this.isMissingColumnError(error)) throw error;
      return this.getSessionCompatById(id);
    }
  }

  async createSession(session: InsertSession): Promise<Session> {
    try {
      const [created] = await db.insert(sessions).values(session).returning();
      return created;
    } catch (error) {
      if (!this.isMissingColumnError(error)) throw error;
      return this.createSessionCompat(session);
    }
  }

  async updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined> {
    try {
      const [updated] = await db.update(sessions).set(data).where(eq(sessions.id, id)).returning();
      return updated;
    } catch (error) {
      if (!this.isMissingColumnError(error)) throw error;
      return this.updateSessionCompat(id, data);
    }
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

  async updateExerciseTemplate(
    id: string,
    data: Partial<InsertExerciseTemplate>,
  ): Promise<ExerciseTemplate | undefined> {
    const [updated] = await db
      .update(exerciseTemplates)
      .set(data)
      .where(eq(exerciseTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteExerciseTemplate(id: string): Promise<boolean> {
    const result = await db
      .delete(exerciseTemplates)
      .where(eq(exerciseTemplates.id, id))
      .returning();
    return result.length > 0;
  }

  async getSectionTemplates(): Promise<SectionTemplate[]> {
    return db.select().from(sectionTemplates);
  }

  async createSectionTemplate(template: InsertSectionTemplate): Promise<SectionTemplate> {
    const [created] = await db.insert(sectionTemplates).values(template).returning();
    return created;
  }

  async updateSectionTemplate(
    id: string,
    data: Partial<InsertSectionTemplate>,
  ): Promise<SectionTemplate | undefined> {
    const [updated] = await db
      .update(sectionTemplates)
      .set(data)
      .where(eq(sectionTemplates.id, id))
      .returning();
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

  async updateSessionTemplate(
    id: string,
    data: Partial<InsertSessionTemplate>,
  ): Promise<SessionTemplate | undefined> {
    const [updated] = await db
      .update(sessionTemplates)
      .set(data)
      .where(eq(sessionTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteSessionTemplate(id: string): Promise<boolean> {
    const result = await db.delete(sessionTemplates).where(eq(sessionTemplates.id, id)).returning();
    return result.length > 0;
  }

  async getPhaseTemplates(): Promise<PhaseTemplate[]> {
    return db.select().from(phaseTemplates);
  }

  async getPhaseTemplate(id: string): Promise<PhaseTemplate | undefined> {
    const [template] = await db.select().from(phaseTemplates).where(eq(phaseTemplates.id, id));
    return template;
  }

  async createPhaseTemplate(template: InsertPhaseTemplate): Promise<PhaseTemplate> {
    const [created] = await db.insert(phaseTemplates).values(template).returning();
    return created;
  }

  async updatePhaseTemplate(
    id: string,
    data: Partial<InsertPhaseTemplate>,
  ): Promise<PhaseTemplate | undefined> {
    const [updated] = await db
      .update(phaseTemplates)
      .set(data)
      .where(eq(phaseTemplates.id, id))
      .returning();
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

  async getSessionCheckinsByClient(clientId: string): Promise<SessionCheckin[]> {
    return db.select().from(sessionCheckins).where(eq(sessionCheckins.clientId, clientId));
  }

  async createSessionCheckin(checkin: InsertSessionCheckin): Promise<SessionCheckin> {
    const [created] = await db.insert(sessionCheckins).values(checkin).returning();
    return created;
  }

  async getWeeklyCheckinsByClient(clientId: string): Promise<WeeklyCheckin[]> {
    return db.select().from(weeklyCheckins).where(eq(weeklyCheckins.clientId, clientId));
  }

  async getWeeklyCheckinByClientAndPhaseWeek(
    clientId: string,
    phaseId: string,
    phaseWeekNumber: number,
  ): Promise<WeeklyCheckin | undefined> {
    const [existing] = await db
      .select()
      .from(weeklyCheckins)
      .where(
        and(
          eq(weeklyCheckins.clientId, clientId),
          eq(weeklyCheckins.phaseId, phaseId),
          eq(weeklyCheckins.phaseWeekNumber, phaseWeekNumber),
        ),
      );
    return existing;
  }

  async getWeeklyCheckinByClientAndWeek(
    clientId: string,
    weekStartDate: string,
  ): Promise<WeeklyCheckin | undefined> {
    const [existing] = await db
      .select()
      .from(weeklyCheckins)
      .where(
        and(eq(weeklyCheckins.clientId, clientId), eq(weeklyCheckins.weekStartDate, weekStartDate)),
      );
    return existing;
  }

  async createWeeklyCheckin(checkin: InsertWeeklyCheckin): Promise<WeeklyCheckin> {
    const [created] = await db.insert(weeklyCheckins).values(checkin).returning();
    return created;
  }

  async updateWeeklyCheckinIdentity(
    id: string,
    data: Pick<InsertWeeklyCheckin, "phaseId" | "phaseWeekNumber" | "weekStartDate">,
  ): Promise<WeeklyCheckin | undefined> {
    const [updated] = await db
      .update(weeklyCheckins)
      .set(data)
      .where(eq(weeklyCheckins.id, id))
      .returning();
    return updated;
  }

  async getProgressReportsByClient(clientId: string): Promise<ProgressReport[]> {
    return db.select().from(progressReports).where(eq(progressReports.clientId, clientId));
  }

  async getProgressReport(id: string): Promise<ProgressReport | undefined> {
    const [report] = await db.select().from(progressReports).where(eq(progressReports.id, id));
    return report;
  }

  async createProgressReport(report: InsertProgressReport): Promise<ProgressReport> {
    const [created] = await db.insert(progressReports).values(report).returning();
    return created;
  }

  async updateProgressReport(
    id: string,
    data: Partial<InsertProgressReport>,
  ): Promise<ProgressReport | undefined> {
    const [updated] = await db
      .update(progressReports)
      .set(data)
      .where(eq(progressReports.id, id))
      .returning();
    return updated;
  }

  async getProgressReportItems(reportId: string): Promise<ProgressReportItem[]> {
    return db
      .select()
      .from(progressReportItems)
      .where(eq(progressReportItems.progressReportId, reportId));
  }

  async createProgressReportItem(item: InsertProgressReportItem): Promise<ProgressReportItem> {
    const [created] = await db.insert(progressReportItems).values(item).returning();
    return created;
  }

  async updateProgressReportItem(
    id: string,
    data: Partial<InsertProgressReportItem>,
  ): Promise<ProgressReportItem | undefined> {
    const [updated] = await db
      .update(progressReportItems)
      .set(data)
      .where(eq(progressReportItems.id, id))
      .returning();
    return updated;
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
    const [status] = await db
      .select()
      .from(chatReadStatus)
      .where(and(eq(chatReadStatus.userId, userId), eq(chatReadStatus.clientId, clientId)));
    return status;
  }

  async upsertChatReadStatus(
    userId: string,
    clientId: string,
    lastReadAt: string,
  ): Promise<ChatReadStatus> {
    const existing = await this.getChatReadStatus(userId, clientId);
    if (existing) {
      const [updated] = await db
        .update(chatReadStatus)
        .set({ lastReadAt })
        .where(eq(chatReadStatus.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(chatReadStatus)
      .values({ userId, clientId, lastReadAt })
      .returning();
    return created;
  }

  async getChatReadStatusByUser(userId: string): Promise<ChatReadStatus[]> {
    return db.select().from(chatReadStatus).where(eq(chatReadStatus.userId, userId));
  }
}

export const storage = new DatabaseStorage();
