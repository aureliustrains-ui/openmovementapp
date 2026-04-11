import { Button } from "@/components/ui/button";
import { ExternalLink, Video } from "lucide-react";
import { normalizeVideoSource } from "@/lib/video";

type Props = {
  url?: string | null;
  sourceType?: "upload" | "link" | string | null;
  openLinkLabel?: string;
  testId?: string;
  flush?: boolean;
};

export function InlineVideoPlayer({
  url,
  sourceType,
  openLinkLabel = "Open video",
  testId,
  flush = false,
}: Props) {
  if (!url) return null;

  const normalized = normalizeVideoSource(url, { preferFile: sourceType === "upload" });
  if (!normalized) return null;

  if (normalized.kind === "file") {
    return (
      <div className={flush ? "" : "rounded-xl border border-slate-200 bg-slate-50 p-3"} data-testid={testId}>
        <div className={flush ? "aspect-[16/10] sm:aspect-video overflow-hidden rounded-xl bg-black" : "aspect-video overflow-hidden rounded-lg bg-black"}>
          <video
            src={normalized.href}
            controls
            preload="metadata"
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        </div>
      </div>
    );
  }

  if (normalized.embedUrl) {
    return (
      <div className={flush ? "" : "rounded-xl border border-slate-200 bg-slate-50 p-3"} data-testid={testId}>
        <div className={flush ? "aspect-[16/10] sm:aspect-video overflow-hidden rounded-xl bg-black" : "aspect-video overflow-hidden rounded-lg bg-black"}>
          <iframe
            src={normalized.embedUrl}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            title="Embedded video"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid={testId}>
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <Video className="h-4 w-4 text-slate-500" />
        Video link available
      </div>
      <a href={normalized.href} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm">
          <ExternalLink className="mr-1.5 h-4 w-4" />
          {openLinkLabel}
        </Button>
      </a>
    </div>
  );
}
