import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username & password wajib diisi dong!" });
    }

    let neon: any;
    try {
      const mod = await import("@neondatabase/serverless");
      neon = mod.neon;
    } catch (importErr: any) {
      return res.status(500).json({ error: "Import error: " + importErr.message });
    }

    const dbUrl = process.env.NEON_DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ error: "NEON_DATABASE_URL not set" });
    }

    let sql: any;
    try {
      sql = neon(dbUrl);
    } catch (connErr: any) {
      return res.status(500).json({ error: "Connection error: " + connErr.message });
    }

    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(password).digest("hex");

    let rows: any[];
    try {
      rows = await sql`SELECT * FROM users WHERE username = ${username} AND status = 'active'`;
    } catch (queryErr: any) {
      return res.status(500).json({ error: "Query error: " + queryErr.message, stack: queryErr.stack?.split('\n').slice(0,3) });
    }

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: "Username ga ketemu nih, cek lagi ya!" });
    }

    if (hash !== user.password_hash) {
      return res.status(401).json({ error: "Password salah cuy, coba lagi!" });
    }

    let tenantName = "";
    if (user.tenant_id) {
      try {
        const tenants = await sql`SELECT name FROM tenants WHERE id = ${user.tenant_id}`;
        tenantName = tenants[0]?.name || "";
      } catch (_e) { /* ignore */ }
    }

    return res.status(200).json({
      success: true,
      user: {
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        tenant_id: user.tenant_id || "",
        tenant_name: tenantName,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Unexpected: " + err.message, stack: err.stack?.split('\n').slice(0,5) });
  }
}
