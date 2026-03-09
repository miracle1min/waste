import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllTenants, createTenant, updateTenant, deleteTenant } from "../_lib/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const role = req.headers["x-user-role"] as string;
  if (role !== "super_admin") return res.status(403).json({ error: "Akses ditolak! Cuma Super Admin yang boleh." });

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
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
}
