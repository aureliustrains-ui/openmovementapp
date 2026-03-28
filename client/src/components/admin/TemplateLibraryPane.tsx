import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TemplateFolder } from "@/lib/api";
import { cn } from "@/lib/utils";

type TemplateListItem = {
  id: string;
  name: string;
  folderId: string | null;
  sortOrder: number;
};

type ReorderPayload = {
  id: string;
  sortOrder: number;
  folderId: string | null;
};

type TemplateCategoryNavItem = {
  id: string;
  label: string;
  count: number;
  icon?: LucideIcon;
};

type TemplateLibraryPaneProps<TItem extends TemplateListItem> = {
  rootLabel?: string;
  allLabel: string;
  searchPlaceholder: string;
  createButtonLabel: string;
  items: TItem[];
  folders: TemplateFolder[];
  categoryItems?: TemplateCategoryNavItem[];
  activeCategoryId?: string;
  selectedFolderId: string | null;
  isLoading?: boolean;
  onSelectCategory?: (categoryId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
  onCreateTemplate: (folderId: string | null) => void;
  onDuplicateTemplate: (item: TItem) => void;
  onDeleteTemplate: (item: TItem) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFolder?: (folderId: string, parentId: string | null) => void;
  onMoveTemplate: (templateId: string, folderId: string | null) => void;
  onReorderTemplates: (items: ReorderPayload[]) => void;
  getTemplateSummary: (item: TItem) => string;
  getTemplateOpenHref: (item: TItem) => string;
};

function sortTemplateItems<TItem extends TemplateListItem>(items: TItem[]): TItem[] {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

function sortFolders(folders: TemplateFolder[]): TemplateFolder[] {
  return [...folders].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

function folderParentKey(parentId: string | null): string {
  return parentId ?? "__root__";
}

function buildFolderPath(
  foldersById: Map<string, TemplateFolder>,
  folderId: string,
  allLabel: string,
): Array<{ id: string | null; name: string }> {
  const chain: Array<{ id: string | null; name: string }> = [{ id: null, name: allLabel }];
  const segments: TemplateFolder[] = [];
  let current = foldersById.get(folderId) || null;
  let guard = 0;
  while (current && guard < 100) {
    segments.push(current);
    current = current.parentId ? foldersById.get(current.parentId) || null : null;
    guard += 1;
  }
  segments.reverse().forEach((segment) => {
    chain.push({ id: segment.id, name: segment.name });
  });
  return chain;
}

export function TemplateLibraryPane<TItem extends TemplateListItem>({
  rootLabel,
  allLabel,
  searchPlaceholder,
  createButtonLabel,
  items,
  folders,
  categoryItems,
  activeCategoryId,
  selectedFolderId,
  isLoading = false,
  onSelectCategory,
  onSelectFolder,
  onCreateTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onMoveTemplate,
  onReorderTemplates,
  getTemplateSummary,
  getTemplateOpenHref,
}: TemplateLibraryPaneProps<TItem>) {
  const rootNodeLabel = rootLabel ?? allLabel;
  const [search, setSearch] = useState("");
  const [searchAll, setSearchAll] = useState(false);
  const [rootExpanded, setRootExpanded] = useState(true);
  const [draggedTemplateId, setDraggedTemplateId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  const sortedFolders = useMemo(() => sortFolders(folders), [folders]);
  const sortedItems = useMemo(() => sortTemplateItems(items), [items]);

  const foldersById = useMemo(() => {
    const map = new Map<string, TemplateFolder>();
    for (const folder of sortedFolders) {
      map.set(folder.id, folder);
    }
    return map;
  }, [sortedFolders]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, TemplateFolder[]>();
    for (const folder of sortedFolders) {
      const key = folderParentKey(folder.parentId);
      const existing = map.get(key) || [];
      existing.push(folder);
      map.set(key, existing);
    }
    return map;
  }, [sortedFolders]);

  useEffect(() => {
    if (!selectedFolderId) return;
    if (!foldersById.has(selectedFolderId)) {
      onSelectFolder(null);
    }
  }, [selectedFolderId, foldersById, onSelectFolder]);

  useEffect(() => {
    if (!selectedFolderId) return;
    const path = buildFolderPath(foldersById, selectedFolderId, rootNodeLabel);
    setExpandedFolderIds((previous) => {
      const next = new Set(previous);
      for (const segment of path) {
        if (segment.id) next.add(segment.id);
      }
      return next;
    });
  }, [foldersById, rootNodeLabel, selectedFolderId]);

  const selectedFolder = useMemo(
    () => (selectedFolderId ? foldersById.get(selectedFolderId) || null : null),
    [foldersById, selectedFolderId],
  );

  const templateCountsByFolder = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of sortedItems) {
      if (!item.folderId) continue;
      map.set(item.folderId, (map.get(item.folderId) || 0) + 1);
    }
    return map;
  }, [sortedItems]);

  const allTemplateCount = sortedItems.length;

  const totalTemplatesByFolder = useMemo(() => {
    const totals = new Map<string, number>();

    const visit = (folderId: string): number => {
      if (totals.has(folderId)) return totals.get(folderId) || 0;
      let total = templateCountsByFolder.get(folderId) || 0;
      const children = childrenByParent.get(folderId) || [];
      for (const child of children) {
        total += visit(child.id);
      }
      totals.set(folderId, total);
      return total;
    };

    for (const folder of sortedFolders) {
      visit(folder.id);
    }

    return totals;
  }, [childrenByParent, sortedFolders, templateCountsByFolder]);

  const baseTemplates = useMemo(
    () =>
      sortedItems.filter((item) => {
        if (selectedFolderId === null) return item.folderId === null;
        return item.folderId === selectedFolderId;
      }),
    [selectedFolderId, sortedItems],
  );

  const baseChildFolders = useMemo(
    () => childrenByParent.get(folderParentKey(selectedFolderId)) || [],
    [childrenByParent, selectedFolderId],
  );

  const folderSearchBase = searchAll ? sortedFolders : baseChildFolders;
  const templateSearchBase = searchAll ? sortedItems : baseTemplates;
  const normalizedSearch = search.trim().toLowerCase();

  const visibleChildFolders = useMemo(() => {
    if (!normalizedSearch) return folderSearchBase;
    return folderSearchBase.filter((folder) => folder.name.toLowerCase().includes(normalizedSearch));
  }, [folderSearchBase, normalizedSearch]);

  const visibleTemplates = useMemo(() => {
    if (!normalizedSearch) return templateSearchBase;
    return templateSearchBase.filter((item) => item.name.toLowerCase().includes(normalizedSearch));
  }, [normalizedSearch, templateSearchBase]);

  const canReorderTemplates = !searchAll && normalizedSearch.length === 0;

  const createFolderAtCurrentLevel = () => {
    const proposed = window.prompt("Folder name");
    const normalized = proposed?.trim();
    if (!normalized) return;
    onCreateFolder(normalized, selectedFolderId);
    setRootExpanded(true);
    if (selectedFolderId) {
      setExpandedFolderIds((previous) => {
        const next = new Set(previous);
        next.add(selectedFolderId);
        return next;
      });
    }
  };

  const renameSelectedFolder = () => {
    if (!selectedFolder) return;
    const proposed = window.prompt("Rename folder", selectedFolder.name);
    const normalized = proposed?.trim();
    if (!normalized || normalized === selectedFolder.name) return;
    onRenameFolder(selectedFolder.id, normalized);
  };

  const moveByOffset = (itemId: string, offset: -1 | 1) => {
    if (!canReorderTemplates) return;

    const currentTemplates = sortTemplateItems(
      sortedItems.filter((entry) => {
        if (selectedFolderId === null) return entry.folderId === null;
        return entry.folderId === selectedFolderId;
      }),
    );
    const index = currentTemplates.findIndex((entry) => entry.id === itemId);
    if (index < 0) return;
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= currentTemplates.length) return;

    const reordered = [...currentTemplates];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    onReorderTemplates(
      reordered.map((entry, nextIndex) => ({
        id: entry.id,
        sortOrder: nextIndex,
        folderId: selectedFolderId,
      })),
    );
  };

  const selectedFolderPath = useMemo(() => {
    if (!selectedFolderId) return [{ id: null, name: rootNodeLabel }];
    return buildFolderPath(foldersById, selectedFolderId, rootNodeLabel);
  }, [foldersById, rootNodeLabel, selectedFolderId]);

  const handleDropToFolder = (folderId: string | null) => {
    if (draggedTemplateId) {
      onMoveTemplate(draggedTemplateId, folderId);
      setDraggedTemplateId(null);
      return;
    }
    if (draggedFolderId && onMoveFolder) {
      onMoveFolder(draggedFolderId, folderId);
      setDraggedFolderId(null);
    }
  };

  const renderFolderTree = (folder: TemplateFolder, depth: number) => {
    const children = childrenByParent.get(folder.id) || [];
    const isExpanded = expandedFolderIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const count = totalTemplatesByFolder.get(folder.id) || 0;
    const handleFolderRowClick = () => {
      onSelectFolder(folder.id);
      if (children.length === 0) return;
      setExpandedFolderIds((previous) => {
        const next = new Set(previous);
        const isCurrentlyExpanded = next.has(folder.id);
        const shouldCollapse = isSelected && isCurrentlyExpanded;
        if (shouldCollapse) next.delete(folder.id);
        else next.add(folder.id);
        return next;
      });
    };

    return (
      <div key={folder.id}>
        <div
          className={cn(
            "group flex items-center gap-1 rounded-md px-1 py-1",
            isSelected ? "border border-slate-200 bg-white" : "hover:bg-white",
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          draggable
          onDragStart={() => setDraggedFolderId(folder.id)}
          onDragEnd={() => setDraggedFolderId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleDropToFolder(folder.id);
          }}
        >
          <button
            type="button"
            className={cn(
              "flex w-full min-w-0 items-center gap-2 rounded px-1.5 py-1 text-left text-sm",
              isSelected ? "text-slate-900" : "text-slate-700",
            )}
            onClick={handleFolderRowClick}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center text-slate-500">
              {children.length > 0 ? (
                isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )
              ) : (
                <span className="block h-3.5 w-3.5" />
              )}
            </span>
            <span className="truncate">{folder.name}</span>
            <span className="ml-auto text-xs text-slate-500">{count}</span>
          </button>
        </div>

        {isExpanded && children.length > 0 ? (
          <div className="mt-0.5 space-y-0.5">{children.map((child) => renderFolderTree(child, depth + 1))}</div>
        ) : null}
      </div>
    );
  };

  const renderFolderNavigator = (inCategorySection: boolean) => {
    const rootFolders = childrenByParent.get(folderParentKey(null)) || [];

    if (!rootExpanded || rootFolders.length === 0) {
      return inCategorySection ? null : <div className="space-y-1" />;
    }

    return (
      <div className={cn("space-y-0.5", inCategorySection ? "pl-4" : undefined)}>
        {rootFolders.map((rootFolder) => renderFolderTree(rootFolder, 1))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="space-y-3 p-4">
          {categoryItems && categoryItems.length > 0 && onSelectCategory ? (
            <div className="space-y-2">
              {categoryItems.map((category) => {
                const Icon = category.icon;
                const isActiveCategory = category.id === activeCategoryId;
                const rootFolders = childrenByParent.get(folderParentKey(null)) || [];
                return (
                  <div key={category.id} className="space-y-1">
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                        isActiveCategory
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-100",
                      )}
                      onClick={() => {
                        if (isActiveCategory) {
                          setRootExpanded((prev) => !prev);
                          onSelectFolder(null);
                          return;
                        }
                        onSelectCategory(category.id);
                        onSelectFolder(null);
                        setRootExpanded(true);
                      }}
                      onDragOver={(event) => {
                        if (!isActiveCategory) return;
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        if (!isActiveCategory) return;
                        event.preventDefault();
                        handleDropToFolder(null);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="inline-flex h-4 w-4 items-center justify-center text-slate-300">
                          {isActiveCategory && rootFolders.length > 0 ? (
                            rootExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <span className="block h-3.5 w-3.5" />
                          )}
                        </span>
                        {Icon ? <Icon className="h-4 w-4" /> : null}
                        <span className="font-medium">{category.label}</span>
                      </span>
                      <span className="text-xs opacity-80">{category.count}</span>
                    </button>
                    {isActiveCategory ? renderFolderNavigator(true) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            renderFolderNavigator(false)
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="space-y-4 p-4 md:p-5">
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
              <label className="inline-flex items-center gap-2 pl-1 text-xs text-slate-600">
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
              <Button type="button" variant="outline" onClick={createFolderAtCurrentLevel}>
                <FolderPlus className="mr-2 h-4 w-4" />
                New folder
              </Button>
              <Button onClick={() => onCreateTemplate(selectedFolderId)}>
                <Plus className="mr-2 h-4 w-4" />
                {createButtonLabel}
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-b border-slate-200 pb-3">
            <div className="flex flex-wrap items-center gap-1 text-sm text-slate-600">
              {selectedFolderPath.map((segment, index) => {
                const isLast = index === selectedFolderPath.length - 1;
                return (
                  <div key={`${segment.id ?? "root"}-${index}`} className="flex items-center gap-1">
                    {isLast ? (
                      <span className="font-semibold text-slate-900">{segment.name}</span>
                    ) : (
                      <button
                        type="button"
                        className="rounded px-1 py-0.5 hover:bg-slate-100"
                        onClick={() => onSelectFolder(segment.id)}
                      >
                        {segment.name}
                      </button>
                    )}
                    {!isLast ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" /> : null}
                  </div>
                );
              })}
            </div>

            {selectedFolder ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={renameSelectedFolder}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Rename
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => onDeleteFolder(selectedFolder.id)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Loading templates...
            </div>
          ) : (
            <div className="space-y-4">
              {visibleChildFolders.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleChildFolders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      className="rounded-xl border border-slate-300 bg-slate-100/80 p-4 text-left transition-colors hover:border-slate-400 hover:bg-slate-100"
                      onClick={() => onSelectFolder(folder.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDropToFolder(folder.id);
                      }}
                    >
                      <div className="flex items-center gap-2 text-slate-900">
                        <Folder className="h-4 w-4 text-slate-600" />
                        <span className="truncate font-medium">{folder.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {visibleTemplates.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleTemplates.map((item) => (
                    <Card
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggedTemplateId(item.id)}
                      onDragEnd={() => setDraggedTemplateId(null)}
                      className="border-slate-200 shadow-sm"
                    >
                      <CardContent className="space-y-3 p-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">{item.name}</h3>
                          <p className="mt-1 text-sm text-slate-500">{getTemplateSummary(item)}</p>
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
                            disabled={!canReorderTemplates}
                            title="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => moveByOffset(item.id, 1)}
                            disabled={!canReorderTemplates}
                            title="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}

              {visibleChildFolders.length === 0 && visibleTemplates.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No folders or templates found in this view.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
