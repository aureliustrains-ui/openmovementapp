import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TemplateFolder } from "@/lib/api";
import { cn } from "@/lib/utils";

const VIEW_ALL = "__all__";
const MOVE_NO_FOLDER = "__remove_from_folder__";

type TemplateListItem = {
  id: string;
  name: string;
  folderId: string | null;
  sortOrder: number;
};

type TemplateLibraryPaneProps<TItem extends TemplateListItem> = {
  title: string;
  allLabel: string;
  searchPlaceholder: string;
  createButtonLabel: string;
  items: TItem[];
  folders: TemplateFolder[];
  isLoading?: boolean;
  onCreateTemplate: () => void;
  onDuplicateTemplate: (item: TItem) => void;
  onDeleteTemplate: (item: TItem) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveTemplate: (templateId: string, folderId: string | null) => void;
  onReorderTemplates: (
    items: Array<{ id: string; sortOrder: number; folderId: string | null }>,
  ) => void;
  getTemplateSummary: (item: TItem) => string;
  getTemplateOpenHref: (item: TItem) => string;
};

function sortTemplateItems<TItem extends TemplateListItem>(items: TItem[]): TItem[] {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

export function TemplateLibraryPane<TItem extends TemplateListItem>({
  title,
  allLabel,
  searchPlaceholder,
  createButtonLabel,
  items,
  folders,
  isLoading = false,
  onCreateTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveTemplate,
  onReorderTemplates,
  getTemplateSummary,
  getTemplateOpenHref,
}: TemplateLibraryPaneProps<TItem>) {
  const [selectedView, setSelectedView] = useState<string>(VIEW_ALL);
  const [search, setSearch] = useState("");
  const [searchAll, setSearchAll] = useState(false);
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [draggedTemplateId, setDraggedTemplateId] = useState<string | null>(null);

  const sortedFolders = useMemo(
    () =>
      [...folders].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      }),
    [folders],
  );

  const sortedItems = useMemo(() => sortTemplateItems(items), [items]);

  const counts = useMemo(() => {
    const folderCounts = new Map<string, number>();
    for (const item of sortedItems) {
      if (item.folderId !== null) {
        folderCounts.set(item.folderId, (folderCounts.get(item.folderId) || 0) + 1);
      }
    }
    return {
      all: sortedItems.length,
      byFolder: folderCounts,
    };
  }, [sortedItems]);

  const selectedFolderId = selectedView !== VIEW_ALL ? selectedView : null;

  const selectedFolder = useMemo(
    () => sortedFolders.find((folder) => folder.id === selectedFolderId) || null,
    [selectedFolderId, sortedFolders],
  );

  useEffect(() => {
    if (
      selectedView !== VIEW_ALL &&
      !sortedFolders.some((folder) => folder.id === selectedView)
    ) {
      setSelectedView(VIEW_ALL);
    }
  }, [selectedView, sortedFolders]);

  const baseItems = useMemo(() => {
    if (selectedView === VIEW_ALL) return sortedItems;
    return sortedItems.filter((item) => item.folderId === selectedView);
  }, [selectedView, sortedItems]);

  const visibleBaseList = searchAll ? sortedItems : baseItems;
  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return visibleBaseList;
    return visibleBaseList.filter((item) => item.name.toLowerCase().includes(normalizedSearch));
  }, [search, visibleBaseList]);

  const canReorder = selectedView !== VIEW_ALL && search.trim().length === 0 && !searchAll;

  const createFolder = () => {
    const proposed = window.prompt("Folder name");
    const normalized = proposed?.trim();
    if (!normalized) return;
    onCreateFolder(normalized);
    setFoldersExpanded(true);
  };

  const renameSelectedFolder = () => {
    if (!selectedFolder) return;
    const proposed = window.prompt("Rename folder", selectedFolder.name);
    const normalized = proposed?.trim();
    if (!normalized || normalized === selectedFolder.name) return;
    onRenameFolder(selectedFolder.id, normalized);
  };

  const moveByOffset = (itemId: string, offset: -1 | 1) => {
    if (!canReorder) return;
    const folderId = selectedView;
    const currentFolderItems = sortTemplateItems(
      sortedItems.filter((entry) => entry.folderId === folderId),
    );
    const index = currentFolderItems.findIndex((entry) => entry.id === itemId);
    if (index < 0) return;
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= currentFolderItems.length) return;

    const reordered = [...currentFolderItems];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    onReorderTemplates(
      reordered.map((entry, nextIndex) => ({
        id: entry.id,
        sortOrder: nextIndex,
        folderId,
      })),
    );
  };

  const handleDropToFolder = (folderId: string | null) => {
    if (!draggedTemplateId) return;
    onMoveTemplate(draggedTemplateId, folderId);
    setDraggedTemplateId(null);
  };

  const currentViewLabel =
    selectedView === VIEW_ALL
      ? allLabel
      : selectedFolder?.name || "Folder";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card className="border-slate-200 shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title} library</p>

          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left",
              selectedView === VIEW_ALL
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100",
            )}
            onClick={() => setSelectedView(VIEW_ALL)}
          >
            <span className="font-medium">{allLabel}</span>
            <span className="text-xs opacity-80">{counts.all}</span>
          </button>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
              onClick={() => setFoldersExpanded((prev) => !prev)}
            >
              <span>Folders</span>
              {foldersExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            {foldersExpanded && (
              <div className="space-y-1 border-t border-slate-200 p-2">
                {sortedFolders.map((folder) => {
                  const isSelected = folder.id === selectedView;
                  const folderCount = counts.byFolder.get(folder.id) || 0;

                  return (
                    <button
                      key={folder.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm",
                        isSelected
                          ? "bg-white border border-slate-200 text-slate-900"
                          : "text-slate-700 hover:bg-white",
                      )}
                      onClick={() => setSelectedView(folder.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDropToFolder(folder.id);
                      }}
                    >
                      <span className="truncate">{folder.name}</span>
                      <span className="text-xs text-slate-500">{folderCount}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm rounded-2xl">
        <CardContent className="p-4 md:p-5 space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-auto border-none p-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 pl-1">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300"
                  checked={searchAll}
                  onChange={(event) => setSearchAll(event.target.checked)}
                />
                Search all
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={createFolder}>
                <FolderPlus className="mr-2 h-4 w-4" />
                New folder
              </Button>
              <Button onClick={onCreateTemplate}>
                <Plus className="mr-2 h-4 w-4" />
                {createButtonLabel}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current view</p>
              <p className="text-sm text-slate-700">
                Showing <span className="font-semibold text-slate-900">{currentViewLabel}</span>
                <span className="ml-2 text-slate-500">({visibleItems.length})</span>
              </p>
            </div>
            {selectedFolder && (
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={renameSelectedFolder}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Rename folder
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => onDeleteFolder(selectedFolder.id)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete folder
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Loading templates...
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No templates found in this view.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => (
                <Card
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedTemplateId(item.id)}
                  onDragEnd={() => setDraggedTemplateId(null)}
                  className="border-slate-200 shadow-sm"
                >
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{item.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{getTemplateSummary(item)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">Move to</label>
                      <select
                        value={item.folderId ?? MOVE_NO_FOLDER}
                        onChange={(event) =>
                          onMoveTemplate(
                            item.id,
                            event.target.value === MOVE_NO_FOLDER ? null : event.target.value,
                          )
                        }
                        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
                      >
                        <option value={MOVE_NO_FOLDER}>Remove from folder</option>
                        {sortedFolders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={getTemplateOpenHref(item)}>
                        <Button size="sm" variant="outline">
                          Open
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => onDuplicateTemplate(item)}>
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => onDeleteTemplate(item)}
                      >
                        Delete
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => moveByOffset(item.id, -1)}
                        disabled={!canReorder}
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => moveByOffset(item.id, 1)}
                        disabled={!canReorder}
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
