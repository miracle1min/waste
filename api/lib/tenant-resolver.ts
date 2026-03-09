/**
 * Tenant Resolver — resolve credentials per-tenant dari Neon.
 */
import { getConfigByTenantId } from "./db";
import type { VercelRequest } from "@vercel/node";

export interface TenantCredentials {
  googleSpreadsheetId: string;
  googleSheetsCredentials: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
}

/** Extract tenant_id from request header or query */
export function extractTenantId(req: VercelRequest): string {
  return (req.headers["x-tenant-id"] as string) || (req.query?.tenant_id as string) || "";
}

/** Resolve tenant credentials — alias for backward compat */
export async function resolveTenantCredentials(tenantId: string): Promise<TenantCredentials> {
  return resolveTenant(tenantId);
}

export async function resolveTenant(tenantId: string): Promise<TenantCredentials> {
  if (!tenantId) throw new Error("tenant_id wajib diisi!");

  const config = await getConfigByTenantId(tenantId);

  // Fallback to env vars if no tenant config found (for backward compat / default tenant)
  if (!config) {
    return {
      googleSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || "",
      googleSheetsCredentials: process.env.GOOGLE_SHEETS_CREDENTIALS || "",
      r2AccountId: process.env.R2_ACCOUNT_ID || "",
      r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      r2BucketName: process.env.R2_BUCKET_NAME || "",
      r2PublicUrl: process.env.R2_PUBLIC_URL || "",
    };
  }

  return {
    googleSpreadsheetId: config.google_spreadsheet_id || process.env.GOOGLE_SPREADSHEET_ID || "",
    googleSheetsCredentials: config.google_sheets_credentials || process.env.GOOGLE_SHEETS_CREDENTIALS || "",
    r2AccountId: config.r2_account_id || process.env.R2_ACCOUNT_ID || "",
    r2AccessKeyId: config.r2_access_key_id || process.env.R2_ACCESS_KEY_ID || "",
    r2SecretAccessKey: config.r2_secret_access_key || process.env.R2_SECRET_ACCESS_KEY || "",
    r2BucketName: config.r2_bucket_name || process.env.R2_BUCKET_NAME || "",
    r2PublicUrl: config.r2_public_url || process.env.R2_PUBLIC_URL || "",
  };
}
