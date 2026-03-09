import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserByUsername, getTenantById, updateUser, getAllTenants } from "../_lib/db.js";
import { verifyPassword, isLegacyHash, hashPassword, createToken } from "../_lib/auth.js";
import { logActivity, getClientIP } from "../_lib/activity-logger.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET = return tenant list for login dropdown (was /api/auth/tenants)
  if (req.method === "GET") {
    try {
      const tenants = await getAllTenants();
      const publicList = tenants
        .filter((t) => t.status === "active")
        .map((t) => ({ id: t.id, name: t.name }));
      return res.json({ success: true, tenants: publicList });
    } catch (err: any) {
      console.error("Tenants list error:", err);
      return res.status(500).json({ error: "Gagal ambil daftar store." });
    }
  }

  // POST = login
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { username, password, tenant_id } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username & password wajib diisi dong!" });
    }

    // Look up user — pass tenant_id so it checks the right DB
    const user = await getUserByUsername(username, tenant_id || undefined);

    // BUG-009 fix: Generic error message — no username enumeration
    if (!user || !verifyPassword(password, user.password_hash)) {
      await logActivity({
        action: "LOGIN_FAILED",
        category: "auth",
        username: username,
        tenantId: tenant_id || "",
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"] || "",
        details: { reason: "Invalid credentials" },
        status: "failed",
      });
      return res.status(401).json({ error: "Username atau password salah!" });
    }

    // BUG-001 fix: Migrate legacy SHA-256 hash to scrypt on successful login
    if (isLegacyHash(user.password_hash)) {
      const newHash = hashPassword(password);
      await updateUser(user.id, { password_hash: newHash }, user.tenant_id || undefined);
    }

    let tenantName = "";
    if (user.tenant_id && user.tenant_id !== "ALL") {
      const tenant = await getTenantById(user.tenant_id);
      tenantName = tenant?.name || "";
    }

    // BUG-002 fix: Issue a JWT token
    const token = createToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenant_id || "",
    });

    // Log successful login
    logActivity({
      action: "LOGIN",
      category: "auth",
      userId: user.id,
      username: user.username,
      tenantId: user.tenant_id || "",
      tenantName: tenantName,
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"] || "",
      details: { role: user.role },
      status: "success",
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        tenant_id: user.tenant_id || "",
        tenant_name: tenantName,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
}
