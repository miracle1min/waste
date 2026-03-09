/**
 * API Client — otomatis nambah tenant_id header + JWT token di setiap request.
 * BUG-002 fix: Send JWT token in Authorization header.
 * BUG-019 fix: All API calls now go through this client.
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

export function getAuthToken(): string {
  return localStorage.getItem("waste_app_token") || "";
}

/**
 * Fetch wrapper yang otomatis inject x-tenant-id header + Authorization Bearer token.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const tenantId = getTenantId();
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (tenantId) {
    headers.set("x-tenant-id", tenantId);
  }
  // BUG-002 fix: Send JWT token instead of relying on client-side role headers
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
}

/**
 * Tambah tenant_id ke URL sebagai query param.
 */
export function withTenantParam(url: string): string {
  const tenantId = getTenantId();
  if (!tenantId) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}tenant_id=${tenantId}`;
}
