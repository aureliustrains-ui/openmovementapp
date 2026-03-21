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
    sessionRpe: z.number().int().min(1).max(10),
    sleepLastNight: z.number().int().min(1).max(10),
    feltOff: z.boolean().optional().default(false),
    whatFeltOff: z.string().max(2000).nullable().optional(),
    optionalNote: z.string().max(4000).nullable().optional(),
  })
  .strict();

export const createWeeklyCheckinSchema = z
  .object({
    recoveryThisTrainingWeek: z.number().int().min(1).max(5),
    stressOutsideTrainingThisWeek: z.number().int().min(1).max(5),
    injuryAffectedTraining: z.boolean(),
    injuryImpact: z.number().int().min(0).max(3).nullable().optional(),
    optionalNote: z.string().max(4000).nullable().optional(),
    phaseId: z.string().min(1).max(64).optional(),
    phaseWeekNumber: z.number().int().min(1).max(52).optional(),
  })
  .strict();

export const createProgressReportSchema = z
  .object({
    phaseId: z.string().min(1).max(64).optional(),
    exerciseIds: z.array(z.string().min(1).max(120)).min(1).max(100),
  })
  .strict();

export const createClientVideoUploadSchema = z
  .object({
    purpose: z.enum(["movement_check", "progress_report"]),
    fileName: z.string().min(1).max(255),
    fileSize: z.number().int().positive(),
    contentType: z.string().min(1).max(120),
  })
  .strict();

export const submitProgressReportSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            itemId: z.string().min(1).max(64),
            submissionLink: z.string().url().max(2048).nullable().optional(),
            submissionSource: z.enum(["link", "upload"]).optional(),
            submissionObjectKey: z.string().min(1).max(1024).nullable().optional(),
            submissionMimeType: z.string().max(120).nullable().optional(),
            submissionOriginalFilename: z.string().max(255).nullable().optional(),
            submissionNote: z.string().max(2000).nullable().optional(),
          })
          .strict()
          .refine(
            (value) =>
              (typeof value.submissionLink === "string" && value.submissionLink.trim().length > 0) ||
              (typeof value.submissionObjectKey === "string" &&
                value.submissionObjectKey.trim().length > 0),
            "Each item must include a submissionLink or submissionObjectKey.",
          ),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const reviewProgressReportItemSchema = z
  .object({
    decision: z.enum(["approve", "resubmit"]),
    feedbackNote: z.string().max(2000).nullable().optional(),
  })
  .strict();
