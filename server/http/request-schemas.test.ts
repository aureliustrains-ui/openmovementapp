import test from "node:test";
import assert from "node:assert/strict";
import {
  createMessageSchema,
  createWorkoutLogSchema,
  markChatReadSchema,
  createSessionCheckinSchema,
  createWeeklyCheckinSchema,
  createProgressReportSchema,
  createClientVideoUploadSchema,
  submitProgressReportSchema,
  reviewProgressReportItemSchema,
} from "./request-schemas";

test("createMessageSchema rejects unknown fields used for identity spoofing", () => {
  const parsed = createMessageSchema.safeParse({
    clientId: "client_1",
    text: "hello",
    sender: "Attacker",
    isClient: false,
  });

  assert.equal(parsed.success, false);
});

test("createWorkoutLogSchema validates required fields", () => {
  const parsed = createWorkoutLogSchema.safeParse({
    clientId: "client_1",
    phaseId: "phase_1",
    instanceId: "instance_1",
    exerciseId: "exercise_1",
    date: "2026-03-05",
    sets: [{ setNumber: 1, reps: 10 }],
  });

  assert.equal(parsed.success, true);
});

test("markChatReadSchema requires clientId", () => {
  const parsed = markChatReadSchema.safeParse({});
  assert.equal(parsed.success, false);
});

test("markChatReadSchema rejects unknown fields", () => {
  const parsed = markChatReadSchema.safeParse({
    clientId: "client_1",
    userId: "admin_1",
  });
  assert.equal(parsed.success, false);
});

test("createSessionCheckinSchema validates the new session check-in fields", () => {
  const valid = createSessionCheckinSchema.safeParse({
    sessionId: "session_1",
    sessionRpe: 7,
    sleepLastNight: 8,
    feltOff: true,
    whatFeltOff: "Left knee felt unstable",
    optionalNote: "Anything to add?",
  });
  assert.equal(valid.success, true);

  const invalid = createSessionCheckinSchema.safeParse({
    sessionId: "session_1",
    sessionRpe: 11,
    sleepLastNight: 11,
  });
  assert.equal(invalid.success, false);
});

test("createWeeklyCheckinSchema enforces injury impact bounds", () => {
  const valid = createWeeklyCheckinSchema.safeParse({
    recoveryThisTrainingWeek: 4,
    stressOutsideTrainingThisWeek: 3,
    injuryAffectedTraining: true,
    injuryImpact: 2,
    optionalNote: "Tight lower back after deadlifts",
    phaseId: "phase_1",
    phaseWeekNumber: 2,
  });
  assert.equal(valid.success, true);

  const invalid = createWeeklyCheckinSchema.safeParse({
    recoveryThisTrainingWeek: 4,
    stressOutsideTrainingThisWeek: 3,
    injuryAffectedTraining: true,
    injuryImpact: 5,
  });
  assert.equal(invalid.success, false);
});

test("createWeeklyCheckinSchema accepts payload without explicit phase fields", () => {
  const parsed = createWeeklyCheckinSchema.safeParse({
    recoveryThisTrainingWeek: 3,
    stressOutsideTrainingThisWeek: 3,
    injuryAffectedTraining: false,
    injuryImpact: null,
  });
  assert.equal(parsed.success, true);
});

test("createProgressReportSchema validates selected exercise ids", () => {
  const valid = createProgressReportSchema.safeParse({
    exerciseIds: ["ex_1", "ex_2"],
  });
  assert.equal(valid.success, true);

  const invalid = createProgressReportSchema.safeParse({
    exerciseIds: [],
  });
  assert.equal(invalid.success, false);
});

test("createClientVideoUploadSchema validates upload request payload", () => {
  const valid = createClientVideoUploadSchema.safeParse({
    purpose: "movement_check",
    fileName: "squat-angle.mp4",
    fileSize: 1024 * 1024,
    contentType: "video/mp4",
  });
  assert.equal(valid.success, true);

  const invalid = createClientVideoUploadSchema.safeParse({
    purpose: "movement_check",
    fileName: "",
    fileSize: -1,
    contentType: "",
  });
  assert.equal(invalid.success, false);
});

test("submitProgressReportSchema requires valid item submissions", () => {
  const valid = submitProgressReportSchema.safeParse({
    items: [
      {
        itemId: "item_1",
        submissionLink: "https://youtube.com/watch?v=demo",
        submissionNote: "Felt stronger this week",
      },
    ],
  });
  assert.equal(valid.success, true);

  const uploadValid = submitProgressReportSchema.safeParse({
    items: [
      {
        itemId: "item_1",
        submissionSource: "upload",
        submissionObjectKey: "progress-reports/client_1/2026-03-11/demo.mp4",
        submissionMimeType: "video/mp4",
        submissionOriginalFilename: "demo.mp4",
      },
    ],
  });
  assert.equal(uploadValid.success, true);

  const invalid = submitProgressReportSchema.safeParse({
    items: [
      {
        itemId: "item_1",
        submissionLink: "not-a-url",
      },
    ],
  });
  assert.equal(invalid.success, false);

  const missing = submitProgressReportSchema.safeParse({
    items: [
      {
        itemId: "item_1",
        submissionNote: "missing source",
      },
    ],
  });
  assert.equal(missing.success, false);
});

test("reviewProgressReportItemSchema validates admin decision payload", () => {
  const valid = reviewProgressReportItemSchema.safeParse({
    decision: "resubmit",
    feedbackNote: "Please re-record with side angle for depth check",
  });
  assert.equal(valid.success, true);

  const invalid = reviewProgressReportItemSchema.safeParse({
    decision: "invalid",
  });
  assert.equal(invalid.success, false);
});
