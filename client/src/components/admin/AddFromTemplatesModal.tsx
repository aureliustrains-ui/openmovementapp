import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type AddFromTemplatesModalProps<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  createLabel: string;
  searchPlaceholder: string;
  templates: T[];
  getTemplateId: (item: T) => string;
  getTemplateName: (item: T) => string;
  getTemplateMeta?: (item: T) => string;
  onCreateNew: () => void;
  onInsertTemplate: (item: T) => void;
};

export function AddFromTemplatesModal<T>({
  open,
  onOpenChange,
  title,
  description,
  createLabel,
  searchPlaceholder,
  templates,
  getTemplateId,
  getTemplateName,
  getTemplateMeta,
  onCreateNew,
  onInsertTemplate,
}: AddFromTemplatesModalProps<T>) {
  const [search, setSearch] = useState("");

  const filteredTemplates = useMemo(
    () => templates.filter((item) => getTemplateName(item).toLowerCase().includes(search.toLowerCase())),
    [templates, search, getTemplateName],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setSearch("");
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start text-indigo-700 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
            onClick={() => {
              onCreateNew();
              onOpenChange(false);
            }}
          >
            {createLabel}
          </Button>

          <div className="flex items-center gap-2 border rounded-md px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="border-none shadow-none focus-visible:ring-0 px-0"
            />
          </div>

          <div className="max-h-[52vh] overflow-y-auto space-y-2 pr-1">
            {filteredTemplates.map((item) => (
              <button
                key={getTemplateId(item)}
                className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                onClick={() => {
                  onInsertTemplate(item);
                  onOpenChange(false);
                }}
              >
                <div className="font-medium text-slate-900">{getTemplateName(item)}</div>
                {getTemplateMeta && <div className="text-xs text-slate-500 mt-0.5">{getTemplateMeta(item)}</div>}
              </button>
            ))}
            {filteredTemplates.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-4">No templates found.</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
