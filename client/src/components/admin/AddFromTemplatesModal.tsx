import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TemplateFolderType } from "@/lib/api";
import { TemplatePickerPanel } from "@/components/admin/TemplatePickerPanel";
import { Plus } from "lucide-react";

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
  getTemplateSearchText?: (item: T) => string;
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
  getTemplateSearchText,
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
      <DialogContent className="flex h-[88vh] max-h-[88vh] w-[94vw] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-5 py-4 pr-14">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-slate-300 text-slate-700 hover:bg-slate-100"
              onClick={() => {
                onCreateNew();
                onOpenChange(false);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {createLabel}
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 p-5">
          <TemplatePickerPanel
            templates={templates}
            folderType={folderType}
            allLabel={allLabel}
            searchPlaceholder={searchPlaceholder}
            getTemplateId={getTemplateId}
            getTemplateName={getTemplateName}
            getTemplateMeta={getTemplateMeta}
            getTemplateSearchText={getTemplateSearchText}
            getTemplateFolderId={getTemplateFolderId}
            onSelectTemplate={(item) => {
              onInsertTemplate(item);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
