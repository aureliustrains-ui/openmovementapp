import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../http/error-handler";
import { getConfig } from "../config";

export type ClientVideoUploadPurpose = "movement_check" | "progress_report";

export const allowedClientVideoMimeTypes = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/3gpp",
] as const;

const mimeTypeToExt: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-matroska": ".mkv",
  "video/3gpp": ".3gp",
};

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function hasObjectStorageConfig() {
  const config = getConfig();
  return Boolean(
    config.OBJECT_STORAGE_BUCKET &&
    config.OBJECT_STORAGE_ACCESS_KEY_ID &&
    config.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  );
}

function createS3Client() {
  const config = getConfig();
  if (!hasObjectStorageConfig()) return null;
  return new S3Client({
    region: config.OBJECT_STORAGE_REGION,
    endpoint: config.OBJECT_STORAGE_ENDPOINT,
    forcePathStyle: config.OBJECT_STORAGE_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: config.OBJECT_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: config.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
    },
  });
}

export function getClientVideoMaxBytes() {
  return getConfig().CLIENT_VIDEO_MAX_SIZE_MB * 1024 * 1024;
}

export function validateClientVideoMetadata(input: {
  contentType: string;
  fileName: string;
  fileSize: number;
}) {
  const normalizedType = input.contentType.trim().toLowerCase();
  if (
    !allowedClientVideoMimeTypes.includes(
      normalizedType as (typeof allowedClientVideoMimeTypes)[number],
    )
  ) {
    throw new AppError(
      "Invalid video file type. Use mp4, mov, webm, mkv, or 3gp.",
      400,
      "INVALID_VIDEO_TYPE",
    );
  }
  const maxBytes = getClientVideoMaxBytes();
  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0 || input.fileSize > maxBytes) {
    throw new AppError(
      `Video is too large. Max size is ${getConfig().CLIENT_VIDEO_MAX_SIZE_MB}MB.`,
      400,
      "VIDEO_TOO_LARGE",
    );
  }
  if (!input.fileName || input.fileName.trim().length === 0) {
    throw new AppError("Video filename is required.", 400, "INVALID_VIDEO_FILENAME");
  }
}

function buildObjectKey(input: {
  clientId: string;
  purpose: ClientVideoUploadPurpose;
  fileName: string;
  contentType: string;
}) {
  const rawExt = extname(input.fileName).toLowerCase();
  const mappedExt = mimeTypeToExt[input.contentType] || ".mp4";
  const extension = rawExt || mappedExt;
  const baseName = sanitizeFilename(input.fileName.replace(/\.[^.]+$/, "")).slice(0, 72) || "video";
  const dateBucket = new Date().toISOString().slice(0, 10);
  const prefix = input.purpose === "movement_check" ? "movement-checks" : "progress-reports";
  return `${prefix}/${input.clientId}/${dateBucket}/${randomUUID()}-${baseName}${extension}`;
}

export function isClientOwnedObjectKey(clientId: string, objectKey: string): boolean {
  return (
    objectKey.startsWith(`movement-checks/${clientId}/`) ||
    objectKey.startsWith(`progress-reports/${clientId}/`)
  );
}

export async function createClientVideoUploadTarget(input: {
  clientId: string;
  purpose: ClientVideoUploadPurpose;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  validateClientVideoMetadata({
    contentType: input.contentType,
    fileName: input.fileName,
    fileSize: input.fileSize,
  });

  const config = getConfig();
  const objectKey = buildObjectKey(input);

  if (!hasObjectStorageConfig()) {
    if (config.NODE_ENV === "test") {
      return {
        objectKey,
        uploadUrl: `https://upload.test.invalid/${encodeURIComponent(objectKey)}`,
        expiresInSeconds: config.OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS,
      };
    }
    throw new AppError(
      "Video upload storage is not configured. Use link submission or configure object storage.",
      503,
      "OBJECT_STORAGE_NOT_CONFIGURED",
    );
  }

  const s3 = createS3Client();
  if (!s3) {
    throw new AppError("Object storage is unavailable.", 503, "OBJECT_STORAGE_NOT_CONFIGURED");
  }

  const command = new PutObjectCommand({
    Bucket: config.OBJECT_STORAGE_BUCKET!,
    Key: objectKey,
    ContentType: input.contentType,
    Metadata: {
      clientid: input.clientId,
      purpose: input.purpose,
    },
  });
  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: config.OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS,
  });

  return {
    objectKey,
    uploadUrl,
    expiresInSeconds: config.OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS,
  };
}

export async function resolveClientVideoPlaybackUrl(objectKey: string): Promise<string | null> {
  const config = getConfig();
  if (!objectKey) return null;

  if (!hasObjectStorageConfig()) {
    if (config.NODE_ENV === "test") {
      return `https://cdn.test.invalid/${encodeURIComponent(objectKey)}`;
    }
    return null;
  }

  const s3 = createS3Client();
  if (!s3) return null;
  const command = new GetObjectCommand({
    Bucket: config.OBJECT_STORAGE_BUCKET!,
    Key: objectKey,
  });
  return getSignedUrl(s3, command, {
    expiresIn: config.OBJECT_STORAGE_READ_URL_TTL_SECONDS,
  });
}
