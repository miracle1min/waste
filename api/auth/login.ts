import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Try importing from db.ts
    const { getUserByUsername, getTenantById } = await import("../_lib/db");
    
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username & password wajib diisi dong!" });
    }

    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(password).digest("hex");

    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: "Username ga ketemu nih, cek lagi ya!" });
    }

    if (hash !== user.password_hash) {
      return res.status(401).json({ error: "Password salah cuy, coba lagi!" });
    }

    let tenantName = "";
    if (user.tenant_id) {
      const tenant = await getTenantById(user.tenant_id);
      tenantName = tenant?.name || "";
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
    return res.status(500).json({ error: "Error: " + err.message, stack: err.stack?.split('\n').slice(0,5) });
  }
}
