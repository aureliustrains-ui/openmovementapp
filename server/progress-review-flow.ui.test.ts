import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const sessionViewPath = path.resolve(serverDir, "../client/src/pages/client/SessionView.tsx");
const myPhasePath = path.resolve(serverDir, "../client/src/pages/client/MyPhase.tsx");
const homePath = path.resolve(serverDir, "../client/src/pages/client/Home.tsx");
const progressReportPath = path.resolve(serverDir, "../client/src/pages/client/ProgressReport.tsx");
const clientProfilePath = path.resolve(serverDir, "../client/src/pages/admin/ClientProfile.tsx");
const reviewSubmissionRowPath = path.resolve(
  serverDir,
  "../client/src/components/admin/review/ReviewSubmissionRow.tsx",
);
const exerciseStandardDetailsPath = path.resolve(
  serverDir,
  "../client/src/components/client/ExerciseStandardDetails.tsx",
);

test("standard exercise details renderer is reused across plan, movement check, and progress report flows", () => {
  const sessionViewSource = fs.readFileSync(sessionViewPath, "utf8");
  const myPhaseSource = fs.readFileSync(myPhasePath, "utf8");
  const progressReportSource = fs.readFileSync(progressReportPath, "utf8");

  assert.ok(
    sessionViewSource.includes(
      'import { ExerciseStandardDetails } from "@/components/client/ExerciseStandardDetails";',
    ),
    "Session view should import the shared exercise details component",
  );
  assert.ok(
    myPhaseSource.includes(
      'import { ExerciseStandardDetails } from "@/components/client/ExerciseStandardDetails";',
    ),
    "Movement check flow should import the shared exercise details component",
  );
  assert.ok(
    progressReportSource.includes(
      'import { ExerciseStandardDetails } from "@/components/client/ExerciseStandardDetails";',
    ),
    "Progress report flow should import the shared exercise details component",
  );
  assert.ok(sessionViewSource.includes("<ExerciseStandardDetails"));
  assert.ok(myPhaseSource.includes("<ExerciseStandardDetails"));
  assert.ok(progressReportSource.includes("<ExerciseStandardDetails"));
  assert.ok(
    progressReportSource.includes("Achieved parameters"),
    "Progress report submission should label the client field as Achieved parameters",
  );
  assert.ok(
    progressReportSource.includes(
      "<ExerciseStandardDetails exercise={{ ...exercise, name }} showName={false} />",
    ),
    "Progress report should render one exercise title/header and avoid duplicate in details block",
  );
  assert.ok(
    progressReportSource.includes("Describe achieved parameters for each movement."),
    "Progress report should include concise movement-focused helper text",
  );
});

test("client action cards are surfaced on Home while Plan stays schedule-focused", () => {
  const homeSource = fs.readFileSync(homePath, "utf8");
  const myPhaseSource = fs.readFileSync(myPhasePath, "utf8");

  assert.ok(
    homeSource.includes('import { ActionRequiredCard } from "@/components/client/ActionRequiredCard";'),
    "Home should use shared ActionRequiredCard entries for due items",
  );
  assert.ok(
    homeSource.includes('testId="card-home-weekly-checkin"'),
    "Home should expose the weekly check-in action card",
  );
  assert.ok(
    homeSource.includes('testId="card-home-progress-update"'),
    "Home should expose the progress update action card",
  );
  assert.ok(
    homeSource.includes('testId="card-home-movement-check"'),
    "Home should expose the movement-check action card",
  );
  assert.equal(
    myPhaseSource.includes('testId="card-home-weekly-checkin"'),
    false,
    "Plan should not duplicate Home check-in action cards",
  );
});

test("admin movement and progress report tabs use grouped data with shared review rows", () => {
  const source = fs.readFileSync(clientProfilePath, "utf8");

  assert.ok(
    source.includes("movementCheckGroups.map"),
    "Movement checks should render from grouped API data",
  );
  assert.ok(
    source.includes("progressReportGroups.map"),
    "Progress reports should render from grouped API data",
  );
  assert.ok(
    source.includes("<ReviewSubmissionRow"),
    "Both review tabs should use the shared review row component",
  );
  assert.ok(
    source.includes("button-progress-approve-"),
    "Progress report tab should support approve action like movement checks",
  );
  assert.ok(
    source.includes("button-progress-resubmit-"),
    "Progress report tab should support resubmission action like movement checks",
  );
  assert.equal(
    source.includes("selectedMovementPhase"),
    false,
    "Legacy selected-phase movement UI should be removed",
  );
});

test("movement and progress report use inline embedded playback instead of raw-link primary UI", () => {
  const progressSource = fs.readFileSync(progressReportPath, "utf8");
  const reviewRowSource = fs.readFileSync(reviewSubmissionRowPath, "utf8");
  const exerciseDetailsSource = fs.readFileSync(exerciseStandardDetailsPath, "utf8");

  assert.ok(
    progressSource.includes(
      'import { InlineVideoPlayer } from "@/components/client/InlineVideoPlayer";',
    ),
    "Progress report page should use shared inline player for submission playback",
  );
  assert.ok(
    progressSource.includes("Submission video"),
    "Progress report read-only view should label the section as submission video",
  );
  assert.ok(
    reviewRowSource.includes("<InlineVideoPlayer"),
    "Shared review rows should embed videos inline",
  );
  assert.equal(
    reviewRowSource.includes("Watch Video"),
    false,
    "Review rows should no longer rely on raw watch-link buttons as the main video UI",
  );
  assert.ok(
    exerciseDetailsSource.includes("<InlineVideoPlayer"),
    "Exercise details should inline-embed demo videos where available",
  );
});
