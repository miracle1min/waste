/**
 * Tenant Resolver — resolve credentials per-tenant.
 * Baca config dari Master Sheet, fallback ke global env vars.
 */
import { getTenantConfig, type TenantConfig } from './master-sheet';

export interface TenantCredentials {
  googleCredentials: string;
  googleSpreadsheetId: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
}

/**
 * Resolve credentials untuk tenant tertentu.
 * Kalau tenant_id kosong atau config belum lengkap, pakai global env.
 */
export async function resolveTenantCredentials(tenantId?: string): Promise<TenantCredentials> {
  // Global defaults dari env
  const globalCreds: TenantCredentials = {
    googleCredentials: process.env.GOOGLE_SHEETS_CREDENTIALS || '',
    googleSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
    r2AccountId: process.env.R2_ACCOUNT_ID || '',
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    r2BucketName: process.env.R2_BUCKET_NAME || '',
    r2PublicUrl: process.env.R2_PUBLIC_URL || '',
  };

  if (!tenantId) return globalCreds;

  try {
    const config = await getTenantConfig(tenantId);
    if (!config) return globalCreds;

    return {
      googleCredentials: globalCreds.googleCredentials, // Service account tetap global
      googleSpreadsheetId: config.google_sheet_id || globalCreds.googleSpreadsheetId,
      r2AccountId: config.r2_account_id || globalCreds.r2AccountId,
      r2AccessKeyId: config.r2_access_key_id || globalCreds.r2AccessKeyId,
      r2SecretAccessKey: config.r2_secret_access_key || globalCreds.r2SecretAccessKey,
      r2BucketName: config.r2_bucket_name || globalCreds.r2BucketName,
      r2PublicUrl: config.r2_public_url || globalCreds.r2PublicUrl,
    };
  } catch (err) {
    console.error('Failed to resolve tenant config, using global:', err);
    return globalCreds;
  }
}

/**
 * Extract tenant_id dari request headers atau query params.
 */
export function extractTenantId(req: any): string | undefined {
  return req.headers?.['x-tenant-id'] || req.query?.tenant_id;
}
