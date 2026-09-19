import { Link } from "wouter";
import { ArrowLeft, Copy, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AutosaveStatus } from "@/hooks/useAutosave";

type TemplateEditorHeaderProps = {
  backHref: string;
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
    <div className="sticky top-0 z-20 -mx-6 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur-xl md:-mx-8 md:px-8">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link href={backHref}>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
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
        {onDuplicate && (
          <Button variant="outline" className="border-slate-200 bg-white" onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-2" /> Duplicate
          </Button>
        )}
        {onDelete && (
          <Button
            variant="outline"
            className="border-red-200 bg-white text-red-600 hover:bg-red-50"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        )}
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
      </div>
    </div>
  );
}
