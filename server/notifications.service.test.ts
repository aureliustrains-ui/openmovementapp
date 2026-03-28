import test from "node:test";
import assert from "node:assert/strict";
import type { Phase, ProgressReport, ProgressReportItem } from "@shared/schema";
import {
  countAdminMovementAttention,
  countAdminProgressAttention,
  countClientMovementActions,
  countClientProgressActions,
  countUnreadMessagesForAdminConversation,
  countUnreadMessagesForClient,
  normalizeProgressItemReviewStatus,
} from "./modules/notifications/notifications.service";

function buildPhase(overrides: Partial<Phase> = {}): Phase {
  return {
    id: "phase_1",
    clientId: "client_1",
    name: "Phase",
    goal: null,
    startDate: null,
    durationWeeks: 4,
    status: "Active",
    movementChecks: [],
    schedule: [],
    completedScheduleInstances: [],
    ...overrides,
  };
}

function buildReport(overrides: Partial<ProgressReport> = {}): ProgressReport {
  return {
    id: "report_1",
    clientId: "client_1",
    phaseId: "phase_1",
    status: "requested",
    createdBy: "admin_1",
    createdAt: "2026-03-01T08:00:00.000Z",
    submittedAt: null,
    ...overrides,
  };
}

function buildItem(overrides: Partial<ProgressReportItem> = {}): ProgressReportItem {
  return {
    id: "item_1",
    progressReportId: "report_1",
    exerciseId: "exercise_1",
    exerciseName: "Squat",
    submissionSource: null,
    submissionObjectKey: null,
    submissionMimeType: null,
    submissionOriginalFilename: null,
    submissionLink: null,
    submissionNote: null,
    reviewStatus: "requested",
    feedbackNote: null,
    reviewedAt: null,
    ...overrides,
  };
}

test("countAdminMovementAttention counts pending checks across phases", () => {
  const phases: Phase[] = [
    buildPhase({
      status: "Waiting for Movement Check",
      movementChecks: JSON.stringify([
        { status: "Pending" },
        { status: "Approved" },
        { status: "pending" },
      ]),
    }),
    buildPhase({
      id: "phase_2",
      status: "Waiting for Movement Check",
      movementChecks: [{ status: "Needs Resubmission" }, { status: "Pending" }],
    }),
  ];

  assert.equal(countAdminMovementAttention(phases), 3);
});

test("countClientMovementActions counts required and resubmission checks", () => {
  const currentPhase = buildPhase({
    status: "Waiting for Movement Check",
    movementChecks: [
      { status: "Not Submitted" },
      { status: "Needs Resubmission" },
      { status: "Approved" },
    ],
  });

  assert.equal(countClientMovementActions(currentPhase), 2);
});

test("countClientMovementActions falls back to waiting phase when statuses are stale", () => {
  const currentPhase = buildPhase({
    status: "Waiting for Movement Check",
    movementChecks: [{ status: "Pending" }],
  });

  assert.equal(countClientMovementActions(currentPhase), 1);
});

test("normalizeProgressItemReviewStatus respects explicit item status first", () => {
  const item = buildItem({
    reviewStatus: "requested",
    submissionObjectKey: "clients/client_1/progress/video.mp4",
  });

  assert.equal(normalizeProgressItemReviewStatus(item, "submitted"), "requested");
});

test("countAdminProgressAttention counts submitted review items only", () => {
  const grouped = [
    {
      report: buildReport({ status: "submitted" }),
      items: [
        buildItem({
          id: "item_1",
          reviewStatus: "submitted",
          submissionLink: "https://example.com/video",
        }),
        buildItem({ id: "item_2", reviewStatus: "approved" }),
      ],
    },
    {
      report: buildReport({ id: "report_2", status: "resubmission_requested" }),
      items: [buildItem({ id: "item_3", reviewStatus: "resubmission_requested" })],
    },
  ];

  assert.equal(countAdminProgressAttention(grouped), 1);
});

test("countClientProgressActions counts requested statuses in active phase only", () => {
  const reports: ProgressReport[] = [
    buildReport({ id: "report_1", phaseId: "phase_1", status: "requested" }),
    buildReport({ id: "report_2", phaseId: "phase_1", status: "resubmission_requested" }),
    buildReport({ id: "report_3", phaseId: "phase_1", status: "submitted" }),
    buildReport({ id: "report_4", phaseId: "phase_2", status: "requested" }),
  ];

  assert.equal(countClientProgressActions(reports, "phase_1"), 2);
});

test("chat unread counters separate client/admin directions", () => {
  const messages = [
    {
      clientId: "client_1",
      isClient: true,
      time: "2026-03-01T10:00:00.000Z",
    },
    {
      clientId: "client_1",
      isClient: false,
      time: "2026-03-01T10:05:00.000Z",
    },
    {
      clientId: "client_1",
      isClient: true,
      time: "2026-03-01T10:10:00.000Z",
    },
  ];

  assert.equal(
    countUnreadMessagesForAdminConversation(messages, "client_1", "2026-03-01T10:02:00.000Z"),
    1,
  );
  assert.equal(countUnreadMessagesForClient(messages, "client_1", "2026-03-01T10:02:00.000Z"), 1);
});
