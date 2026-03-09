import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllConfigs, upsertConfig, deleteConfig } from "../lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const role = req.headers["x-user-role"] as string;
  if (role !== "super_admin") return res.status(403).json({ error: "Akses ditolak! Cuma Super Admin yang boleh." });

  try {
    if (req.method === "GET") {
      const configs = await getAllConfigs();
      return res.json({ configs });
    }
    if (req.method === "POST" || req.method === "PUT") {
      const body = req.body || {};
      if (!body.tenant_id) return res.status(400).json({ error: "tenant_id wajib diisi!" });
      const config = await upsertConfig(body);
      return res.json({ success: true, config });
    }
    if (req.method === "DELETE") {
      const tenantId = (req.query.tenant_id || req.body?.tenant_id) as string;
      if (!tenantId) return res.status(400).json({ error: "tenant_id wajib!" });
      const ok = await deleteConfig(tenantId);
      if (!ok) return res.status(404).json({ error: "Config ga ketemu!" });
      return res.json({ success: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: unknown) {
    console.error("Configs API error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
}
