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
  const paneSource = fs.readFileSync(libraryPanePath, "utf8");

  assert.ok(source.includes('label: "Phases"'));
  assert.ok(source.includes('label: "Sessions"'));
  assert.ok(source.includes('label: "Sections"'));
  assert.ok(source.includes('label: "Exercises"'));
  assert.ok(source.includes('rootLabel="Phases"'));
  assert.ok(source.includes('rootLabel="Sessions"'));
  assert.ok(source.includes('rootLabel="Sections"'));
  assert.ok(source.includes('rootLabel="Exercises"'));
  assert.ok(
    source.includes("setActiveTabWithPersistence(categoryId, { resetFolder: true })"),
    "Category click should set active template category and reset to root view",
  );
  assert.ok(
    source.includes("activeCategoryId={activeTab}"),
    "Active category should be passed into the shared library pane",
  );
  assert.ok(
    paneSource.includes("categoryItems") && paneSource.includes("onSelectCategory"),
    "Template library pane should render categories and tree in one sidebar surface",
  );
  assert.ok(
    source.includes("buildTemplatesUrl(activeTab, folderId)"),
    "Template navigation should preserve tab/folder location in URL state",
  );
});

test("template library sidebar uses category-as-root tree without Uncategorized", () => {
  const source = fs.readFileSync(libraryPanePath, "utf8");

  assert.ok(source.includes("rootNodeLabel"));
  assert.ok(
    source.includes("const rootFolders = childrenByParent.get(folderParentKey(null)) || [];"),
  );
  assert.ok(source.includes("setRootExpanded((prev) => !prev)"));
  assert.ok(source.includes("rootFolders.map((rootFolder) => renderFolderTree(rootFolder, 1))"));
  assert.equal(source.includes('truncate font-medium">{allLabel}'), false);
  assert.ok(source.includes("selectedFolderPath.map"));
  assert.equal(
    source.includes("Uncategorized"),
    false,
    "Uncategorized should not be rendered as a visible sidebar item/folder",
  );
  assert.equal(source.includes("__uncategorized__"), false);
});

test("template content pane stays uncluttered and relies on visual hierarchy", () => {
  const source = fs.readFileSync(libraryPanePath, "utf8");

  assert.equal(source.includes(">Folders</p>"), false);
  assert.equal(source.includes(">Templates</p>"), false);
  assert.equal(source.includes("child folder"), false);
  assert.equal(source.includes("Move to</label>"), false);
  assert.ok(source.includes("selectedFolderPath.map"));
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
