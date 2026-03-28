import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { templateFoldersQuery, type TemplateFolderType } from "@/lib/api";
import { cn } from "@/lib/utils";

const VIEW_ALL = "__all__";

type TemplatePickerPanelProps<T> = {
  templates: T[];
  folderType: TemplateFolderType;
  allLabel: string;
  searchPlaceholder: string;
  getTemplateId: (item: T) => string;
  getTemplateName: (item: T) => string;
  getTemplateMeta?: (item: T) => string;
  getTemplateFolderId?: (item: T) => string | null | undefined;
  selectedTemplateId?: string | null;
  onSelectTemplate: (item: T) => void;
};

export function TemplatePickerPanel<T>({
  templates,
  folderType,
  allLabel,
  searchPlaceholder,
  getTemplateId,
  getTemplateName,
  getTemplateMeta,
  getTemplateFolderId,
  selectedTemplateId = null,
  onSelectTemplate,
}: TemplatePickerPanelProps<T>) {
  const { data: folders = [] } = useQuery({
    ...templateFoldersQuery(folderType),
    enabled: Boolean(folderType),
  });
  const [selectedView, setSelectedView] = useState<string>(VIEW_ALL);
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [search, setSearch] = useState("");

  const sortedFolders = useMemo(
    () =>
      [...folders].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      }),
    [folders],
  );

  useEffect(() => {
    if (selectedView === VIEW_ALL) return;
    if (!sortedFolders.some((folder) => folder.id === selectedView)) {
      setSelectedView(VIEW_ALL);
    }
  }, [selectedView, sortedFolders]);

  const counts = useMemo(() => {
    const folderCounts = new Map<string, number>();
    for (const item of templates) {
      const folderId = getTemplateFolderId ? getTemplateFolderId(item) : null;
      if (folderId) {
        folderCounts.set(folderId, (folderCounts.get(folderId) || 0) + 1);
      }
    }
    return {
      all: templates.length,
      byFolder: folderCounts,
    };
  }, [templates, getTemplateFolderId]);

  const baseItems = useMemo(() => {
    if (selectedView === VIEW_ALL) return templates;
    return templates.filter((item) => {
      const folderId = getTemplateFolderId ? getTemplateFolderId(item) : null;
      return folderId === selectedView;
    });
  }, [templates, selectedView, getTemplateFolderId]);

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return baseItems;
    return baseItems.filter((item) =>
      getTemplateName(item).toLowerCase().includes(normalizedSearch),
    );
  }, [baseItems, search, getTemplateName]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2 space-y-2">
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm text-left",
            selectedView === VIEW_ALL
              ? "bg-slate-900 text-white"
              : "text-slate-700 hover:bg-white",
          )}
          onClick={() => setSelectedView(VIEW_ALL)}
        >
          <span className="font-medium">{allLabel}</span>
          <span className="text-xs opacity-80">{counts.all}</span>
        </button>

        <div className="rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            className="flex w-full items-center justify-between px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
            onClick={() => setFoldersExpanded((prev) => !prev)}
          >
            <span>Folders</span>
            {foldersExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          {foldersExpanded ? (
            <div className="space-y-1 border-t border-slate-200 p-1.5">
              {sortedFolders.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-slate-500">No folders yet.</p>
              ) : (
                sortedFolders.map((folder) => {
                  const isSelected = selectedView === folder.id;
                  const count = counts.byFolder.get(folder.id) || 0;
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
                        isSelected
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-100",
                      )}
                      onClick={() => setSelectedView(folder.id)}
                    >
                      <span className="truncate">{folder.name}</span>
                      <span className="text-xs opacity-80">{count}</span>
                    </button>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="flex items-center gap-2 border rounded-md px-3 bg-white">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="border-none shadow-none focus-visible:ring-0 px-0"
          />
        </div>

        <div className="max-h-[52vh] overflow-y-auto space-y-2 pr-1">
          {visibleItems.map((item) => {
            const templateId = getTemplateId(item);
            const isSelected = selectedTemplateId === templateId;
            return (
              <button
                key={templateId}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg border transition-colors",
                  isSelected
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:border-slate-400 hover:bg-slate-50",
                )}
                onClick={() => onSelectTemplate(item)}
              >
                <div className="font-medium text-slate-900">{getTemplateName(item)}</div>
                {getTemplateMeta ? (
                  <div className="text-xs text-slate-500 mt-0.5">{getTemplateMeta(item)}</div>
                ) : null}
              </button>
            );
          })}
          {visibleItems.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-6">
              No templates found in this view.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
