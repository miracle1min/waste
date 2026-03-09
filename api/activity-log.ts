/**
 * Activity Log API — Super Admin only.
 * GET: List activity logs with filters & pagination.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireRole, handleAuthError } from "./_lib/auth.js";
import { getActivityLogs } from "./_lib/activity-logger.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Super admin only
    requireRole(req, "super_admin");

    if (req.method === "GET") {
      const {
        page, limit, action, category, tenant_id,
        username, status, date_from, date_to, search
      } = req.query;

      const result = await getActivityLogs({
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        action: action as string,
        category: category as string,
        tenantId: tenant_id as string,
        username: username as string,
        status: status as string,
        dateFrom: date_from as string,
        dateTo: date_to as string,
        search: search as string,
      });

      return res.json({ success: true, ...result });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    handleAuthError(err, res);
  }
}
