import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const sessionViewPath = path.resolve(serverDir, "../client/src/pages/client/SessionView.tsx");

test("session view removes fake per-exercise check UI", () => {
  const source = fs.readFileSync(sessionViewPath, "utf8");

  assert.equal(
    source.includes("completedExercises"),
    false,
    "Session view should not keep fake completedExercises state",
  );
  assert.equal(
    source.includes("button-toggle-"),
    false,
    "Session view should not render per-exercise completion toggle buttons",
  );
});

test("session view renders compact exercise rows with collapsible details", () => {
  const source = fs.readFileSync(sessionViewPath, "utf8");

  assert.ok(source.includes("expandedExerciseIds"));
  assert.ok(source.includes("button-exercise-details-"));
  assert.ok(source.includes("formatExercisePrescription"));
  assert.ok(source.includes("sectionLetterForIndex(sectionIdx)"));
  assert.equal(
    source.includes('exercise{section.exercises.length === 1 ? "" : "s"}'),
    false,
    "Section headers should stay clean without exercise counts",
  );
  assert.equal(
    source.includes('{inlineVideo ? <Video className="h-4 w-4" /> : null}'),
    false,
    "Collapsed exercise rows should not show a separate video icon",
  );
  assert.ok(source.includes("button-personal-notes-logs-"));
  assert.ok(source.includes("<ExerciseStandardDetails"));
  assert.ok(source.includes("integrated"));
  assert.ok(source.includes("Session notes"));
  assert.ok(source.includes("Reps, weight, effort, or quick notes"));
  assert.equal(
    source.includes("button-details-"),
    false,
    "Former Specifics chevron/dropdown trigger should be removed",
  );
  assert.equal(
    source.includes("Specifics"),
    false,
    "Specifics heading should not be visibly rendered in session cards",
  );
  assert.equal(
    source.includes("Personal Notes &amp; Logs"),
    false,
    "Legacy accordion label should be removed",
  );
});

test("session view labels past exercise notes with saved log dates when available", () => {
  const source = fs.readFileSync(sessionViewPath, "utf8");

  assert.ok(source.includes("date: matchingLog?.date || undefined"));
  assert.ok(source.includes('weekday: "long"'));
  assert.ok(source.includes('month: "long"'));
  assert.ok(source.includes("return `${h.day} · Week ${h.week}`"));
});

test("session view renders embedded video inside opened exercise details", () => {
  const source = fs.readFileSync(sessionViewPath, "utf8");

  assert.ok(source.includes("data-testid={`inline-video-${ex.id}`}"));
  assert.ok(source.includes("<iframe"));
  assert.ok(source.includes("<CollapsibleContent>"));
  assert.equal(
    source.includes("button-view-video-"),
    false,
    "Session view should not hide video behind a watch-video toggle button",
  );
});

test("session view keeps desktop section rail while removing mobile section jump chrome", () => {
  const source = fs.readFileSync(sessionViewPath, "utf8");

  assert.ok(source.includes('data-testid="rail-session-sections-desktop"'));
  assert.equal(
    source.includes('data-testid="list-session-sections-mobile"'),
    false,
    "Session view should not render the removed mobile section jump list",
  );
  assert.ok(
    source.includes("lg:max-w-6xl"),
    "Desktop session container should allow wider content area while keeping mobile unchanged",
  );
  assert.ok(
    source.includes("lg:grid-cols-[180px_minmax(0,1fr)]"),
    "Desktop session rail should stay present with slimmer width to free main content space",
  );
  assert.ok(source.includes("selectedSectionId"));
  assert.ok(source.includes("button-section-rail-"));
  assert.equal(
    source.includes("button-section-list-"),
    false,
    "Session view should not keep legacy mobile section list buttons",
  );
  assert.equal(
    source.includes("button-section-pill-"),
    false,
    "Mobile horizontal section pills should not exist",
  );
  assert.equal(
    source.includes("overflow-x"),
    false,
    "Mobile section list should not rely on horizontal scrolling",
  );
});

test("session view supports section jump navigation with anchors", () => {
  const source = fs.readFileSync(sessionViewPath, "utf8");

  assert.ok(source.includes("jumpToSection"));
  assert.ok(source.includes('scrollIntoView({ behavior: "smooth", block: "start" })'));
  assert.ok(source.includes("id={`section-${section.id}`}"));
});
