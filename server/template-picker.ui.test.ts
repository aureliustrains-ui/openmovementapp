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
const templateLibraryPanePath = path.resolve(
  serverDir,
  "../client/src/components/admin/TemplateLibraryPane.tsx",
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
const templatesPagePath = path.resolve(serverDir, "../client/src/pages/admin/Templates.tsx");
const exerciseTemplateEditorPath = path.resolve(
  serverDir,
  "../client/src/pages/admin/ExerciseTemplateEditor.tsx",
);
const phaseBuilderPath = path.resolve(serverDir, "../client/src/pages/admin/PhaseBuilder.tsx");
const saveToTemplateDialogPath = path.resolve(
  serverDir,
  "../client/src/components/admin/SaveToTemplateDialog.tsx",
);
const templateEditorHeaderPath = path.resolve(
  serverDir,
  "../client/src/components/admin/TemplateEditorHeader.tsx",
);
const autosaveHookPath = path.resolve(serverDir, "../client/src/hooks/useAutosave.ts");

test("shared exercise editor renders compact rows with expandable details", () => {
  const source = fs.readFileSync(sectionEditorCardPath, "utf8");

  assert.ok(source.includes("expandedExerciseIds"));
  assert.ok(source.includes("button-expand-exercise-"));
  assert.ok(source.includes("data-testid={`exercise-details-${ex.id}`}"));
  assert.ok(source.includes("grid grid-cols-[auto_auto_minmax(0,1fr)_auto]"));
  assert.ok(source.includes("Move to section"));
  assert.ok(source.includes("Duplicate exercise"));
  assert.ok(source.includes("application/openmovement-builder"));
  assert.ok(source.includes("onMoveExerciseToIndex"));
  assert.ok(source.includes("sectionLetterForIndex"));
  assert.ok(source.includes("formatPrescription"));
});

test("shared session editor exposes duplicate actions for sessions and sections", () => {
  const sessionSource = fs.readFileSync(sessionEditorCardPath, "utf8");
  const sectionSource = fs.readFileSync(sectionEditorCardPath, "utf8");

  assert.ok(sessionSource.includes("onDuplicateSession?:"));
  assert.ok(sessionSource.includes("onSaveSessionToTemplate?:"));
  assert.ok(sessionSource.includes("onSaveSectionToTemplate?:"));
  assert.ok(sessionSource.includes("onSaveExerciseToTemplate?:"));
  assert.ok(sessionSource.includes("onMoveSessionToIndex?:"));
  assert.ok(sessionSource.includes('type: "session"'));
  assert.ok(sessionSource.includes("Move session up"));
  assert.ok(sessionSource.includes("Move session down"));
  assert.ok(sessionSource.includes("onDuplicateSection"));
  assert.ok(sessionSource.includes("Duplicate session"));
  assert.ok(sessionSource.includes("Save session as template"));
  assert.ok(sectionSource.includes("Duplicate section"));
  assert.ok(sectionSource.includes("Save section as template"));
  assert.ok(sectionSource.includes("Save exercise as template"));
  assert.ok(sessionSource.includes("detailsOpen"));
  assert.ok(sessionSource.includes("dropExerciseFromSection"));
});

test("phase builder can save current builder items into template folders", () => {
  const phaseBuilderSource = fs.readFileSync(phaseBuilderPath, "utf8");
  const dialogSource = fs.readFileSync(saveToTemplateDialogPath, "utf8");

  assert.ok(phaseBuilderSource.includes("TemplateSaveTarget"));
  assert.ok(phaseBuilderSource.includes('setTemplateSaveTarget({ type: "phase" })'));
  assert.ok(phaseBuilderSource.includes("SaveToTemplateDialog"));
  assert.ok(phaseBuilderSource.includes("createExerciseTemplate.mutateAsync"));
  assert.ok(phaseBuilderSource.includes("createSectionTemplate.mutateAsync"));
  assert.ok(phaseBuilderSource.includes("createSessionTemplate.mutateAsync"));
  assert.ok(phaseBuilderSource.includes("createPhaseTemplate.mutateAsync"));
  assert.ok(dialogSource.includes("templateFoldersQuery(type)"));
  assert.ok(dialogSource.includes('onSave(folderValue === "root" ? null : folderValue)'));
});

test("template editors expose delayed autosave status", () => {
  const hookSource = fs.readFileSync(autosaveHookPath, "utf8");
  const headerSource = fs.readFileSync(templateEditorHeaderPath, "utf8");
  const exerciseEditorSource = fs.readFileSync(exerciseTemplateEditorPath, "utf8");
  const templateBuilderSource = fs.readFileSync(templateBuilderPath, "utf8");

  assert.ok(hookSource.includes("delayMs = 30_000"));
  assert.ok(hookSource.includes("lastSavedSnapshotRef"));
  assert.ok(headerSource.includes("autosaveStatus?: AutosaveStatus"));
  assert.ok(headerSource.includes("Autosaving..."));
  assert.ok(exerciseEditorSource.includes("useAutosave"));
  assert.ok(templateBuilderSource.includes("useAutosave"));
});

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
  assert.ok(source.includes("No templates found."));
});

