import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Search,
  Trash2,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUpdateExerciseTemplate, type TemplateFolder } from "@/lib/api";
import { formatReps, formatSets } from "@/lib/prescription";
import {
  ExerciseFacetFilterBar,
  isFacetFilterActive,
} from "@/components/admin/ExerciseFacetFilterBar";
import { FolderChipBar } from "@/components/admin/FolderChipBar";
import { ExerciseLibraryTags } from "@/components/admin/ExerciseLibraryTags";
import {
  ExerciseFieldsEditor,
  toExerciseEditableFields,
  type ExerciseEditableFields,
} from "@/components/admin/exercise/ExerciseFieldsEditor";
import { ExerciseClientPreview } from "@/components/admin/exercise/ExerciseClientPreview";
import {
  facetLabel,
  matchesFacetFilter,
  readExerciseFacets,
  type ExerciseFacetFilter,
} from "@shared/exerciseFacets";
import { exerciseStandardToPayload } from "@/lib/exerciseStandard";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isOwnerRole } from "@/lib/roles";
import { staffQuery } from "@/lib/api";

type ExerciseItem = {
  id: string;
  name: string;
  folderId: string | null;
  sortOrder?: number;
  [key: string]: any;
};

type Props = {
  exercises: ExerciseItem[];
  folders: TemplateFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  isLoading?: boolean;
  onCreateExercise: (folderId: string | null) => Promise<string | void>;
  onDuplicateExercise: (item: ExerciseItem) => Promise<string | void>;
  onDeleteExercise: (item: ExerciseItem) => Promise<boolean | void>;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveExercise: (exerciseId: string, folderId: string | null) => void;
  onReorderExercises: (
    items: Array<{ id: string; sortOrder: number; folderId: string | null }>,
  ) => void;
};

const SELECTED_KEY = "admin.exerciseLibrary.selectedId";

function sortBySortOrder<T extends { sortOrder?: number; name: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
  );
}

function tagSummary(item: ExerciseItem): string {
  const facets = readExerciseFacets(item.facets);
  return [...facets.pattern, ...facets.material].map(facetLabel).join(" · ");
}

function prescriptionSummary(item: ExerciseItem): string {
  return [formatSets(item.sets), formatReps(item.reps, (item as any).repsMode), item.tempo?.trim() || null]
    .filter(Boolean)
    .join(" · ");
}

