import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  FolderInput,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { FolderChipBar } from "@/components/admin/FolderChipBar";
import type { TemplateFolder } from "@/lib/api";

type ListItem = { id: string; name: string; folderId: string | null; sortOrder: number };

type Props<TItem extends ListItem> = {
  allLabel: string;
  searchPlaceholder: string;
  createButtonLabel: string;
  items: TItem[];
  folders: TemplateFolder[];
  selectedFolderId: string | null;
  isLoading?: boolean;
  onSelectFolder: (folderId: string | null) => void;
  onCreateTemplate: (folderId: string | null) => void | string | Promise<void | string>;
  onDuplicateTemplate: (item: TItem) => void;
  onDeleteTemplate: (item: TItem) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveTemplate: (templateId: string, folderId: string | null) => void;
  onReorderTemplates: (items: Array<{ id: string; sortOrder: number; folderId: string | null }>) => void;
  getTemplateSummary: (item: TItem) => string;
  getTemplateSearchText?: (item: TItem) => string;
  /** Where a click on the row goes (a builder page). */
  getTemplateOpenHref: (item: TItem) => string;
  /** If given, a click opens in place (e.g. a side panel) instead of navigating. */
  onOpenTemplate?: (item: TItem) => void;
  icon: ReactNode;
};

export function TemplateListPane<TItem extends ListItem>({
  allLabel,
  searchPlaceholder,
  createButtonLabel,
  items,
  folders,
  selectedFolderId,
  isLoading = false,
  onSelectFolder,
  onCreateTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveTemplate,
  onReorderTemplates,
  getTemplateSummary,
  getTemplateSearchText,
  getTemplateOpenHref,
  onOpenTemplate,
  icon,
}: Props<TItem>) {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const sortedFolders = useMemo(
    () =>
      [...folders].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
      ),
    [folders],
  );
  const foldersById = useMemo(
    () => new Map(sortedFolders.map((folder) => [folder.id, folder])),
    [sortedFolders],
  );
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
      ),
    [items],
  );

  useEffect(() => {
    if (selectedFolderId && !foldersById.has(selectedFolderId)) onSelectFolder(null);
  }, [selectedFolderId, foldersById, onSelectFolder]);

  const descendantIds = (folderId: string) => {
    const ids = new Set<string>([folderId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const folder of sortedFolders) {
        if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
          ids.add(folder.id);
          grew = true;
        }
      }
    }
    return ids;
  };
  const countFor = (folderId: string | null) => {
    if (!folderId) return sortedItems.length;
    const ids = descendantIds(folderId);
    return sortedItems.filter((item) => item.folderId && ids.has(item.folderId)).length;
  };
  const folderPath = (folderId: string | null) => {
    const names: string[] = [];
    let current = folderId ? foldersById.get(folderId) : undefined;
    while (current) {
      names.unshift(current.name);
      current = current.parentId ? foldersById.get(current.parentId) : undefined;
    }
    return names.join(" / ");
  };

  const query = search.trim().toLowerCase();
  const visible = useMemo(() => {
    const ids = selectedFolderId ? descendantIds(selectedFolderId) : null;
    return sortedItems.filter((item) => {
      if (!query) return !ids || (item.folderId !== null && ids.has(item.folderId));
      const text = `${item.name} ${getTemplateSummary(item)} ${getTemplateSearchText?.(item) ?? ""}`;
      return text.toLowerCase().includes(query);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedItems, selectedFolderId, query, sortedFolders]);

  const canReorder = !query && selectedFolderId === null;

  const move = (item: TItem, offset: -1 | 1) => {
    const siblings = sortedItems.filter((entry) => (entry.folderId ?? null) === (item.folderId ?? null));
    const index = siblings.findIndex((entry) => entry.id === item.id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= siblings.length) return;
    const reordered = [...siblings];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    onReorderTemplates(
      reordered.map((entry, order) => ({
        id: entry.id,
        sortOrder: order,
        folderId: item.folderId ?? null,
      })),
    );
  };

  const open = (item: TItem) => {
    if (onOpenTemplate) onOpenTemplate(item);
    else setLocation(getTemplateOpenHref(item));
  };

  return (
    <div
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      data-testid="template-list"
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 border-none px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Button type="button" onClick={() => void onCreateTemplate(selectedFolderId)}>
          <Plus className="mr-1 h-4 w-4" />
          {createButtonLabel}
        </Button>
      </div>

      <FolderChipBar
        folders={sortedFolders}
        selectedFolderId={selectedFolderId}
        onSelect={onSelectFolder}
        countFor={countFor}
        allLabel="All"
        onCreate={onCreateFolder}
        onRename={onRenameFolder}
        onDelete={onDeleteFolder}
      />

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{query ? "Searching all folders" : selectedFolderId ? folderPath(selectedFolderId) : allLabel}</span>
        <span>
          {visible.length} item{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100" data-testid="template-list-items">
          {visible.map((item) => (
            <li key={item.id}>
              <div className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-slate-50">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => open(item)}
                  data-testid={`template-list-item-${item.id}`}
                >
                  <span className="shrink-0 text-slate-400">{icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {item.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {[getTemplateSummary(item), item.folderId ? folderPath(item.folderId) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-slate-500"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => open(item)}>Open</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onDuplicateTemplate(item)}>
                      <Copy className="mr-2 h-4 w-4" /> Duplicate
                    </DropdownMenuItem>
                    {sortedFolders.length > 0 ? (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <FolderInput className="mr-2 h-4 w-4" /> Move to folder
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onSelect={() => onMoveTemplate(item.id, null)}>
                            No folder
                          </DropdownMenuItem>
                          {sortedFolders.map((folder) => (
                            <DropdownMenuItem
                              key={folder.id}
                              onSelect={() => onMoveTemplate(item.id, folder.id)}
                            >
                              {folderPath(folder.id)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ) : null}
                    {canReorder ? (
                      <>
                        <DropdownMenuItem onSelect={() => move(item, -1)}>
                          <ArrowUp className="mr-2 h-4 w-4" /> Move up
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => move(item, 1)}>
                          <ArrowDown className="mr-2 h-4 w-4" /> Move down
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-rose-600 focus:text-rose-600"
                      onSelect={() => onDeleteTemplate(item)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