test("template search is global and ranked by name before tags", () => {
  const pickerSource = fs.readFileSync(templatePickerPanelPath, "utf8");
  const librarySource = fs.readFileSync(templateLibraryPanePath, "utf8");
  const templatesSource = fs.readFileSync(templatesPagePath, "utf8");
  const exerciseEditorSource = fs.readFileSync(exerciseTemplateEditorPath, "utf8");

  assert.ok(pickerSource.includes("Searching all folders"));
  assert.ok(pickerSource.includes("getTemplateSearchText"));
  assert.ok(pickerSource.includes("name.startsWith(normalizedSearch)"));
  assert.ok(librarySource.includes("getTemplateSearchText"));
  assert.ok(librarySource.includes("name.startsWith(normalizedSearch)"));
  assert.ok(templatesSource.includes("renderSectionTemplatePreview"));
  assert.ok(templatesSource.includes("renderExerciseTemplatePreview"));
  assert.ok(templatesSource.includes("ExerciseTemplateInlineDetails"));
  assert.ok(
    templatesSource.includes(
      "renderTemplateDetails={(item) => <ExerciseTemplateInlineDetails item={item} />}",
    ),
  );
  assert.ok(templatesSource.includes('layout="rows"'));
  assert.ok(templatesSource.includes("No tags"));
  assert.ok(exerciseEditorSource.includes("<Label>Tags</Label>"));
});

test("exercise and section insertion callsites provide folder-aware selector props", () => {
  const sectionEditorSource = fs.readFileSync(sectionEditorCardPath, "utf8");
  const sessionEditorSource = fs.readFileSync(sessionEditorCardPath, "utf8");

  assert.ok(sectionEditorSource.includes('allLabel="All Exercises"'));
  assert.ok(sectionEditorSource.includes('folderType="exercise"'));
  assert.ok(
    sectionEditorSource.includes('getTemplateSearchText={(item: any) => item.targetMuscle || ""}'),
  );
  assert.ok(
    sectionEditorSource.includes("getTemplateFolderId={(item: any) => item.folderId ?? null}"),
  );

  assert.ok(sessionEditorSource.includes('allLabel="All Sections"'));
  assert.ok(sessionEditorSource.includes('folderType="section"'));
  assert.ok(sessionEditorSource.includes("getTemplateSearchText={(item: any) =>"));
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

test("phase builders schedule selected week first and support week-specific forks", () => {
  const templateBuilderSource = fs.readFileSync(templateBuilderPath, "utf8");
  const phaseBuilderSource = fs.readFileSync(phaseBuilderPath, "utf8");

  assert.ok(phaseBuilderSource.includes("week: selectedWeek"));
  assert.ok(templateBuilderSource.includes("week: selectedWeek"));
  assert.ok(phaseBuilderSource.includes("makeScheduleEntryWeekSpecific"));
  assert.ok(templateBuilderSource.includes("makeScheduleEntryWeekSpecific"));
  assert.ok(phaseBuilderSource.includes("Sessions stay linked until you make a week separate"));
  assert.ok(phaseBuilderSource.includes("You have unsaved builder changes. Leave without saving?"));
});

test("client phase builder saves dirty drafts before returning to client profile", () => {
  const phaseBuilderSource = fs.readFileSync(phaseBuilderPath, "utf8");

  assert.ok(phaseBuilderSource.includes("const handleBackToClient = async () =>"));
  assert.ok(phaseBuilderSource.includes("await saveDraft({ silent: true })"));
  assert.ok(phaseBuilderSource.includes("autosave.markSaved()"));
  assert.ok(phaseBuilderSource.includes("The draft could not be saved. Leave without saving"));
  assert.ok(phaseBuilderSource.includes("queryClient.setQueryData(phasesQuery.queryKey"));
  assert.ok(phaseBuilderSource.includes("queryClient.setQueryData(phaseQuery(phaseId).queryKey"));
  assert.ok(
    phaseBuilderSource.includes("queryClient.setQueryData(sessionsByPhaseQuery(phaseId).queryKey"),
  );
});

test("client phase builder asks before editing shared sessions across weeks", () => {
  const phaseBuilderSource = fs.readFileSync(phaseBuilderPath, "utf8");

  assert.ok(phaseBuilderSource.includes("usedThisWeek"));
  assert.ok(phaseBuilderSource.includes("usedInOtherWeeks"));
  assert.ok(phaseBuilderSource.includes("sharedEditDecisions"));
  assert.ok(phaseBuilderSource.includes("OK = make Week ${selectedWeek} separate"));
  assert.ok(phaseBuilderSource.includes("Cancel = edit all weeks"));
  assert.ok(phaseBuilderSource.includes('existingDecision === "all"'));
  assert.ok(phaseBuilderSource.includes("Week ${selectedWeek} is separate now"));
  assert.ok(phaseBuilderSource.includes("next.splice(sessionIdx + 1, 0, sourceSession)"));
  assert.ok(
    phaseBuilderSource.includes(
      "entry.week === selectedWeek && entry.sessionId === sourceSessionId",
    ),
  );
  assert.ok(phaseBuilderSource.includes("{ ...entry, sessionId: updatedCopy.id }"));
});

test("client phase builder exposes home and guide video fields", () => {
  const phaseBuilderSource = fs.readFileSync(phaseBuilderPath, "utf8");

  assert.ok(phaseBuilderSource.includes("homeIntroVideoUrl"));
  assert.ok(phaseBuilderSource.includes("homeGuideVideoUrl"));
  assert.ok(phaseBuilderSource.includes('data-testid="input-phase-home-video"'));
  assert.ok(phaseBuilderSource.includes('data-testid="input-phase-guide-video"'));
});

test("phase insertion dialog uses folder-aware phase picker", () => {
  const source = fs.readFileSync(phaseBuilderPath, "utf8");

  assert.ok(source.includes('allLabel="All Phases"'));
  assert.ok(source.includes('folderType="phase"'));
  assert.ok(source.includes('searchPlaceholder="Search phase templates..."'));
  assert.ok(source.includes("selectedTemplateId={selectedTemplateId || null}"));
  assert.ok(source.includes("onSelectTemplate={(item: any) => setSelectedTemplateId(item.id)}"));
});
