/**
 * Auth Library — JWT + scrypt password hashing.
 * BUG-001, BUG-002, BUG-003 fix: Proper server-side auth.
 */
import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ===== Password Hashing (scrypt — built-in, no external deps) =====

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  }).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  // New format: salt:hash (scrypt)
  if (stored.includes(":")) {
    const [salt, hash] = stored.split(":");
    const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
    }).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
  }
  // Legacy format: plain SHA-256 hex (migration support)
  const sha256 = crypto.createHash("sha256").update(password).digest("hex");
  return sha256 === stored;
}

export function isLegacyHash(stored: string): boolean {
  return !stored.includes(":");
}

// ===== JWT (HMAC-SHA256 — built-in crypto, no external deps) =====

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[SECURITY] JWT_SECRET environment variable is not set! Using fallback.");
    return process.env.NEON_DATABASE_URL || "ba-waste-default-secret-change-me";
  }
  return secret;
}

function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  tenantId: string;
  iat: number;
  exp: number;
}

export function createToken(payload: Omit<JwtPayload, "iat" | "exp">, expiresInSeconds = 28800): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(signatureInput)
    .digest();

  return `${signatureInput}.${base64urlEncode(signature)}`;
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const expectedSig = crypto
      .createHmac("sha256", getJwtSecret())
      .update(signatureInput)
      .digest();

    const actualSig = Buffer.from(encodedSignature.replace(/-/g, "+").replace(/_/g, "/"), "base64");

    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

    const payload = JSON.parse(base64urlDecode(encodedPayload)) as JwtPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

// ===== Auth Middleware =====

export function extractToken(req: VercelRequest): string | null {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

export function requireAuth(req: VercelRequest): JwtPayload {
  const token = extractToken(req);
  if (!token) {
    throw new AuthError(401, "Token tidak ditemukan. Silakan login ulang.");
  }
  const payload = verifyToken(token);
  if (!payload) {
    throw new AuthError(401, "Token tidak valid atau sudah expired. Silakan login ulang.");
  }
  return payload;
}

export function requireRole(req: VercelRequest, ...roles: string[]): JwtPayload {
  const payload = requireAuth(req);
  if (!roles.includes(payload.role)) {
    throw new AuthError(403, "Akses ditolak! Kamu tidak punya izin untuk operasi ini.");
  }
  return payload;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

export function handleAuthError(err: unknown, res: VercelResponse): void {
  if (err instanceof AuthError) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Terjadi kesalahan server." });
  }
}

/**
 * SEC-FIX: Get tenant ID from JWT payload, with super_admin override.
 * Regular users (admin_store) ALWAYS use the tenantId embedded in their JWT.
 * Super admins can override via x-tenant-id header to view different tenants.
 * This prevents regular users from manipulating the x-tenant-id header to access other tenants' data.
 */
export function getAuthorizedTenantId(req: VercelRequest, jwtPayload: JwtPayload): string {
  if (jwtPayload.role === 'super_admin') {
    // Super admins can specify which tenant to access
    const headerTenant = (req.headers["x-tenant-id"] as string) || (req.query?.tenant_id as string);
    return headerTenant || jwtPayload.tenantId || "";
  }
  // Regular users: always use JWT's tenantId (tamper-proof)
  return jwtPayload.tenantId || "";
}
