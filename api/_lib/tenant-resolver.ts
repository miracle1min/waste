/**
 * Tenant Resolver — resolve credentials per-tenant dari Neon.
 */
import { getConfigByTenantId } from "./db.js";
import type { VercelRequest } from "@vercel/node";
import { getConfiguredSingleTenantId } from "./tenant-db.js";

export interface TenantCredentials {
  googleSpreadsheetId: string;
  googleSheetsCredentials: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
}

function isSingleTenantMode(): boolean {
  return process.env.SINGLE_TENANT_MODE !== "false";
}

function getEnvCredentials(): TenantCredentials {
  return {
    googleSpreadsheetId: process.env.SINGLE_TENANT_GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID || "",
    googleSheetsCredentials:
      process.env.SINGLE_TENANT_GOOGLE_SHEETS_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS || "",
    r2AccountId: process.env.SINGLE_TENANT_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || "",
    r2AccessKeyId: process.env.SINGLE_TENANT_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "",
    r2SecretAccessKey:
      process.env.SINGLE_TENANT_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || "",
    r2BucketName: process.env.SINGLE_TENANT_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || "",
    r2PublicUrl: process.env.SINGLE_TENANT_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || "",
  };
}

/** Extract tenant_id from request header or query */
export function extractTenantId(req: VercelRequest): string {
  if (isSingleTenantMode()) {
    return getConfiguredSingleTenantId() || "single-tenant";
  }
  return (req.headers["x-tenant-id"] as string) || (req.query?.tenant_id as string) || "";
}

/** Resolve tenant credentials — alias for backward compat */
export async function resolveTenantCredentials(tenantId: string): Promise<TenantCredentials> {
  return resolveTenant(tenantId);
}

export async function resolveTenant(tenantId: string): Promise<TenantCredentials> {
  const effectiveTenantId = getConfiguredSingleTenantId() || tenantId;

  if (isSingleTenantMode()) {
    return getEnvCredentials();
  }

  if (!effectiveTenantId) throw new Error("tenant_id wajib diisi!");

  const config = await getConfigByTenantId(effectiveTenantId);

  // Fallback to env vars if no tenant config found (for backward compat / default tenant)
  if (!config) {
    return getEnvCredentials();
  }

  const envCredentials = getEnvCredentials();
  return {
    googleSpreadsheetId: config.google_spreadsheet_id || envCredentials.googleSpreadsheetId,
    googleSheetsCredentials: config.google_sheets_credentials || envCredentials.googleSheetsCredentials,
    r2AccountId: config.r2_account_id || envCredentials.r2AccountId,
    r2AccessKeyId: config.r2_access_key_id || envCredentials.r2AccessKeyId,
    r2SecretAccessKey: config.r2_secret_access_key || envCredentials.r2SecretAccessKey,
    r2BucketName: config.r2_bucket_name || envCredentials.r2BucketName,
    r2PublicUrl: config.r2_public_url || envCredentials.r2PublicUrl,
  };
}
