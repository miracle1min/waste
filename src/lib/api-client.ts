import { dispatchAuthExpired } from "@/hooks/useAuth";

/**
 * API Client — otomatis nambah tenant_id header + JWT token di setiap request.
 * BUG-002 fix: Send JWT token in Authorization header.
 * BUG-019 fix: All API calls now go through this client.
 * 
 * Enhanced: retry logic for network errors & 5xx responses
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

// ========================
// ERROR TYPES
// ========================

export type ApiErrorType = "network" | "timeout" | "server" | "auth" | "validation" | "unknown";

export class ApiRequestError extends Error {
  public readonly type: ApiErrorType;
  public readonly status?: number;
  public readonly retryable: boolean;

  constructor(message: string, type: ApiErrorType, status?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.type = type;
    this.status = status;
    // Network, timeout, and server (5xx) errors are retryable
    this.retryable = type === "network" || type === "timeout" || type === "server";
  }
}

// User-friendly error messages per type
const ERROR_MESSAGES: Record<ApiErrorType, string> = {
  network: "Koneksi internet bermasalah. Cek WiFi/data kamu.",
  timeout: "Server lama banget responnya. Coba lagi nanti.",
  server: "Server lagi error. Coba lagi dalam beberapa detik.",
  auth: "Sesi kamu udah expired. Login ulang ya.",
  validation: "Data yang dikirim ga valid.",
  unknown: "Terjadi kesalahan. Coba lagi.",
};

export function getErrorMessage(type: ApiErrorType): string {
  return ERROR_MESSAGES[type] || ERROR_MESSAGES.unknown;
}

// ========================
// RETRY CONFIG
// ========================

interface RetryConfig {
  maxRetries?: number;       // default: 2 (total 3 attempts)
  baseDelay?: number;        // default: 1000ms
  maxDelay?: number;         // default: 5000ms
  retryOn5xx?: boolean;      // default: true
  retryOnNetwork?: boolean;  // default: true
  timeout?: number;          // default: 30000ms (30s)
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 2,
  baseDelay: 1000,
  maxDelay: 5000,
  retryOn5xx: true,
  retryOnNetwork: true,
  timeout: 30000,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff with jitter
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = delay * 0.2 * Math.random(); // ±20% jitter
  return delay + jitter;
}

// ========================
// MAIN FETCH WRAPPER
// ========================

/**
 * Fetch wrapper dengan:
 * - Auto inject x-tenant-id header + Authorization Bearer token
 * - Retry logic untuk network errors & 5xx
 * - Timeout support
 * - Typed errors
 */
export async function apiFetch(
  url: string, 
  options: RequestInit = {},
  retryConfig?: RetryConfig
): Promise<Response> {
  const config = { ...DEFAULT_RETRY, ...retryConfig };
  const tenantId = getTenantId();
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (tenantId) {
    headers.set("x-tenant-id", tenantId);
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fetchOptions = { ...options, headers };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= (config.maxRetries || 0); attempt++) {
    try {
      // Add timeout via AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);
      
      const response = await fetch(url, { 
        ...fetchOptions, 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);

      // Check for server errors (5xx) — retryable
      if (response.status >= 500 && config.retryOn5xx && attempt < (config.maxRetries || 0)) {
        console.warn(`[apiFetch] Server error ${response.status} on ${url}, retry ${attempt + 1}/${config.maxRetries}`);
        await sleep(getDelay(attempt, config.baseDelay!, config.maxDelay!));
        continue;
      }

      // Auth errors — dispatch global logout event + throw
      if (response.status === 401 || response.status === 403) {
        dispatchAuthExpired({
          reason: response.status === 401 ? "api_401" : "api_403",
          message: response.status === 401 
            ? "Sesi expired, otomatis logout..." 
            : "Akses ditolak, otomatis logout...",
        });
        throw new ApiRequestError(
          response.status === 401 ? "Sesi expired, login ulang." : "Kamu ga punya akses.",
          "auth",
          response.status
        );
      }

      return response;
    } catch (error: any) {
      // Don't retry ApiRequestError (auth errors etc)
      if (error instanceof ApiRequestError) {
        throw error;
      }

      // Timeout (AbortError)
      if (error.name === "AbortError") {
        lastError = new ApiRequestError(
          "Request timeout — server ga respon.",
          "timeout"
        );
        if (attempt < (config.maxRetries || 0)) {
          console.warn(`[apiFetch] Timeout on ${url}, retry ${attempt + 1}/${config.maxRetries}`);
          await sleep(getDelay(attempt, config.baseDelay!, config.maxDelay!));
          continue;
        }
        throw lastError;
      }

      // Network errors (TypeError: Failed to fetch)
      if (error instanceof TypeError || error.message?.includes("fetch")) {
        lastError = new ApiRequestError(
          "Koneksi gagal — cek internet kamu.",
          "network"
        );
        if (config.retryOnNetwork && attempt < (config.maxRetries || 0)) {
          console.warn(`[apiFetch] Network error on ${url}, retry ${attempt + 1}/${config.maxRetries}`);
          await sleep(getDelay(attempt, config.baseDelay!, config.maxDelay!));
          continue;
        }
        throw lastError;
      }

      // Unknown errors
      lastError = new ApiRequestError(
        error.message || "Terjadi kesalahan.",
        "unknown"
      );
      if (attempt < (config.maxRetries || 0)) {
        await sleep(getDelay(attempt, config.baseDelay!, config.maxDelay!));
        continue;
      }
      throw lastError;
    }
  }

  // Should never reach here, but just in case
  throw lastError || new ApiRequestError("Request gagal setelah retry.", "unknown");
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