export function ExerciseLibrary({
  exercises,
  folders,
  selectedFolderId,
  onSelectFolder,
  isLoading = false,
  onCreateExercise,
  onDuplicateExercise,
  onDeleteExercise,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveExercise,
  onReorderExercises,
}: Props) {
  const [search, setSearch] = useState("");
  // "all", "mine", or the id of one person.
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const { sessionUser } = useAuth();
  const { data: staff = [] } = useQuery(staffQuery);
  const meIsOwner = isOwnerRole(sessionUser?.role);
  const ownerName = staff.find((member) => member.role === "Owner")?.name ?? "Owner";
  const authorNameOf = (item: ExerciseItem): string => {
    if (!item.createdBy) return ownerName;
    return staff.find((member) => member.id === item.createdBy)?.name ?? "A coach";
  };
  const ownerId = staff.find((member) => member.role === "Owner")?.id ?? "__owner__";
  const authorIdOf = (item: ExerciseItem): string => item.createdBy || ownerId;
  const isMineItem = (item: ExerciseItem): boolean =>
    item.createdBy ? item.createdBy === sessionUser?.id : meIsOwner;
  // The owner may change everything; a coach only what they added.
  const canEditItem = (item: ExerciseItem): boolean => meIsOwner || isMineItem(item);
  const [facetFilter, setFacetFilter] = useState<ExerciseFacetFilter>({});
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(SELECTED_KEY);
    } catch {
      return null;
    }
  });

  const [sheetOpen, setSheetOpen] = useState(false);

  const selectExercise = (id: string | null) => {
    setSelectedId(id);
    setSheetOpen(Boolean(id));
    try {
      if (id) window.localStorage.setItem(SELECTED_KEY, id);
      else window.localStorage.removeItem(SELECTED_KEY);
    } catch {
      // Remembering the selection is only a convenience.
    }
  };

  // ---- folders ---------------------------------------------------------------------------
  const sortedFolders = useMemo(
    () =>
      [...folders].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
      ),
    [folders],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, TemplateFolder[]>();
    for (const folder of sortedFolders) {
      const key = folder.parentId ?? "__root__";
      map.set(key, [...(map.get(key) || []), folder]);
    }
    return map;
  }, [sortedFolders]);
  const foldersById = useMemo(
    () => new Map(sortedFolders.map((folder) => [folder.id, folder])),
    [sortedFolders],
  );
  const descendantIds = useCallback(
    (folderId: string): Set<string> => {
      const result = new Set<string>([folderId]);
      const queue = [folderId];
      while (queue.length) {
        const current = queue.shift() as string;
        for (const child of childrenByParent.get(current) || []) {
          result.add(child.id);
          queue.push(child.id);
        }
      }
      return result;
    },
    [childrenByParent],
  );
  const folderPath = useCallback(
    (folderId: string | null): string => {
      const names: string[] = [];
      let current = folderId ? foldersById.get(folderId) : undefined;
      while (current) {
        names.unshift(current.name);
        current = current.parentId ? foldersById.get(current.parentId) : undefined;
      }
      return names.join(" / ");
    },
    [foldersById],
  );
  const countInFolder = useCallback(
    (folderId: string) => {
      const ids = descendantIds(folderId);
      return exercises.filter((item) => item.folderId && ids.has(item.folderId)).length;
    },
    [descendantIds, exercises],
  );

  // Keep the selected folder's ancestors open.
  useEffect(() => {
    if (!selectedFolderId) return;
    setExpandedFolderIds((previous) => {
      const next = new Set(previous);
      let current = foldersById.get(selectedFolderId);
      while (current?.parentId) {
        next.add(current.parentId);
        current = foldersById.get(current.parentId);
      }
      return next;
    });
  }, [foldersById, selectedFolderId]);

  // ---- list ------------------------------------------------------------------------------
  const normalizedSearch = search.trim().toLowerCase();
  const filtersActive = isFacetFilterActive(facetFilter);
  const searchingAll = normalizedSearch.length > 0 || filtersActive || authorFilter !== "all";

  // One chip per other person who has added exercises: first name, or the full name when two
  // people share a first name.
  const authorChips = useMemo(() => {
    const ids = new Set<string>();
    for (const item of exercises) ids.add(item.createdBy || ownerId);
    if (sessionUser?.id) ids.delete(sessionUser.id);
    if (meIsOwner) ids.delete(ownerId);
    const people = Array.from(ids).map((id) => ({
      id,
      full: staff.find((member) => member.id === id)?.name ?? "A coach",
    }));
    const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;
    return people
      .map((person) => ({
        id: person.id,
        label:
          people.filter((other) => firstName(other.full) === firstName(person.full)).length > 1
            ? person.full
            : firstName(person.full),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, staff, sessionUser?.id, meIsOwner, ownerId]);

  const visibleExercises = useMemo(() => {
    let items = exercises;
    if (authorFilter === "mine") items = items.filter((item) => isMineItem(item));
    if (authorFilter !== "all" && authorFilter !== "mine") {
      items = items.filter((item) => authorIdOf(item) === authorFilter);
    }
    if (!searchingAll && selectedFolderId) {
      const ids = descendantIds(selectedFolderId);
      items = items.filter((item) => item.folderId && ids.has(item.folderId));
    }
    if (filtersActive) items = items.filter((item) =>
        matchesFacetFilter(item as { facets?: unknown; needsVideo?: boolean }, facetFilter),
      );
    if (normalizedSearch) {
      items = items.filter((item) => {
        const keywords = Array.isArray(item.keywords) ? item.keywords.join(" ") : "";
        const haystack = `${item.name} ${tagSummary(item)} ${keywords}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
      return [...items].sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(normalizedSearch) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(normalizedSearch) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      });
    }
    return sortBySortOrder(items);
  }, [
    descendantIds,
    exercises,
    facetFilter,
    filtersActive,
    normalizedSearch,
    searchingAll,
    selectedFolderId,
    authorFilter,
    sessionUser?.id,
    meIsOwner,
    ownerId,
  ]);

  // Manual order only makes sense inside one folder without search or filters.
  const directFolderItems = useMemo(
    () =>
      sortBySortOrder(exercises.filter((item) => (item.folderId ?? null) === selectedFolderId)),
    [exercises, selectedFolderId],
  );
  const canReorder = meIsOwner && !searchingAll && selectedFolderId !== null;
  const move = (itemId: string, offset: -1 | 1) => {
    const index = directFolderItems.findIndex((item) => item.id === itemId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= directFolderItems.length) return;
    const next = [...directFolderItems];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onReorderExercises(
      next.map((item, sortOrder) => ({ id: item.id, sortOrder, folderId: item.folderId ?? null })),
    );
  };

  const selected = exercises.find((item) => item.id === selectedId) || null;

  // ---- render helpers --------------------------------------------------------------------
  const renderFolder = (folder: TemplateFolder, depth: number) => {
    const children = childrenByParent.get(folder.id) || [];
    const expanded = expandedFolderIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    return (
      <div key={folder.id}>
        <div
          className={`group flex items-center gap-1 rounded-md pr-1 text-sm ${
            isSelected ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          <button
            type="button"
            className={`h-6 w-5 shrink-0 ${children.length ? "" : "invisible"}`}
            onClick={() =>
              setExpandedFolderIds((previous) => {
                const next = new Set(previous);
                if (next.has(folder.id)) next.delete(folder.id);
                else next.add(folder.id);
                return next;
              })
            }
            aria-label={expanded ? "Collapse folder" : "Expand folder"}
          >
            {expanded ? (
              <ChevronDown className="mx-auto h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="mx-auto h-3.5 w-3.5" />
            )}
          </button>
          {renamingFolderId === folder.id ? (
            <Input
              autoFocus
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              onBlur={() => {
                const name = renameDraft.trim();
                if (name && name !== folder.name) onRenameFolder(folder.id, name);
                setRenamingFolderId(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                if (event.key === "Escape") setRenamingFolderId(null);
              }}
              className="h-7 text-sm text-slate-900"
            />
          ) : (
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 text-left"
              onClick={() => onSelectFolder(folder.id)}
            >
              <span className="truncate">{folder.name}</span>
              <span className={`text-xs ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                {countInFolder(folder.id)}
              </span>
            </button>
          )}
        </div>
        {expanded ? children.map((child) => renderFolder(child, depth + 1)) : null}
      </div>
    );
  };

  const selectedFolder = selectedFolderId ? foldersById.get(selectedFolderId) : undefined;

  const renderDetail = (item: ExerciseItem) => (
    <ExerciseDetailPane
      key={item.id}
      item={item}
      folders={sortedFolders}
      folderPath={folderPath}
      canEdit={canEditItem(item)}
      authorName={isMineItem(item) ? "you" : authorNameOf(item)}
      onMove={(folderId) => onMoveExercise(item.id, folderId)}
      onDuplicate={async () => {
        const createdId = await onDuplicateExercise(item);
        if (typeof createdId === "string") selectExercise(createdId);
      }}
      onDelete={async () => {
        const deleted = await onDeleteExercise(item);
        if (deleted !== false) selectExercise(null);
      }}
    />
  );
  return (
    <div
      className="space-y-4"
      data-testid="exercise-library"
    >
      {/* Middle: search, filters, list */}
      <section className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, tags, keywords"
              className="h-9 border-none px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <Button
            type="button"
            onClick={async () => {
              const createdId = await onCreateExercise(selectedFolderId);
              if (typeof createdId === "string") selectExercise(createdId);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>
        </div>
        <FolderChipBar
          folders={sortedFolders}
          selectedFolderId={selectedFolderId}
          onSelect={onSelectFolder}
          countFor={(folderId) => (folderId ? countInFolder(folderId) : exercises.length)}
          allLabel="All"
          onCreate={onCreateFolder}
          onRename={onRenameFolder}
          onDelete={onDeleteFolder}
        />
        <div className="flex flex-wrap items-center gap-1 text-xs" data-testid="exercise-author-filter">
          {[
            { id: "all", label: "All" },
            { id: "mine", label: "Only mine" },
            ...authorChips,
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setAuthorFilter(chip.id)}
              className={`rounded-full border px-3 py-1 ${
                authorFilter === chip.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-400"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <ExerciseFacetFilterBar value={facetFilter} onChange={setFacetFilter} />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {searchingAll
              ? "Searching all folders"
              : selectedFolder
                ? folderPath(selectedFolder.id)
                : "All exercises"}
          </span>
          <span>
            {visibleExercises.length} exercise{visibleExercises.length === 1 ? "" : "s"}
          </span>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading exercises…</p>
        ) : visibleExercises.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No exercises found.</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="exercise-library-list">
            {visibleExercises.map((item) => {
              const isSelected = item.id === selectedId;
              const tags = tagSummary(item);
              const prescription = prescriptionSummary(item);
              const hasVideo = Boolean(item.demoUrl);
              const isDirect = canReorder && (item.folderId ?? null) === selectedFolderId;
              return (
                <li key={item.id}>
                  <div
                    className={`group flex items-center gap-2 rounded-md px-2 py-2 ${
                      isSelected ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => selectExercise(item.id)}
                      data-testid={`exercise-library-item-${item.id}`}
                    >
                      <div className="truncate text-sm font-semibold text-slate-900">{item.name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {[prescription, tags].filter(Boolean).join(" · ") || "No tags yet"}
                      </div>
                    </button>
                    {item.needsVideo ? (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        needs video
                      </span>
                    ) : null}
                    {hasVideo ? (
                      <Video className="h-4 w-4 shrink-0 text-slate-400" aria-label="Has video" />
                    ) : (
                      <VideoOff className="h-4 w-4 shrink-0 text-slate-300" aria-label="No video" />
                    )}
                    {isDirect ? (
                      <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          onClick={() => move(item.id, -1)}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          onClick={() => move(item.id, 1)}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* The selected exercise opens in a wide side panel: editor on the left,
          client preview beside it, one scrollbar for the whole panel. */}
      <Sheet open={sheetOpen && Boolean(selected)} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-slate-50 sm:max-w-5xl">
          <SheetTitle className="sr-only">Exercise</SheetTitle>
          {selected ? <div className="pt-6">{renderDetail(selected)}</div> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

type DetailDraft = ExerciseEditableFields & { name: string };

function ExerciseDetailPane({
  item,
  folders,
  folderPath,
  canEdit,
  authorName,
  onMove,
  onDuplicate,
  onDelete,
}: {
  canEdit: boolean;
  authorName: string;
  item: ExerciseItem;
  folders: TemplateFolder[];
  folderPath: (folderId: string | null) => string;
  onMove: (folderId: string | null) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const updateExerciseTemplate = useUpdateExerciseTemplate();
  const [draft, setDraft] = useState<DetailDraft>(() => ({
    name: item.name || "",
    ...toExerciseEditableFields(item),
  }));
  const [status, setStatus] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const needsVideoRef = useRef(Boolean(item.needsVideo));
  needsVideoRef.current = Boolean(item.needsVideo);

  const save = useCallback(async () => {
    if (!dirtyRef.current) return;
    const latest = draftRef.current;
    if (!latest.name.trim()) return;
    dirtyRef.current = false;
    setStatus("saving");
    try {
      await updateExerciseTemplate.mutateAsync({
        id: item.id,
        name: latest.name.trim(),
        demoUrl: latest.demoUrl.trim() || null,
        sets: latest.sets.trim() || null,
        reps: latest.reps.trim() || null,
        load: latest.load.trim() || null,
        tempo: latest.tempo.trim() || null,
        goal: latest.goal.trim() || null,
        additionalInstructions: latest.additionalInstructions.trim() || null,
        ...exerciseStandardToPayload(latest),
        notes: latest.notes.trim() || null,
        requiresMovementCheck: latest.requiresMovementCheck,
        enableStructuredLogging: latest.enableStructuredLogging,
        // A demo video was added: it no longer needs filming.
        ...(latest.demoUrl.trim() && needsVideoRef.current ? { needsVideo: false } : {}),
      } as any);
      setStatus(dirtyRef.current ? "pending" : "saved");
    } catch {
      dirtyRef.current = true;
      setStatus("error");
      toast({ title: "Could not save exercise", variant: "destructive" });
    }
  }, [item.id, toast, updateExerciseTemplate]);

  // Save shortly after typing stops.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const timeout = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(timeout);
  }, [draft, save]);

  // Save whatever is left when switching to another exercise or leaving the page.
  useEffect(() => () => void save(), [save]);

  const update = <K extends keyof DetailDraft>(field: K, value: DetailDraft[K]) => {
    setDraft((previous) => {
      const next = { ...previous, [field]: value };
      draftRef.current = next;
      dirtyRef.current = true;
      return next;
    });
    setStatus("pending");
  };

  const statusLabel =
    status === "saving"
      ? "Saving…"
      : status === "pending"
        ? "Unsaved changes"
        : status === "error"
          ? "Not saved"
          : "Saved";

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <Input
            value={draft.name}
            disabled={!canEdit}
            onChange={(event) => update("name", event.target.value)}
            className="h-9 border-transparent px-1 text-lg font-semibold shadow-none focus-visible:border-slate-300"
            aria-label="Exercise name"
          />
          <div className="flex shrink-0 items-center gap-1">
            <span
              className={`mr-1 text-xs ${status === "error" ? "text-rose-600" : "text-slate-400"}`}
            >
              {statusLabel}
            </span>
            <Button type="button" variant="ghost" size="icon" onClick={onDuplicate} title="Duplicate">
              <Copy className="h-4 w-4" />
            </Button>
            {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-rose-600"
              onClick={onDelete}
              title="Delete exercise"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            ) : null}
          </div>
        </div>
        {!canEdit ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Added by {authorName}. You can look at it, or press Duplicate to make your own copy.
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <Label className="shrink-0 text-xs text-slate-500">Folder</Label>
          <Select
            disabled={!canEdit}
            value={item.folderId ?? "__none__"}
            onValueChange={(value) => onMove(value === "__none__" ? null : value)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No folder</SelectItem>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folderPath(folder.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-4 lg:order-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <fieldset disabled={!canEdit} className="min-w-0 border-0 p-0">
              <ExerciseFieldsEditor
                idPrefix={`library-${item.id}`}
                value={draft}
                onChange={(field, value) => update(field, value as any)}
              />
            </fieldset>
          </div>

          <ExerciseLibraryTags item={item} />
        </div>
        <div className="lg:order-2 lg:sticky lg:top-0">
          <ExerciseClientPreview exercise={draft} />
        </div>
      </div>
    </div>
  );
}
