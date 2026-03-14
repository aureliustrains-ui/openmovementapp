export type VideoSourceKind = "youtube" | "drive" | "file" | "link";

export type NormalizedVideoSource = {
  kind: VideoSourceKind;
  href: string;
  embedUrl?: string;
};

export function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/]+)/);
      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      }
    }
    if (host.includes("youtu.be")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function getDriveEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().includes("drive.google.com")) return null;
    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    const id = fileMatch?.[1] || parsed.searchParams.get("id");
    if (!id) return null;
    return `https://drive.google.com/file/d/${id}/preview`;
  } catch {
    return null;
  }
}

function isLikelyDirectVideoFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    return /\.(mp4|mov|webm|mkv|3gp|m4v|avi|wmv|mpeg|mpg)(?:$|\?)/i.test(pathname);
  } catch {
    return false;
  }
}

export function normalizeVideoSource(
  url: string,
  options?: { preferFile?: boolean },
): NormalizedVideoSource | null {
  try {
    new URL(url);
  } catch {
    return null;
  }

  if (options?.preferFile || isLikelyDirectVideoFileUrl(url)) {
    return { kind: "file", href: url };
  }

  const youtubeEmbed = getYouTubeEmbedUrl(url);
  if (youtubeEmbed) return { kind: "youtube", href: url, embedUrl: youtubeEmbed };

  const driveEmbed = getDriveEmbedUrl(url);
  if (driveEmbed) return { kind: "drive", href: url, embedUrl: driveEmbed };

  return { kind: "link", href: url };
}

