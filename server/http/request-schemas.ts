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
    recoveryThisTrainingWeek: z.coerce.number().int().min(1).max(5),
    stressOutsideTrainingThisWeek: z.coerce.number().int().min(1).max(5),
    injuryAffectedTraining: z.boolean(),
    injuryImpact: z.preprocess((value) => {
      if (value === "" || value === null || value === undefined) return null;
      if (value === 0 || value === "0") return null;
      return value;
    }, z.coerce.number().int().min(1).max(5).nullable().optional()),
    optionalNote: z.string().max(4000).nullable().optional(),
    phaseId: z.string().min(1).max(64).optional(),
    phaseWeekNumber: z.coerce.number().int().min(1).max(52).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.injuryAffectedTraining &&
      (value.injuryImpact === null || value.injuryImpact === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["injuryImpact"],
        message: "Injury impact is required when pain/injury affected training",
      });
    }
  });

const phaseStatusSchema = z.enum(["Draft", "Active", "Waiting for Movement Check", "Archived"]);

const nullableText = (max: number) => z.string().max(max).nullable().optional();

const durationMinutesSchema = z.coerce.number().int().min(1).max(600);

const positiveWeekNumberSchema = z.coerce.number().int().min(1).max(104);

const templateSortOrderSchema = z.coerce.number().int().min(0);

const templateFolderIdSchema = z.string().min(1).max(64).nullable();

export const createPhaseSchema = z
  .object({
    clientId: z.string().min(1).max(64),
    name: z.string().min(1).max(160),
    goal: nullableText(4000),
    startDate: z.string().max(64).nullable().optional(),
    durationWeeks: positiveWeekNumberSchema.optional(),
    status: phaseStatusSchema.optional(),
    movementChecks: z.array(z.unknown()).optional(),
    schedule: z.array(z.unknown()).optional(),
    completedScheduleInstances: z.array(z.string().max(120)).optional(),
    homeIntroVideoUrl: z.string().trim().max(2048).nullable().optional(),
  })
  .strict();

export const updatePhaseAdminSchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    goal: nullableText(4000),
    startDate: z.string().max(64).nullable().optional(),
    durationWeeks: positiveWeekNumberSchema.optional(),
    status: phaseStatusSchema.optional(),
    movementChecks: z.array(z.unknown()).optional(),
    schedule: z.array(z.unknown()).optional(),
    completedScheduleInstances: z.array(z.string().max(120)).optional(),
    homeIntroVideoUrl: z.string().trim().max(2048).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");

export const createSessionSchema = z
  .object({
    phaseId: z.string().min(1).max(64),
    name: z.string().min(1).max(160),
    description: nullableText(4000),
    durationMinutes: durationMinutesSchema.nullable().optional(),
    sessionVideoUrl: z.string().trim().max(2048).nullable().optional(),
    completedInstances: z.array(z.string().max(120)).optional(),
    sections: z.array(z.unknown()).optional(),
  })
  .strict();

