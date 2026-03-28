import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const addFromTemplatesModalPath = path.resolve(
  serverDir,
  "../client/src/components/admin/AddFromTemplatesModal.tsx",
);
const templatePickerPanelPath = path.resolve(
  serverDir,
  "../client/src/components/admin/TemplatePickerPanel.tsx",
);
const sectionEditorCardPath = path.resolve(
  serverDir,
  "../client/src/components/admin/builder/SectionEditorCard.tsx",
);
const sessionEditorCardPath = path.resolve(
  serverDir,
  "../client/src/components/admin/builder/SessionEditorCard.tsx",
);
const templateBuilderPath = path.resolve(
  serverDir,
  "../client/src/pages/admin/TemplateBuilder.tsx",
);
const phaseBuilderPath = path.resolve(serverDir, "../client/src/pages/admin/PhaseBuilder.tsx");

test("shared add-from-template modal is folder-aware and uses picker panel", () => {
  const source = fs.readFileSync(addFromTemplatesModalPath, "utf8");

  assert.ok(source.includes("allLabel: string;"));
  assert.ok(source.includes("folderType: TemplateFolderType;"));
  assert.ok(source.includes("getTemplateFolderId?:"));
  assert.ok(source.includes("<TemplatePickerPanel"));
  assert.ok(source.includes("allLabel={allLabel}"));
  assert.ok(source.includes("folderType={folderType}"));
  assert.ok(source.includes("getTemplateFolderId={getTemplateFolderId}"));
});

test("template picker panel uses simplified category-root tree with nested folder filtering", () => {
  const source = fs.readFileSync(templatePickerPanelPath, "utf8");

  assert.ok(source.includes("rootLabel?: string;"));
  assert.ok(source.includes("defaultRootLabel(allLabel)"));
  assert.ok(source.includes("allLabel: string;"));
  assert.ok(source.includes("templateFoldersQuery(folderType)"));
  assert.ok(source.includes("selectedFolderId"));
  assert.ok(source.includes("rootFolders.map((folder) => renderFolderTree(folder, 1))"));
  assert.equal(source.includes(">Folders<"), false);
  assert.ok(source.includes("No templates found in this view."));
});

test("exercise and section insertion callsites provide folder-aware selector props", () => {
  const sectionEditorSource = fs.readFileSync(sectionEditorCardPath, "utf8");
  const sessionEditorSource = fs.readFileSync(sessionEditorCardPath, "utf8");

  assert.ok(sectionEditorSource.includes('allLabel="All Exercises"'));
  assert.ok(sectionEditorSource.includes('folderType="exercise"'));
  assert.ok(
    sectionEditorSource.includes("getTemplateFolderId={(item: any) => item.folderId ?? null}"),
  );

  assert.ok(sessionEditorSource.includes('allLabel="All Sections"'));
  assert.ok(sessionEditorSource.includes('folderType="section"'));
  assert.ok(
    sessionEditorSource.includes("getTemplateFolderId={(item: any) => item.folderId ?? null}"),
  );
});

test("session insertion in both phase builders is folder-aware", () => {
  const templateBuilderSource = fs.readFileSync(templateBuilderPath, "utf8");
  const phaseBuilderSource = fs.readFileSync(phaseBuilderPath, "utf8");

  assert.ok(templateBuilderSource.includes('allLabel="All Sessions"'));
  assert.ok(templateBuilderSource.includes('folderType="session"'));
  assert.ok(
    templateBuilderSource.includes("getTemplateFolderId={(item: any) => item.folderId ?? null}"),
  );

  assert.ok(phaseBuilderSource.includes('allLabel="All Sessions"'));
  assert.ok(phaseBuilderSource.includes('folderType="session"'));
  assert.ok(
    phaseBuilderSource.includes("getTemplateFolderId={(item: any) => item.folderId ?? null}"),
  );
});

test("phase insertion dialog uses folder-aware phase picker", () => {
  const source = fs.readFileSync(phaseBuilderPath, "utf8");

  assert.ok(source.includes('allLabel="All Phases"'));
  assert.ok(source.includes('folderType="phase"'));
  assert.ok(source.includes('searchPlaceholder="Search phase templates..."'));
  assert.ok(source.includes("selectedTemplateId={selectedTemplateId || null}"));
  assert.ok(source.includes("onSelectTemplate={(item: any) => setSelectedTemplateId(item.id)}"));
});
