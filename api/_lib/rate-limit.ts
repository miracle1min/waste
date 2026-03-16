import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * In-memory rate limiter.
 * NOTE: This is per-instance only. In serverless environments, each cold start
 * gets a fresh Map, so this is best-effort protection (not a hard guarantee).
 * For production-grade rate limiting, consider using Vercel KV, Upstash Redis, 
 * or similar external store.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) stores.set(name, new Map());
  return stores.get(name)!;
}

// Clean up expired entries periodically
function cleanup(store: Map<string, RateLimitEntry>) {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export interface RateLimitConfig {
  /** Unique name for this limiter (e.g., "login", "api") */
  name: string;
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
}

/**
 * Get client IP from request
 */
function getIP(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.socket?.remoteAddress || "unknown";
}

/**
 * Check rate limit. Returns null if allowed, or a response object if blocked.
 * Usage:
 *   const blocked = checkRateLimit(req, res, { name: "login", maxRequests: 5, windowSeconds: 300 });
 *   if (blocked) return;
 */
export function checkRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  config: RateLimitConfig
): boolean {
  const store = getStore(config.name);
  const ip = getIP(req);
  const now = Date.now();

  // Periodic cleanup (every 100 checks)
  if (Math.random() < 0.01) cleanup(store);

  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(ip, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return false; // allowed
  }

  entry.count++;

  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: "Terlalu banyak request. Coba lagi nanti.",
      retryAfterSeconds: retryAfter,
    });
    return true; // blocked
  }

  return false; // allowed
}
