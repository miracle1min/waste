/**
 * Public API — returns list of active tenants for login page dropdown.
 * Only returns id and name (no sensitive data).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllTenants } from "../_lib/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

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
