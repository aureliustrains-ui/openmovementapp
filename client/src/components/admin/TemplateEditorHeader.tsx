import { Link } from "wouter";
import { ArrowLeft, Copy, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TemplateEditorHeaderProps = {
  backHref: string;
  title: string;
  name: string;
  onNameChange: (value: string) => void;
  onSave: () => void;
  saveDisabled?: boolean;
  saving?: boolean;
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
  onDelete,
  onDuplicate,
}: TemplateEditorHeaderProps) {
  return (
    <div className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 py-4 -mx-6 px-6 md:-mx-8 md:px-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link href={backHref}>
          <Button variant="ghost" size="icon" className="rounded-full bg-slate-800 border border-slate-700 text-white hover:bg-slate-700">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-slate-300 font-semibold mb-1">{title}</p>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} className="max-w-lg bg-slate-800 border-slate-700 text-white placeholder:text-slate-400" />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onDuplicate && (
          <Button variant="outline" className="border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-2" /> Duplicate
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" className="text-red-200 border-red-400/50 bg-red-900/30 hover:bg-red-900/50" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        )}
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={onSave} disabled={saveDisabled}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>
    </div>
  );
}
