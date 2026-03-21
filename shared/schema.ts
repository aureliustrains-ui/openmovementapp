import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, json, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("Client"),
  status: text("status").notNull().default("Active"),
  avatar: text("avatar"),
  bio: text("bio"),
  height: text("height"),
  weight: text("weight"),
  goals: text("goals"),
  infos: text("infos"),
  specifics: text("specifics"),
  specificsUpdatedAt: text("specifics_updated_at"),
  specificsUpdatedBy: text("specifics_updated_by"),
});

export const sessionStore = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { mode: "string" }).notNull(),
});

export const phases = pgTable("phases", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 64 }).notNull(),
  name: text("name").notNull(),
  goal: text("goal"),
  startDate: text("start_date"),
  durationWeeks: integer("duration_weeks").notNull().default(4),
  status: text("status").notNull().default("Draft"),
  movementChecks: jsonb("movement_checks").notNull().default([]),
  schedule: jsonb("schedule").notNull().default([]),
  completedScheduleInstances: jsonb("completed_schedule_instances").notNull().default([]),
  homeIntroVideoUrl: text("home_intro_video_url"),
});

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  phaseId: varchar("phase_id", { length: 64 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  sessionVideoUrl: text("session_video_url"),
  completedInstances: jsonb("completed_instances").notNull().default([]),
  sections: jsonb("sections").notNull().default([]),
});

export const exerciseTemplates = pgTable("exercise_templates", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  targetMuscle: text("target_muscle"),
  demoUrl: text("demo_url"),
  sets: text("sets"),
  reps: text("reps"),
  load: text("load"),
  tempo: text("tempo"),
  notes: text("notes"),
  goal: text("goal"),
  additionalInstructions: text("additional_instructions"),
  enableStructuredLogging: boolean("enable_structured_logging").notNull().default(false),
  requiresMovementCheck: boolean("requires_movement_check").notNull().default(false),
});

export const sectionTemplates = pgTable("section_templates", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  exercises: jsonb("exercises").notNull().default([]),
});

export const sessionTemplates = pgTable("session_templates", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  sections: jsonb("sections").notNull().default([]),
});

export const phaseTemplates = pgTable("phase_templates", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  goal: text("goal"),
  durationWeeks: integer("duration_weeks").notNull().default(4),
  sessions: jsonb("sessions").notNull().default([]),
  schedule: jsonb("schedule").notNull().default([]),
  movementCheckEnabled: boolean("movement_check_enabled").notNull().default(false),
});

export const workoutLogs = pgTable("workout_logs", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 64 }).notNull(),
  phaseId: varchar("phase_id", { length: 64 }).notNull(),
  instanceId: text("instance_id").notNull(),
  exerciseId: text("exercise_id").notNull(),
  exerciseName: text("exercise_name"),
  date: text("date").notNull(),
  sets: jsonb("sets").notNull().default([]),
  clientNotes: text("client_notes"),
});

export const sessionCheckins = pgTable("session_checkins", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 64 }).notNull(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  submittedAt: text("submitted_at").notNull(),
  rpeOverall: integer("rpe_overall").notNull(),
  sleepLastNight: integer("sleep_last_night"),
  feltOff: boolean("felt_off").notNull().default(false),
  feltOffNote: text("felt_off_note"),
  optionalNote: text("optional_note"),
});

export const weeklyCheckins = pgTable(
  "weekly_checkins",
  {
    id: varchar("id", { length: 64 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    phaseId: varchar("phase_id", { length: 64 }),
    phaseWeekNumber: integer("phase_week_number"),
    weekStartDate: text("week_start_date").notNull(),
    submittedAt: text("submitted_at").notNull(),
    sleepWeek: integer("sleep_week").notNull(),
    energyWeek: integer("energy_week").notNull(),
    injuryAffectedTraining: boolean("injury_affected_training").notNull().default(false),
    injuryImpact: integer("injury_impact"),
    coachNoteFromClient: text("coach_note_from_client"),
  },
  (table) => ({
    weeklyCheckinsClientPhaseWeekUnique: uniqueIndex("weekly_checkins_client_phase_week_unique").on(
      table.clientId,
      table.phaseId,
      table.phaseWeekNumber,
    ),
  }),
);

export const progressReports = pgTable("progress_reports", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 64 }).notNull(),
  phaseId: varchar("phase_id", { length: 64 }).notNull(),
  status: text("status").notNull().default("requested"),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: text("created_at").notNull(),
  submittedAt: text("submitted_at"),
});

