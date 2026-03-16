import { apiFetch } from "@/lib/api-client";

// ===== Types =====
export interface Tenant { id: string; name: string; address: string; phone: string; status: string; neon_database_url: string; created_at: string; }
export interface UserItem { id: string; tenant_id: string; username: string; role: string; created_at: string; }
export interface Personnel { id: number; tenant_id: string; name: string; full_name: string; role: string; signature_url: string; status: string; created_at: string; }
export interface TenantConfig { tenant_id: string; google_spreadsheet_id: string; google_sheets_credentials: string; r2_account_id: string; r2_access_key_id: string; r2_secret_access_key: string; r2_bucket_name: string; r2_public_url: string; updated_at: string; }

export type PageKey = "overview" | "tenants" | "users" | "google-users" | "personnel" | "configs" | "database" | "activity";

// ===== API Helper (uses shared apiFetch for auth headers) =====
export async function api(url: string, method = "GET", body?: any) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await apiFetch(url, opts);
  return res.json();
}
