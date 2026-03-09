/**
 * Tenant Resolver — resolve credentials per-tenant dari Neon.
 */
import { getConfigByTenantId } from "./db";

export interface TenantCredentials {
  googleSpreadsheetId: string;
  googleSheetsCredentials: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
}

export async function resolveTenant(tenantId: string): Promise<TenantCredentials> {
  if (!tenantId) throw new Error("tenant_id wajib diisi!");

  const config = await getConfigByTenantId(tenantId);
  if (!config) throw new Error(`Config buat tenant '${tenantId}' ga ketemu!`);

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