export const progressReportItems = pgTable(
  "progress_report_items",
  {
    id: varchar("id", { length: 64 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    progressReportId: varchar("progress_report_id", { length: 64 }).notNull(),
    exerciseId: text("exercise_id").notNull(),
    exerciseName: text("exercise_name").notNull(),
    submissionSource: text("submission_source"),
    submissionObjectKey: text("submission_object_key"),
    submissionMimeType: text("submission_mime_type"),
    submissionOriginalFilename: text("submission_original_filename"),
    submissionLink: text("submission_link"),
    submissionNote: text("submission_note"),
    reviewStatus: text("review_status").notNull().default("requested"),
    feedbackNote: text("feedback_note"),
    reviewedAt: text("reviewed_at"),
  },
  (table) => ({
    progressReportItemsReportExerciseUnique: uniqueIndex("progress_report_items_report_exercise_unique").on(
      table.progressReportId,
      table.exerciseId,
    ),
  }),
);

export const messages = pgTable("messages", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 64 }).notNull(),
  senderUserId: varchar("sender_user_id", { length: 64 }),
  sender: text("sender").notNull(),
  text: text("text").notNull(),
  time: text("time").notNull(),
  isClient: boolean("is_client").notNull().default(false),
});

export const chatReadStatus = pgTable("chat_read_status", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 64 }).notNull(),
  lastReadAt: text("last_read_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertPhaseSchema = createInsertSchema(phases).omit({ id: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });
export const insertExerciseTemplateSchema = createInsertSchema(exerciseTemplates).omit({
  id: true,
});
export const insertSectionTemplateSchema = createInsertSchema(sectionTemplates).omit({ id: true });
export const insertSessionTemplateSchema = createInsertSchema(sessionTemplates).omit({ id: true });
export const insertPhaseTemplateSchema = createInsertSchema(phaseTemplates).omit({ id: true });
export const insertWorkoutLogSchema = createInsertSchema(workoutLogs).omit({ id: true });
export const insertSessionCheckinSchema = createInsertSchema(sessionCheckins).omit({ id: true });
export const insertWeeklyCheckinSchema = createInsertSchema(weeklyCheckins).omit({ id: true });
export const insertProgressReportSchema = createInsertSchema(progressReports).omit({ id: true });
export const insertProgressReportItemSchema = createInsertSchema(progressReportItems).omit({ id: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });
export const insertChatReadStatusSchema = createInsertSchema(chatReadStatus).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPhase = z.infer<typeof insertPhaseSchema>;
export type Phase = typeof phases.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertExerciseTemplate = z.infer<typeof insertExerciseTemplateSchema>;
export type ExerciseTemplate = typeof exerciseTemplates.$inferSelect;
export type InsertSectionTemplate = z.infer<typeof insertSectionTemplateSchema>;
export type SectionTemplate = typeof sectionTemplates.$inferSelect;
export type InsertSessionTemplate = z.infer<typeof insertSessionTemplateSchema>;
export type SessionTemplate = typeof sessionTemplates.$inferSelect;
export type InsertPhaseTemplate = z.infer<typeof insertPhaseTemplateSchema>;
export type PhaseTemplate = typeof phaseTemplates.$inferSelect;
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type InsertSessionCheckin = z.infer<typeof insertSessionCheckinSchema>;
export type SessionCheckin = typeof sessionCheckins.$inferSelect;
export type InsertWeeklyCheckin = z.infer<typeof insertWeeklyCheckinSchema>;
export type WeeklyCheckin = typeof weeklyCheckins.$inferSelect;
export type InsertProgressReport = z.infer<typeof insertProgressReportSchema>;
export type ProgressReport = typeof progressReports.$inferSelect;
export type InsertProgressReportItem = z.infer<typeof insertProgressReportItemSchema>;
export type ProgressReportItem = typeof progressReportItems.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertChatReadStatus = z.infer<typeof insertChatReadStatusSchema>;
export type ChatReadStatus = typeof chatReadStatus.$inferSelect;
