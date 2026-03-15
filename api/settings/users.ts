import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllUsers, getUsersByTenant, createUser, updateUser, deleteUser } from "../_lib/db.js";
import { requireRole, hashPassword, handleAuthError, verifyToken, extractToken } from "../_lib/auth.js";
import { logActivity, getClientIP } from "../_lib/activity-logger.js";
import { checkRateLimit } from "../_lib/rate-limit.js";
import { validate, createUserSchema, updateUserSchema } from "../_lib/validators.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (checkRateLimit(req, res, { name: "settings", maxRequests: 30, windowSeconds: 60 })) return;

  try {
    requireRole(req, "super_admin");
  } catch (err) {
    return handleAuthError(err, res);
  }

  try {
    if (req.method === "GET") {
      const tenantId = req.query.tenant_id as string;
      
      // If tenant_id specified, get users from that tenant's DB
      let users;
      if (tenantId && tenantId !== "ALL") {
        users = await getUsersByTenant(tenantId);
      } else {
        // Super admin view: get all users from master DB
        users = await getAllUsers();
      }

      const safe = users.map(({ password_hash, ...u }: any) => u);
      return res.json({ users: safe });
    }

    if (req.method === "POST") {
      const parsed = validate(createUserSchema, req.body, res);
      if (!parsed) return;
      const { username, password, display_name, role: userRole, tenant_id } = parsed;
      const hash = hashPassword(password);
      const user = await createUser({
        username,
        password_hash: hash,
        display_name: display_name || username,
        role: userRole || "admin_store",
        tenant_id: tenant_id || null,
      });
      const { password_hash, ...safe } = user;
      const jwt = verifyToken(extractToken(req) || "");
      logActivity({ action: "CREATE_USER", category: "user", userId: jwt?.userId, username: jwt?.username || "", tenantId: tenant_id || "", ipAddress: getClientIP(req), userAgent: req.headers["user-agent"] || "", details: { newUser: username, role: userRole }, status: "success" });
      return res.json({ success: true, user: safe });
    }

    if (req.method === "PUT") {
      const parsed = validate(updateUserSchema, req.body, res);
      if (!parsed) return;
      const { id, password, tenant_id, ...data } = parsed;
      if (password) {
        data.password_hash = hashPassword(password);
      }
      // Pass tenant_id so updateUser knows which DB to update
      const user = await updateUser(Number(id), data, tenant_id || undefined);
      if (!user) return res.status(404).json({ error: "User ga ketemu!" });
      const { password_hash, ...safe } = user;
      return res.json({ success: true, user: safe });
    }

    if (req.method === "DELETE") {
      const id = req.query.id || req.body?.id;
      const tenantId = (req.query.tenant_id || req.body?.tenant_id) as string;
      if (!id) return res.status(400).json({ error: "User ID wajib!" });
      const ok = await deleteUser(Number(id), tenantId || undefined);
      if (!ok) return res.status(404).json({ error: "User ga ketemu!" });
      const jwt2 = verifyToken(extractToken(req) || "");
      logActivity({ action: "DELETE_USER", category: "user", userId: jwt2?.userId, username: jwt2?.username || "", tenantId: tenantId || "", ipAddress: getClientIP(req), userAgent: req.headers["user-agent"] || "", details: { deletedUserId: id }, status: "success" });
      return res.json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: unknown) {
    console.error("Users API error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
}
