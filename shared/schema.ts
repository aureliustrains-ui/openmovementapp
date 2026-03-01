import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("Client"),
  status: text("status").notNull().default("Active"),
  avatar: text("avatar"),
});

export const phases = pgTable("phases", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 64 }).notNull(),
  name: text("name").notNull(),
  goal: text("goal"),
  startDate: text("start_date"),
  durationWeeks: integer("duration_weeks").notNull().default(4),
  status: text("status").notNull().default("Draft"),
  movementChecks: jsonb("movement_checks").notNull().default([]),
  schedule: jsonb("schedule").notNull().default([]),
});

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  phaseId: varchar("phase_id", { length: 64 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  completedInstances: jsonb("completed_instances").notNull().default([]),
  sections: jsonb("sections").notNull().default([]),
});

export const exerciseTemplates = pgTable("exercise_templates", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  targetMuscle: text("target_muscle"),
  demoUrl: text("demo_url"),
});

export const workoutLogs = pgTable("workout_logs", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 64 }).notNull(),
  phaseId: varchar("phase_id", { length: 64 }).notNull(),
  instanceId: text("instance_id").notNull(),
  exerciseId: text("exercise_id").notNull(),
  date: text("date").notNull(),
  sets: jsonb("sets").notNull().default([]),
  clientNotes: text("client_notes"),
});

export const messages = pgTable("messages", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 64 }).notNull(),
  sender: text("sender").notNull(),
  text: text("text").notNull(),
  time: text("time").notNull(),
  isClient: boolean("is_client").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertPhaseSchema = createInsertSchema(phases).omit({ id: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });
export const insertExerciseTemplateSchema = createInsertSchema(exerciseTemplates).omit({ id: true });
export const insertWorkoutLogSchema = createInsertSchema(workoutLogs).omit({ id: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPhase = z.infer<typeof insertPhaseSchema>;
export type Phase = typeof phases.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertExerciseTemplate = z.infer<typeof insertExerciseTemplateSchema>;
export type ExerciseTemplate = typeof exerciseTemplates.$inferSelect;
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
