import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ACCEPTED_VIDEO_TYPES =
  "video/mp4,video/quicktime,video/webm,video/x-matroska,video/3gpp";

type VideoUploadFieldProps = {
  fileInputId: string;
  linkInputId: string;
  file: File | null;
  linkValue: string;
  onFileChange: (file: File | null) => void;
  onLinkChange: (value: string) => void;
  disabled?: boolean;
  fileTestId?: string;
  linkTestId?: string;
};

export function VideoUploadField({
  fileInputId,
  linkInputId,
  file,
  linkValue,
  onFileChange,
  onLinkChange,
  disabled = false,
  fileTestId,
  linkTestId,
}: VideoUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const openFilePicker = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleFileSelection = (nextFile: File | null) => {
    onFileChange(nextFile);
    setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    const droppedFile = event.dataTransfer?.files?.[0] || null;
    handleFileSelection(droppedFile);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES}
        className="sr-only"
        onChange={(event) => handleFileSelection(event.target.files?.[0] || null)}
        disabled={disabled}
        data-testid={fileTestId}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-2xl border-2 border-dashed bg-slate-50/70 px-4 py-8 text-center transition-colors",
          disabled
            ? "cursor-not-allowed border-slate-200 text-slate-400"
            : "cursor-pointer border-slate-300 hover:border-slate-400 hover:bg-slate-100/70",
          dragActive && !disabled ? "border-slate-500 bg-slate-100" : "",
        )}
      >
        <UploadCloud className="mx-auto h-8 w-8 text-slate-600" />
        <p className="mt-3 text-base font-semibold text-slate-900">Upload your video</p>
        <p className="mt-1 text-sm text-slate-600">Drag and drop a file here, or click to choose one.</p>
        <p className="mt-2 text-xs text-slate-500">MP4, MOV, WEBM, MKV, or 3GP (max 250MB)</p>
      </div>

      {file ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Selected file</p>
          <p className="mt-1 text-sm text-slate-800 break-all">{file.name}</p>
          {!disabled ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 h-7 px-2 text-xs text-slate-600"
              onClick={(event) => {
                event.preventDefault();
                onFileChange(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Remove file
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <Label htmlFor={linkInputId}>Video link (optional)</Label>
        <p className="text-xs text-slate-500">Use this if you cannot upload your video directly.</p>
        <Input
          id={linkInputId}
          placeholder="https://youtube.com/... or https://drive.google.com/..."
          value={linkValue}
          onChange={(event) => onLinkChange(event.target.value)}
          disabled={disabled}
          data-testid={linkTestId}
        />
      </div>
    </div>
  );
}
