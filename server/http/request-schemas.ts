import { z } from "zod";

export const createMessageSchema = z
  .object({
    clientId: z.string().min(1).max(64),
    text: z.string().min(1).max(2000),
  })
  .strict();

const workoutSetSchema = z
  .object({
    setNumber: z.number().int().positive(),
    weight: z.number().nonnegative().optional(),
    reps: z.number().int().nonnegative().optional(),
    rpe: z.number().nonnegative().max(10).optional(),
  })
  .strict();

export const createWorkoutLogSchema = z
  .object({
    clientId: z.string().min(1).max(64),
    phaseId: z.string().min(1).max(64),
    instanceId: z.string().min(1).max(120),
    exerciseId: z.string().min(1).max(120),
    date: z.string().min(1).max(64),
    sets: z.array(workoutSetSchema).max(100),
    clientNotes: z.string().max(4000).nullable().optional(),
  })
  .strict();

export const markChatReadSchema = z
  .object({
    clientId: z.string().min(1).max(64),
  })
  .strict();

export const createSessionCheckinSchema = z
  .object({
    sessionId: z.string().min(1).max(64),
    rpeOverall: z.number().int().min(0).max(10),
    feltOff: z.boolean().optional().default(false),
    feltOffNote: z.string().max(2000).nullable().optional(),
  })
  .strict();

export const createWeeklyCheckinSchema = z
  .object({
    sleepWeek: z.number().int().min(1).max(5),
    energyWeek: z.number().int().min(1).max(5),
    injuryAffectedTraining: z.boolean(),
    injuryImpact: z.number().int().min(0).max(3).nullable().optional(),
    coachNoteFromClient: z.string().max(4000).nullable().optional(),
  })
  .strict();
