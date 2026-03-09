import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllTenants, createTenant, updateTenant, deleteTenant } from "../_lib/db.js";
import { requireRole, handleAuthError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // BUG-003 fix: Server-side JWT auth instead of trusting x-user-role header
    requireRole(req, "super_admin");
  } catch (err) {
    return handleAuthError(err, res);
  }

  try {
    if (req.method === "GET") {
      const tenants = await getAllTenants();
      return res.json({ tenants });
    }
    if (req.method === "POST") {
      const { id, name, address, phone, status } = req.body || {};
      if (!id || !name) return res.status(400).json({ error: "ID & nama store wajib diisi!" });
      const tenant = await createTenant({ id, name, address: address || "", phone: phone || "", status: status || "active" });
      return res.json({ success: true, tenant });
    }
    if (req.method === "PUT") {
      const { id, ...data } = req.body || {};
      if (!id) return res.status(400).json({ error: "ID store wajib diisi!" });
      const tenant = await updateTenant(id, data);
      if (!tenant) return res.status(404).json({ error: "Store ga ketemu!" });
      return res.json({ success: true, tenant });
    }
    if (req.method === "DELETE") {
      const id = (req.query.id || req.body?.id) as string;
      if (!id) return res.status(400).json({ error: "ID store wajib diisi!" });
      const ok = await deleteTenant(id);
      if (!ok) return res.status(404).json({ error: "Store ga ketemu!" });
      return res.json({ success: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: unknown) {
    console.error("Tenants API error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
}
