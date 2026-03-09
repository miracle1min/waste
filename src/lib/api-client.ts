/**
 * API Client — otomatis nambah tenant_id header di setiap request.
 */

export function getTenantId(): string {
  return localStorage.getItem("waste_app_tenant_id") || "";
}

export function getUserRole(): string {
  return localStorage.getItem("waste_app_role") || "";
}

export function getStoreName(): string {
  return localStorage.getItem("waste_app_tenant_name") || "";
}

export function getStoreCode(): string {
  return localStorage.getItem("waste_app_store_code") || "";
}

/**
 * Fetch wrapper yang otomatis inject x-tenant-id header.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const tenantId = getTenantId();
  const headers = new Headers(options.headers);
  if (tenantId) {
    headers.set("x-tenant-id", tenantId);
  }
  return fetch(url, { ...options, headers });
}

/**
 * Tambah tenant_id ke URL sebagai query param.
 * Berguna untuk URL yang ga bisa pakai custom headers (misal: direct link).
 */
export function withTenantParam(url: string): string {
  const tenantId = getTenantId();
  if (!tenantId) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}tenant_id=${tenantId}`;
}