export const updateSessionSchema = z
  .object({
    phaseId: z.string().min(1).max(64).optional(),
    name: z.string().min(1).max(160).optional(),
    description: nullableText(4000),
    durationMinutes: durationMinutesSchema.nullable().optional(),
    sessionVideoUrl: z.string().trim().max(2048).nullable().optional(),
    completedInstances: z.array(z.string().max(120)).optional(),
    sections: z.array(z.unknown()).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");

export const createExerciseTemplateSchema = z
  .object({
    folderId: templateFolderIdSchema.optional(),
    sortOrder: templateSortOrderSchema.optional(),
    name: z.string().min(1).max(160),
    targetMuscle: nullableText(120),
    demoUrl: z.string().trim().max(2048).nullable().optional(),
    sets: nullableText(120),
    reps: nullableText(120),
    load: nullableText(120),
    tempo: nullableText(120),
    notes: nullableText(4000),
    goal: nullableText(4000),
    additionalInstructions: nullableText(4000),
    enableStructuredLogging: z.boolean().optional(),
    requiresMovementCheck: z.boolean().optional(),
  })
  .strict();

export const updateExerciseTemplateSchema = z
  .object({
    folderId: templateFolderIdSchema.optional(),
    sortOrder: templateSortOrderSchema.optional(),
    name: z.string().min(1).max(160).optional(),
    targetMuscle: nullableText(120),
    demoUrl: z.string().trim().max(2048).nullable().optional(),
    sets: nullableText(120),
    reps: nullableText(120),
    load: nullableText(120),
    tempo: nullableText(120),
    notes: nullableText(4000),
    goal: nullableText(4000),
    additionalInstructions: nullableText(4000),
    enableStructuredLogging: z.boolean().optional(),
    requiresMovementCheck: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");

export const createSectionTemplateSchema = z
  .object({
    folderId: templateFolderIdSchema.optional(),
    sortOrder: templateSortOrderSchema.optional(),
    name: z.string().min(1).max(160),
    description: nullableText(4000),
    exercises: z.array(z.unknown()).optional(),
  })
  .strict();

export const updateSectionTemplateSchema = z
  .object({
    folderId: templateFolderIdSchema.optional(),
    sortOrder: templateSortOrderSchema.optional(),
    name: z.string().min(1).max(160).optional(),
    description: nullableText(4000),
    exercises: z.array(z.unknown()).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");

export const createSessionTemplateSchema = z
  .object({
    folderId: templateFolderIdSchema.optional(),
    sortOrder: templateSortOrderSchema.optional(),
    name: z.string().min(1).max(160),
    description: nullableText(4000),
    durationMinutes: durationMinutesSchema.nullable().optional(),
    sections: z.array(z.unknown()).optional(),
  })
  .strict();

export const updateSessionTemplateSchema = z
  .object({
    folderId: templateFolderIdSchema.optional(),
    sortOrder: templateSortOrderSchema.optional(),
    name: z.string().min(1).max(160).optional(),
    description: nullableText(4000),
    durationMinutes: durationMinutesSchema.nullable().optional(),
    sections: z.array(z.unknown()).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");

export const createPhaseTemplateSchema = z
  .object({
    folderId: templateFolderIdSchema.optional(),
    sortOrder: templateSortOrderSchema.optional(),
    name: z.string().min(1).max(160),
    goal: nullableText(4000),
    durationWeeks: positiveWeekNumberSchema.optional(),
    sessions: z.array(z.unknown()).optional(),
    schedule: z.array(z.unknown()).optional(),
    movementCheckEnabled: z.boolean().optional(),
  })
  .strict();

export const updatePhaseTemplateSchema = z
  .object({
    folderId: templateFolderIdSchema.optional(),
    sortOrder: templateSortOrderSchema.optional(),
    name: z.string().min(1).max(160).optional(),
    goal: nullableText(4000),
    durationWeeks: positiveWeekNumberSchema.optional(),
    sessions: z.array(z.unknown()).optional(),
    schedule: z.array(z.unknown()).optional(),
    movementCheckEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");

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
              (typeof value.submissionLink === "string" &&
                value.submissionLink.trim().length > 0) ||
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

const templateFolderTypeSchema = z.enum(["phase", "session", "section", "exercise"]);

export const createTemplateFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: templateFolderTypeSchema,
    parentId: z.string().min(1).max(64).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();

export const updateTemplateFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    parentId: z.string().min(1).max(64).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined || value.parentId !== undefined || value.sortOrder !== undefined,
    "At least one field must be provided.",
  );

export const moveTemplateToFolderSchema = z
  .object({
    type: templateFolderTypeSchema,
    templateId: z.string().min(1).max(64),
    folderId: z.string().min(1).max(64).nullable(),
  })
  .strict();

export const reorderTemplatesSchema = z
  .object({
    type: templateFolderTypeSchema,
    items: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            sortOrder: z.number().int().min(0),
            folderId: z.string().min(1).max(64).nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();
