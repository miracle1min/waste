import { put } from "@vercel/blob";
import type { VercelRequest } from "@vercel/node";

function getBlobAccess(): "public" | "private" {
  const access = (process.env.BLOB_STORAGE_ACCESS || "private").toLowerCase();
  return access === "private" ? "private" : "public";
}

function sanitizePathSegment(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/\.\./g, "")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
}

export function buildBlobPath(folder: string, fileName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const safeFolder = sanitizePathSegment(folder).replace(/\/$/, "");
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${safeFolder}/${timestamp}-${random}-${safeName}`;
}

export async function uploadToBlob(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string,
): Promise<string> {
  const pathname = buildBlobPath(folder, fileName);
  const blob = await put(pathname, fileBuffer, {
    access: getBlobAccess(),
    addRandomSuffix: false,
    contentType: mimeType,
  });
  return blob.url;
}

export function getRequestOrigin(req: Pick<VercelRequest, "headers">): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    (req.headers.host as string) ||
    "";
  return `${proto}://${host}`;
}

export function buildBlobProxyUrl(blobUrl: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/signatures?blobUrl=${encodeURIComponent(blobUrl)}`;
}

export function isPrivateBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith(".private.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function resolveStoredAssetUrl(
  storedUrl: string | null | undefined,
  legacyBaseUrl?: string,
  origin?: string,
): string | null {
  if (!storedUrl) return null;
  if (/^https?:\/\//i.test(storedUrl)) {
    if (origin && isPrivateBlobUrl(storedUrl)) {
      return buildBlobProxyUrl(storedUrl, origin);
    }
    return storedUrl;
  }
  const normalizedBase = (legacyBaseUrl || "").replace(/\/$/, "");
  if (!normalizedBase) return storedUrl;
  return `${normalizedBase}/${storedUrl.replace(/^\/+/, "")}`;
}
