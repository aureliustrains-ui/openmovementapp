import { useMemo, useState } from "react";
import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TemplateFolder } from "@/lib/api";

type Props = {
  folders: TemplateFolder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  /** Number of items in the folder (including subfolders); null = all items. */
  countFor: (folderId: string | null) => number;
  allLabel: string;
  onCreate: (name: string, parentId: string | null) => void;
  onRename: (folderId: string, name: string) => void;
  onDelete: (folderId: string) => void;
};

/** Folders as a slim strip of chips: top level first, then the level below the open folder. */
export function FolderChipBar({
  folders,
  selectedFolderId,
  onSelect,
  countFor,
  allLabel,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState<{ mode: "create" | "rename"; draft: string } | null>(null);

  const byId = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const childrenOf = (parentId: string | null) =>
    folders
      .filter((folder) => (folder.parentId ?? null) === parentId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

  const selected = selectedFolderId ? byId.get(selectedFolderId) : undefined;
  // Path from the top level down to the open folder.
  const path: TemplateFolder[] = [];
  for (let current = selected; current; current = current.parentId ? byId.get(current.parentId) : undefined) {
    path.unshift(current);
  }
  // Rows: top level, then the children of each open folder in the path.
  const rows: Array<{ parentId: string | null; items: TemplateFolder[] }> = [
    { parentId: null, items: childrenOf(null) },
  ];
  for (const folder of path) {
    const kids = childrenOf(folder.id);
    if (kids.length > 0) rows.push({ parentId: folder.id, items: kids });
  }

  const chip = (active: boolean, open = false) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
      active
        ? "border-slate-900 bg-slate-900 text-white"
        : open
          ? "border-slate-900 bg-slate-100 text-slate-900"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
    }`;

  const finish = () => {
    if (!editing) return;
    const name = editing.draft.trim();
    if (name) {
      if (editing.mode === "create") onCreate(name, selectedFolderId);
      else if (selected && name !== selected.name) onRename(selected.id, name);
    }
    setEditing(null);
  };

  return (
    <div className="space-y-2" data-testid="folder-chip-bar">
      {rows.map((row, rowIndex) => (
        <div key={row.parentId ?? "root"} className="flex flex-wrap items-center gap-2">
          {rowIndex === 0 ? (
            <button
              type="button"
              className={chip(selectedFolderId === null)}
              onClick={() => onSelect(null)}
            >
              {allLabel}
              <span className="text-xs opacity-60">{countFor(null)}</span>
            </button>
          ) : null}
          {row.items.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className={chip(folder.id === selectedFolderId, path.some((item) => item.id === folder.id))}
              onClick={() => onSelect(folder.id)}
              data-open={path.some((item) => item.id === folder.id) ? "true" : undefined}
            >
              {folder.name}
              <span className="text-xs opacity-60">{countFor(folder.id)}</span>
            </button>
          ))}
          {rowIndex === rows.length - 1 ? (
            <div className="ml-auto flex items-center gap-1">
              {editing ? (
                <Input
                  autoFocus
                  value={editing.draft}
                  placeholder={editing.mode === "create" ? "Folder name" : "Rename folder"}
                  onChange={(event) => setEditing({ ...editing, draft: event.target.value })}
                  onBlur={finish}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                    if (event.key === "Escape") setEditing(null);
                  }}
                  className="h-8 w-44 text-sm"
                />
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setEditing({ mode: "create", draft: "" })}
                  >
                    <FolderPlus className="mr-1 h-3.5 w-3.5" />
                    {selected ? "Subfolder" : "Folder"}
                  </Button>
                  {selected ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Rename folder"
                        onClick={() => setEditing({ mode: "rename", draft: selected.name })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-rose-600"
                        title="Delete folder"
                        onClick={() => onDelete(selected.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
