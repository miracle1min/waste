import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireRole, handleAuthError } from "../../_lib/auth.js";
import { getMasterSQL } from "../../_lib/tenant-db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requireRole(req, "super_admin");
  } catch (err) {
    return handleAuthError(err, res);
  }

  const sql = getMasterSQL();

  try {
    if (req.method === "GET") {
      const rows = await sql`SELECT * FROM google_users ORDER BY linked_at DESC`;
      return res.status(200).json({ success: true, data: rows });
    }

    if (req.method === "POST") {
      const { google_email, user_id, username, display_name, role, tenant_id } = req.body || {};

      if (!google_email || !user_id || !username) {
        return res.status(400).json({ error: "google_email, user_id, dan username wajib diisi." });
      }

      await sql`
        INSERT INTO google_users (google_email, user_id, username, display_name, role, tenant_id)
        VALUES (${google_email}, ${user_id}, ${username}, ${display_name || ""}, ${role || "admin_store"}, ${tenant_id || ""})
        ON CONFLICT (google_email) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          role = EXCLUDED.role,
          tenant_id = EXCLUDED.tenant_id
      `;

      return res.status(200).json({ success: true, message: "Google account linked successfully." });
    }

    if (req.method === "DELETE") {
      const { google_email } = req.body || {};

      if (!google_email) {
        return res.status(400).json({ error: "google_email wajib diisi." });
      }

      await sql`DELETE FROM google_users WHERE google_email = ${google_email}`;
      return res.status(200).json({ success: true, message: "Google account unlinked successfully." });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("Google link error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan: " + err.message });
  }
}
