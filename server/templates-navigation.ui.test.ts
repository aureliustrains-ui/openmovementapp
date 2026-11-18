import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const templatesPagePath = path.resolve(serverDir, "../client/src/pages/admin/Templates.tsx");
const libraryPanePath = path.resolve(
  serverDir,
  "../client/src/components/admin/TemplateListPane.tsx",
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
  assert.ok(source.includes('label: "Phases"'));
  assert.ok(source.includes('label: "Sessions"'));
  assert.ok(source.includes('label: "Sections"'));
  assert.ok(source.includes('label: "Exercises"'));
  assert.ok(source.includes("<TemplateListPane"));
  assert.ok(source.includes("onOpenTemplate={(item) => setOpenSectionId(item.id)}"));
  assert.ok(source.includes("<ExerciseLibrary"));
  assert.ok(
    source.includes("setActiveTabWithPersistence(category.tab, { resetFolder: true })"),
    "Category click should set active template category and reset to root view",
  );
  assert.ok(
    source.includes("buildTemplatesUrl(activeTab, folderId)"),
    "Template navigation should preserve tab/folder location in URL state",
  );
});

test("folders are navigated from the content area and the exercise chip bar, not a sidebar", () => {
  const source = fs.readFileSync(libraryPanePath, "utf8");
  const exerciseSource = fs.readFileSync(
    path.resolve(serverDir, "../client/src/components/admin/exercise/ExerciseLibrary.tsx"),
    "utf8",
  );

  assert.ok(exerciseSource.includes("<FolderChipBar"));
  assert.ok(source.includes("<FolderChipBar"));
  assert.equal(source.includes("Uncategorized"), false);
  assert.equal(source.includes("__uncategorized__"), false);
});

test("template list rows open on click and keep actions in a menu", () => {
  const source = fs.readFileSync(libraryPanePath, "utf8");

  assert.ok(source.includes("onClick={() => open(item)}"));
  assert.ok(source.includes('aria-label="More actions"'));
  assert.ok(source.includes("Move to folder"));
  assert.equal(source.includes("window.prompt"), false);
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
