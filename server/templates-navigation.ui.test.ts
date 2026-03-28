import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const templatesPagePath = path.resolve(serverDir, "../client/src/pages/admin/Templates.tsx");
const libraryPanePath = path.resolve(
  serverDir,
  "../client/src/components/admin/TemplateLibraryPane.tsx",
);
const phaseEditorPath = path.resolve(serverDir, "../client/src/pages/admin/TemplateBuilder.tsx");
const sessionEditorPath = path.resolve(
  serverDir,
  "../client/src/pages/admin/SessionTemplateEditor.tsx",
);
const sectionEditorPath = path.resolve(
  serverDir,
  "../client/src/pages/admin/SectionTemplateEditor.tsx",
);
const exerciseEditorPath = path.resolve(
  serverDir,
  "../client/src/pages/admin/ExerciseTemplateEditor.tsx",
);

test("template category tabs remain clickable and preserve explicit tab context", () => {
  const source = fs.readFileSync(templatesPagePath, "utf8");

  assert.ok(source.includes('<TabsTrigger\n                value="phases"'));
  assert.ok(source.includes('<TabsTrigger\n                value="sessions"'));
  assert.ok(source.includes('<TabsTrigger\n                value="sections"'));
  assert.ok(source.includes('<TabsTrigger\n                value="exercises"'));
  assert.ok(
    source.includes("setActiveTab(next);"),
    "Tab click handler should set local active tab state immediately",
  );
  assert.ok(
    source.includes("setLocation(`/app/admin/templates${tabToQueryParam(next)}`);"),
    "Tab click handler should keep URL context for navigation persistence",
  );
});

test("template library sidebar uses All + Folders model without visible Uncategorized entry", () => {
  const source = fs.readFileSync(libraryPanePath, "utf8");

  assert.ok(source.includes("allLabel"));
  assert.ok(source.includes(">Folders<"));
  assert.ok(source.includes("Remove from folder"));
  assert.equal(
    source.includes("Uncategorized"),
    false,
    "Uncategorized should not be rendered as a visible sidebar item/folder",
  );
  assert.equal(source.includes("__uncategorized__"), false);
});

test("template editors route back to the correct template category tab", () => {
  const phaseEditorSource = fs.readFileSync(phaseEditorPath, "utf8");
  const sessionEditorSource = fs.readFileSync(sessionEditorPath, "utf8");
  const sectionEditorSource = fs.readFileSync(sectionEditorPath, "utf8");
  const exerciseEditorSource = fs.readFileSync(exerciseEditorPath, "utf8");

  assert.ok(phaseEditorSource.includes('backHref="/app/admin/templates?tab=phases"'));
  assert.ok(sessionEditorSource.includes('backHref="/app/admin/templates?tab=sessions"'));
  assert.ok(sectionEditorSource.includes('backHref="/app/admin/templates?tab=sections"'));
  assert.ok(exerciseEditorSource.includes('backHref="/app/admin/templates?tab=exercises"'));
});
