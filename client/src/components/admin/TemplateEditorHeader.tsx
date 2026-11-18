import { Link } from "wouter";
import { ArrowLeft, Copy, Loader2, MoreHorizontal, Save, Trash2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AutosaveStatus } from "@/hooks/useAutosave";

type TemplateEditorHeaderProps = {
  backHref: string;
  /** Embedded (side panel) mode: close instead of navigating back. */
  onClose?: () => void;
  title: string;
  name: string;
  onNameChange: (value: string) => void;
  onSave: () => void;
  saveDisabled?: boolean;
  saving?: boolean;
  autosaveStatus?: AutosaveStatus;
  onDelete?: () => void;
  onDuplicate?: () => void;
};

export function TemplateEditorHeader({
  backHref,
  onClose,
  title,
  name,
  onNameChange,
  onSave,
  saveDisabled = false,
  saving = false,
  autosaveStatus = "idle",
  onDelete,
  onDuplicate,
}: TemplateEditorHeaderProps) {
  const autosaveLabel =
    autosaveStatus === "saving"
      ? "Autosaving..."
      : autosaveStatus === "dirty"
        ? "Unsaved changes"
        : autosaveStatus === "saved"
          ? "Autosaved"
          : autosaveStatus === "error"
            ? "Autosave failed"
            : "";

  return (
    <div
      className={
        onClose
          ? "flex items-center justify-between gap-3 border-b border-slate-200 pb-3 pr-8"
          : "sticky top-0 z-20 -mx-6 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur-xl md:-mx-8 md:px-8"
      }
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {onClose ? (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Link href={backHref}>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {title}
          </p>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="max-w-lg border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
          />
          {autosaveLabel ? (
            <p
              className={`mt-1 text-xs ${
                autosaveStatus === "error" ? "text-red-500" : "text-slate-400"
              }`}
            >
              {autosaveLabel}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={onSave}
          disabled={saveDisabled}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save
        </Button>
        {onDuplicate || onDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="border-slate-200 bg-white" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onDuplicate ? (
                <DropdownMenuItem onSelect={onDuplicate}>
                  <Copy className="mr-2 h-4 w-4" /> Duplicate
                </DropdownMenuItem>
              ) : null}
              {onDuplicate && onDelete ? <DropdownMenuSeparator /> : null}
              {onDelete ? (
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600"
                  onSelect={onDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
