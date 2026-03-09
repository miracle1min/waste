import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllUsers, createUser, updateUser, deleteUser } from "../_lib/db.js";
import { requireRole, hashPassword, handleAuthError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // BUG-003 fix: Server-side JWT auth instead of trusting x-user-role header
    requireRole(req, "super_admin");
  } catch (err) {
    return handleAuthError(err, res);
  }

  try {
    if (req.method === "GET") {
      const users = await getAllUsers();
      const safe = users.map(({ password_hash, ...u }) => u);
      return res.json({ users: safe });
    }
    if (req.method === "POST") {
      const { username, password, display_name, role: userRole, tenant_id } = req.body || {};
      if (!username || !password) return res.status(400).json({ error: "Username & password wajib diisi!" });
      // BUG-001 fix: Use scrypt instead of SHA-256
      const hash = hashPassword(password);
      const user = await createUser({
        username,
        password_hash: hash,
        display_name: display_name || username,
        role: userRole || "admin_store",
        tenant_id: tenant_id || null,
      });
      const { password_hash, ...safe } = user;
      return res.json({ success: true, user: safe });
    }
    if (req.method === "PUT") {
      const { id, password, ...data } = req.body || {};
      if (!id) return res.status(400).json({ error: "User ID wajib!" });
      if (password) {
        // BUG-001 fix: Use scrypt instead of SHA-256
        data.password_hash = hashPassword(password);
      }
      const user = await updateUser(Number(id), data);
      if (!user) return res.status(404).json({ error: "User ga ketemu!" });
      const { password_hash, ...safe } = user;
      return res.json({ success: true, user: safe });
    }
    if (req.method === "DELETE") {
      const id = req.query.id || req.body?.id;
      if (!id) return res.status(400).json({ error: "User ID wajib!" });
      const ok = await deleteUser(Number(id));
      if (!ok) return res.status(404).json({ error: "User ga ketemu!" });
      return res.json({ success: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: unknown) {
    // BUG-008 fix: Don't leak internal errors
    console.error("Users API error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
}
