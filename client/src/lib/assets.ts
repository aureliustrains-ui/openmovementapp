type ImportMetaEnvLike = Record<string, string | boolean | undefined>;

function readImportMetaEnv(): ImportMetaEnvLike {
  const meta = import.meta as unknown as { env?: ImportMetaEnvLike };
  return meta.env || {};
}

function getDefaultDevApiOrigin(): string {
  if (typeof window === "undefined") return "http://localhost:5099";
  const protocol = window.location.protocol || "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:5099`;
}

export function resolveClientAssetUrl(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  const value = String(src).trim();
  if (!value) return undefined;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }
  if (!value.startsWith("/")) {
    return value;
  }

  const env = readImportMetaEnv();
  const assetBase = String(env.VITE_ASSET_BASE_URL || env.VITE_API_BASE_URL || "").trim();
  const devFallback =
    String(env.DEV).toLowerCase() === "true"
      ? String(env.VITE_DEV_API_ORIGIN || getDefaultDevApiOrigin()).trim()
      : "";
  const base = assetBase || devFallback;
  if (!base) return value;

  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}
