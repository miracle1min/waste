/**
 * Tenant Database Resolver — per-resto DB isolation.
 * 
 * Master DB (NEON_DATABASE_URL): stores tenants registry only.
 * Per-Tenant DB (tenants.neon_database_url): stores users, configs, personnel.
 */
import { neon } from "@neondatabase/serverless";

/** Cache tenant DB URLs to avoid repeated master lookups */
const tenantDbCache = new Map<string, { url: string; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute
const SINGLE_TENANT_CACHE_KEY = "__single_tenant__";

function isSingleTenantMode(): boolean {
  return process.env.SINGLE_TENANT_MODE !== "false";
}

export function getConfiguredSingleTenantId(): string {
  return process.env.SINGLE_TENANT_ID || process.env.ACTIVE_TENANT_ID || process.env.DEFAULT_TENANT_ID || "";
}

function getConfiguredSingleTenantDbUrl(): string {
  return process.env.SINGLE_TENANT_DATABASE_URL || "";
}

function getEffectiveTenantId(tenantId: string): string {
  return getConfiguredSingleTenantId() || tenantId;
}

/** Get master DB SQL connection */
export function getMasterSQL() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) throw new Error("NEON_DATABASE_URL not set");
  return neon(url);
}

/** Look up tenant's neon_database_url from master DB */
async function resolveTenantDbUrl(tenantId: string): Promise<string> {
  if (isSingleTenantMode()) {
    const cacheKey = SINGLE_TENANT_CACHE_KEY;
    const cached = tenantDbCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.url;
    }

    const configuredDbUrl = getConfiguredSingleTenantDbUrl() || process.env.NEON_DATABASE_URL || "";
    if (!configuredDbUrl) {
      throw new Error("Single-tenant database URL belum dikonfigurasi.");
    }

    tenantDbCache.set(cacheKey, { url: configuredDbUrl, ts: Date.now() });
    return configuredDbUrl;
  }

  if (!tenantId) throw new Error("tenant_id wajib diisi!");

  // Check cache
  const cached = tenantDbCache.get(tenantId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.url;
  }

  const masterSql = getMasterSQL();
  const rows = await masterSql`SELECT neon_database_url FROM tenants WHERE id = ${tenantId} AND status = 'active'`;
  
  if (!rows.length) {
    throw new Error(`Tenant "${tenantId}" tidak ditemukan!`);
  }

  const dbUrl = rows[0].neon_database_url;
  if (!dbUrl) {
    throw new Error(`Tenant "${tenantId}" belum punya database aktif.`);
  }

  tenantDbCache.set(tenantId, { url: dbUrl, ts: Date.now() });
  return dbUrl;
}

/** Get SQL connection for a specific tenant's database */
export async function getTenantSQL(tenantId: string) {
  const dbUrl = await resolveTenantDbUrl(getEffectiveTenantId(tenantId));
  return neon(dbUrl);
}

/** Run a query against a tenant's database */
export async function tenantQuery(tenantId: string, sql: string, params: any[] = []): Promise<any[]> {
  const db = await getTenantSQL(getEffectiveTenantId(tenantId));
  const result = await db(sql, params);
  return result as any[];
}

/** Clear cache for a specific tenant (e.g., after updating neon_database_url) */
export function clearTenantDbCache(tenantId?: string) {
  if (tenantId) {
    tenantDbCache.delete(tenantId);
  } else {
    tenantDbCache.clear();
  }
}
