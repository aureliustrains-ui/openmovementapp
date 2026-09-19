import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Folder, Save } from "lucide-react";
import { templateFoldersQuery, type TemplateFolderType } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SaveToTemplateDialogProps = {
  open: boolean;
  type: TemplateFolderType;
  title: string;
  itemName: string;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (folderId: string | null) => void;
};

function buildFolderLabel(
  folder: { id: string; name: string; parentId?: string | null },
  all: any[],
) {
  const names = [folder.name];
  let parentId = folder.parentId || null;
  while (parentId) {
    const parent = all.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId || null;
  }
  return names.join(" / ");
}

export function SaveToTemplateDialog({
  open,
  type,
  title,
  itemName,
  saving = false,
  onOpenChange,
  onSave,
}: SaveToTemplateDialogProps) {
  const [folderValue, setFolderValue] = useState("root");
  const { data: folders = [] } = useQuery(templateFoldersQuery(type));

  useEffect(() => {
    if (open) setFolderValue("root");
  }, [open, type]);

  const sortedFolders = useMemo(
    () =>
      [...folders].sort((a: any, b: any) =>
        buildFolderLabel(a, folders).localeCompare(buildFolderLabel(b, folders)),
      ),
    [folders],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Save "{itemName || "Untitled"}" into the template library.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Folder</Label>
          <Select value={folderValue} onValueChange={setFolderValue}>
            <SelectTrigger>
              <SelectValue placeholder="Choose folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">
                <span className="inline-flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  All templates
                </span>
              </SelectItem>
              {sortedFolders.map((folder: any) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {buildFolderLabel(folder, folders)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-indigo-600 text-white hover:bg-indigo-700"
            disabled={saving}
            onClick={() => onSave(folderValue === "root" ? null : folderValue)}
          >
            <Save className="mr-2 h-4 w-4" />
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
