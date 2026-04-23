import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllTenants, createTenant, updateTenant, deleteTenant } from "../../_lib/db.js";
import { clearTenantDbCache } from "../../_lib/tenant-db.js";
import { requireRole, handleAuthError, verifyToken, extractToken } from "../../_lib/auth.js";
import { logActivity, getClientIP } from "../../_lib/activity-logger.js";
import { validate, createTenantSchema } from "../../_lib/validators.js";

// FIX #11: Mask neon_database_url in responses to prevent credential exposure
function maskTenant(tenant: any): any {
  return {
    ...tenant,
    neon_database_url: tenant.neon_database_url ? "••••••••" : "",
    has_own_db: !!tenant.neon_database_url,
  };
}

export async function handleTenants(req: VercelRequest, res: VercelResponse) {
  try {
    // BUG-003 fix: Server-side JWT auth instead of trusting x-user-role header
    requireRole(req, "super_admin");
  } catch (err) {
    return handleAuthError(err, res);
  }

  try {
    if (req.method === "GET") {
      const tenants = await getAllTenants();
      return res.json({ tenants: tenants.map(maskTenant) });
    }
    if (req.method === "POST") {
      const parsed = validate(createTenantSchema, req.body, res);
      if (!parsed) return;
      const tenant = await createTenant({
        id: parsed.id,
        name: parsed.name,
        address: parsed.address ?? "",
        phone: parsed.phone ?? "",
        status: parsed.status ?? "active",
        neon_database_url: parsed.neon_database_url ?? "",
      });
      const jwt = verifyToken(extractToken(req) || "");
      logActivity({ action: "CREATE_TENANT", category: "tenant", userId: jwt?.userId, username: jwt?.username || "", tenantId: parsed.id, tenantName: parsed.name, ipAddress: getClientIP(req), userAgent: req.headers["user-agent"] || "", details: { storeName: parsed.name }, status: "success" });
      return res.json({ success: true, tenant: maskTenant(tenant) });
    }
    if (req.method === "PUT") {
      const { id, ...data } = req.body || {};
      if (!id) return res.status(400).json({ error: "ID store wajib diisi!" });
      const tenant = await updateTenant(id, data);
      if (!tenant) return res.status(404).json({ error: "Store ga ketemu!" });
      // Clear DB URL cache when tenant is updated
      clearTenantDbCache(id);
      return res.json({ success: true, tenant: maskTenant(tenant) });
    }
    if (req.method === "DELETE") {
      const id = (req.query.id || req.body?.id) as string;
      if (!id) return res.status(400).json({ error: "ID store wajib diisi!" });
      const ok = await deleteTenant(id);
      if (!ok) return res.status(404).json({ error: "Store ga ketemu!" });
      const jwt2 = verifyToken(extractToken(req) || "");
      logActivity({ action: "DELETE_TENANT", category: "tenant", userId: jwt2?.userId, username: jwt2?.username || "", tenantId: id, ipAddress: getClientIP(req), userAgent: req.headers["user-agent"] || "", details: { deletedStoreId: id }, status: "success" });
      return res.json({ success: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: unknown) {
    console.error("Tenants API error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
}
