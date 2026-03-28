import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { templateFoldersQuery, type TemplateFolder } from "@/lib/api";
import { cn } from "@/lib/utils";

type TemplatePickerPanelProps<T> = {
  templates: T[];
  folderType: "phase" | "session" | "section" | "exercise";
  allLabel: string;
  rootLabel?: string;
  searchPlaceholder: string;
  getTemplateId: (item: T) => string;
  getTemplateName: (item: T) => string;
  getTemplateMeta?: (item: T) => string;
  getTemplateFolderId?: (item: T) => string | null | undefined;
  selectedTemplateId?: string | null;
  onSelectTemplate: (item: T) => void;
};

function folderParentKey(parentId: string | null): string {
  return parentId ?? "__root__";
}

function sortFolders(folders: TemplateFolder[]): TemplateFolder[] {
  return [...folders].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

function buildFolderPath(
  foldersById: Map<string, TemplateFolder>,
  folderId: string,
  rootLabel: string,
): Array<{ id: string | null; name: string }> {
  const chain: Array<{ id: string | null; name: string }> = [{ id: null, name: rootLabel }];
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

function defaultRootLabel(allLabel: string): string {
  return allLabel.replace(/^all\s+/i, "").trim() || allLabel;
}

export function TemplatePickerPanel<T>({
  templates,
  folderType,
  allLabel,
  rootLabel,
  searchPlaceholder,
  getTemplateId,
  getTemplateName,
  getTemplateMeta,
  getTemplateFolderId,
  selectedTemplateId = null,
  onSelectTemplate,
}: TemplatePickerPanelProps<T>) {
  const rootNodeLabel = rootLabel ?? defaultRootLabel(allLabel);
  const { data: folders = [] } = useQuery({
    ...templateFoldersQuery(folderType),
    enabled: Boolean(folderType),
  });

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [rootExpanded, setRootExpanded] = useState(true);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const sortedFolders = useMemo(() => sortFolders(folders), [folders]);

  const foldersById = useMemo(() => {
    const map = new Map<string, TemplateFolder>();
    for (const folder of sortedFolders) map.set(folder.id, folder);
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
    if (!foldersById.has(selectedFolderId)) setSelectedFolderId(null);
  }, [foldersById, selectedFolderId]);

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

  const templateCountsByFolder = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of templates) {
      const folderId = getTemplateFolderId ? getTemplateFolderId(item) : null;
      if (!folderId) continue;
      map.set(folderId, (map.get(folderId) || 0) + 1);
    }
    return map;
  }, [getTemplateFolderId, templates]);

  const totalTemplatesByFolder = useMemo(() => {
    const totals = new Map<string, number>();
    const visit = (folderId: string): number => {
      if (totals.has(folderId)) return totals.get(folderId) || 0;
      let total = templateCountsByFolder.get(folderId) || 0;
      const children = childrenByParent.get(folderId) || [];
      for (const child of children) total += visit(child.id);
      totals.set(folderId, total);
      return total;
    };
    for (const folder of sortedFolders) visit(folder.id);
    return totals;
  }, [childrenByParent, sortedFolders, templateCountsByFolder]);

  const baseItems = useMemo(
    () =>
      templates.filter((item) => {
        const folderId = getTemplateFolderId ? getTemplateFolderId(item) : null;
        if (!selectedFolderId) return folderId === null || folderId === undefined;
        return folderId === selectedFolderId;
      }),
    [getTemplateFolderId, selectedFolderId, templates],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    if (!normalizedSearch) return baseItems;
    return baseItems.filter((item) => getTemplateName(item).toLowerCase().includes(normalizedSearch));
  }, [baseItems, getTemplateName, normalizedSearch]);

  const selectedFolderPath = useMemo(() => {
    if (!selectedFolderId) return [{ id: null, name: rootNodeLabel }];
    return buildFolderPath(foldersById, selectedFolderId, rootNodeLabel);
  }, [foldersById, rootNodeLabel, selectedFolderId]);

  const renderFolderTree = (folder: TemplateFolder, depth: number) => {
    const children = childrenByParent.get(folder.id) || [];
    const isExpanded = expandedFolderIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const count = totalTemplatesByFolder.get(folder.id) || 0;
    const handleClick = () => {
      setSelectedFolderId(folder.id);
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
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
            isSelected ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={handleClick}
        >
          <span
            className={cn(
              "inline-flex h-4 w-4 items-center justify-center",
              isSelected ? "text-slate-200" : "text-slate-500",
            )}
          >
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
          <span className="ml-auto text-xs opacity-80">{count}</span>
        </button>

        {isExpanded && children.length > 0 ? (
          <div className="space-y-0.5">{children.map((child) => renderFolderTree(child, depth + 1))}</div>
        ) : null}
      </div>
    );
  };

  const rootFolders = childrenByParent.get(folderParentKey(null)) || [];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50/50 p-2">
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm",
            selectedFolderId === null ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white",
          )}
          onClick={() => {
            setSelectedFolderId(null);
            setRootExpanded((prev) => (selectedFolderId === null ? !prev : true));
          }}
        >
          <span className="flex items-center gap-2">
            <span className={cn("inline-flex h-4 w-4 items-center justify-center", selectedFolderId === null ? "text-slate-200" : "text-slate-500")}>
              {rootFolders.length > 0 ? (
                rootExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )
              ) : (
                <span className="block h-3.5 w-3.5" />
              )}
            </span>
            <span className="font-medium">{rootNodeLabel}</span>
          </span>
          <span className="text-xs opacity-80">{templates.length}</span>
        </button>

        {rootExpanded && rootFolders.length > 0 ? (
          <div className="space-y-0.5">{rootFolders.map((folder) => renderFolderTree(folder, 1))}</div>
        ) : null}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex items-center gap-2 rounded-md border bg-white px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="border-none px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
          {selectedFolderPath.map((segment, index) => {
            const isLast = index === selectedFolderPath.length - 1;
            return (
              <div key={`${segment.id ?? "root"}-${index}`} className="flex items-center gap-1">
                {isLast ? (
                  <span className="font-medium text-slate-700">{segment.name}</span>
                ) : (
                  <button
                    type="button"
                    className="rounded px-1 py-0.5 hover:bg-slate-100"
                    onClick={() => setSelectedFolderId(segment.id)}
                  >
                    {segment.name}
                  </button>
                )}
                {!isLast ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" /> : null}
              </div>
            );
          })}
        </div>

        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {visibleItems.map((item) => {
            const templateId = getTemplateId(item);
            const isSelected = selectedTemplateId === templateId;
            return (
              <button
                key={templateId}
                className={cn(
                  "w-full rounded-lg border px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:border-slate-400 hover:bg-slate-50",
                )}
                onClick={() => onSelectTemplate(item)}
              >
                <div className="font-medium text-slate-900">{getTemplateName(item)}</div>
                {getTemplateMeta ? (
                  <div className="mt-0.5 text-xs text-slate-500">{getTemplateMeta(item)}</div>
                ) : null}
              </button>
            );
          })}
          {visibleItems.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">No templates found in this view.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
