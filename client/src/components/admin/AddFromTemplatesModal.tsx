import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TemplateFolderType } from "@/lib/api";
import { TemplatePickerPanel } from "@/components/admin/TemplatePickerPanel";

type AddFromTemplatesModalProps<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  createLabel: string;
  allLabel: string;
  searchPlaceholder: string;
  folderType: TemplateFolderType;
  templates: T[];
  getTemplateId: (item: T) => string;
  getTemplateName: (item: T) => string;
  getTemplateMeta?: (item: T) => string;
  getTemplateFolderId?: (item: T) => string | null | undefined;
  onCreateNew: () => void;
  onInsertTemplate: (item: T) => void;
};

export function AddFromTemplatesModal<T>({
  open,
  onOpenChange,
  title,
  description,
  createLabel,
  allLabel,
  searchPlaceholder,
  folderType,
  templates,
  getTemplateId,
  getTemplateName,
  getTemplateMeta,
  getTemplateFolderId,
  onCreateNew,
  onInsertTemplate,
}: AddFromTemplatesModalProps<T>) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
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
            className="w-full justify-start border-slate-300 text-slate-700 hover:bg-slate-100"
            onClick={() => {
              onCreateNew();
              onOpenChange(false);
            }}
          >
            {createLabel}
          </Button>

          <p className="text-xs text-slate-500">
            Search in this picker is scoped to the currently selected folder location.
          </p>

          <TemplatePickerPanel
            templates={templates}
            folderType={folderType}
            allLabel={allLabel}
            searchPlaceholder={searchPlaceholder}
            getTemplateId={getTemplateId}
            getTemplateName={getTemplateName}
            getTemplateMeta={getTemplateMeta}
            getTemplateFolderId={getTemplateFolderId}
            onSelectTemplate={(item) => {
              onInsertTemplate(item);
              onOpenChange(false);
            }}
          />
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
