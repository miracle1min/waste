import { upload } from "@vercel/blob/client";
import { getAuthToken, getStoreName, getTenantId } from "./api-client";

type UploadKind = "dokumentasi" | "pdf";

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function buildUploadPath(kind: UploadKind, tenantId: string, fileName: string): string {
  const safeTenant = sanitizeSegment(tenantId);
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  if (kind === "pdf") {
    return `${safeTenant}/pdf-reports/${timestamp}-${random}-${safeFileName}`;
  }

  return `${safeTenant}/waste-management/dokumentasi/${timestamp}-${random}-${safeFileName}`;
}

function buildBlobProxyUrl(blobUrl: string): string {
  return `${window.location.origin}/api/signatures?blobUrl=${encodeURIComponent(blobUrl)}`;
}

export async function uploadFileToBlob(
  file: Blob | File,
  fileName: string,
  kind: UploadKind,
  onUploadProgress?: (progress: { loaded: number; total: number; percentage: number }) => void,
): Promise<string> {
  const token = getAuthToken();
  const tenantId = getTenantId() || getStoreName() || "single-tenant";

  if (!token) {
    throw new Error("Token autentikasi tidak ditemukan.");
  }

  const pathname = buildUploadPath(kind, tenantId, fileName);
  const result = await upload(pathname, file, {
    access: "private",
    handleUploadUrl: "/api/auto-submit?mode=blob-upload",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    clientPayload: JSON.stringify({ kind, tenantId }),
    multipart: file.size > 4_500_000,
    onUploadProgress,
  });

  return buildBlobProxyUrl(result.url);
}
