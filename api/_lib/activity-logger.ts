/**
 * Activity Logger — Logs user actions to master DB.
 * Auto-creates the activity_logs table if it doesn't exist.
 */
import { getMasterSQL } from "./tenant-db.js";

export interface ActivityLog {
  id: number;
  action: string;         // LOGIN, LOGOUT, SUBMIT_WASTE, DELETE_USER, etc.
  category: string;       // auth, waste, user, tenant, config, system
  user_id: number | null;
  username: string;
  tenant_id: string;
  tenant_name: string;
  ip_address: string;
  user_agent: string;
  details: Record<string, unknown>;
  status: "success" | "failed" | "warning";
  created_at: string;
}

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  const sql = getMasterSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      action VARCHAR(50) NOT NULL,
      category VARCHAR(30) NOT NULL DEFAULT 'system',
      user_id INTEGER,
      username VARCHAR(100) NOT NULL DEFAULT '',
      tenant_id VARCHAR(100) DEFAULT '',
      tenant_name VARCHAR(200) DEFAULT '',
      ip_address VARCHAR(50) DEFAULT '',
      user_agent TEXT DEFAULT '',
      details JSONB DEFAULT '{}',
      status VARCHAR(10) NOT NULL DEFAULT 'success',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Create index for fast querying
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs (created_at DESC)`.catch(() => {});
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs (action)`.catch(() => {});
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs (category)`.catch(() => {});
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant ON activity_logs (tenant_id)`.catch(() => {});
  tableEnsured = true;
}

interface LogParams {
  action: string;
  category?: string;
  userId?: number | null;
  username?: string;
  tenantId?: string;
  tenantName?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  status?: "success" | "failed" | "warning";
}

/** Log an activity — fire-and-forget, never throws */
export async function logActivity(params: LogParams): Promise<void> {
  try {
    await ensureTable();
    const sql = getMasterSQL();
    await sql`
      INSERT INTO activity_logs (action, category, user_id, username, tenant_id, tenant_name, ip_address, user_agent, details, status)
      VALUES (
        ${params.action},
        ${params.category || "system"},
        ${params.userId ?? null},
        ${params.username || ""},
        ${params.tenantId || ""},
        ${params.tenantName || ""},
        ${params.ipAddress || ""},
        ${params.userAgent || ""},
        ${JSON.stringify(params.details || {})},
        ${params.status || "success"}
      )
    `;
  } catch (err) {
    console.error("[ActivityLogger] Failed to log:", err);
    // Never throw — logging should not break the main flow
  }
}

/** Get activity logs with pagination and filtering */
export async function getActivityLogs(opts: {
  page?: number;
  limit?: number;
  action?: string;
  category?: string;
  tenantId?: string;
  username?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): Promise<{ logs: ActivityLog[]; total: number; page: number; totalPages: number }> {
  await ensureTable();
  const sql = getMasterSQL();
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 50, 100);
  const offset = (page - 1) * limit;

  // Build WHERE conditions
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (opts.action) {
    conditions.push(`action = $${idx++}`);
    params.push(opts.action);
  }
  if (opts.category) {
    conditions.push(`category = $${idx++}`);
    params.push(opts.category);
  }
  if (opts.tenantId) {
    conditions.push(`tenant_id = $${idx++}`);
    params.push(opts.tenantId);
  }
  if (opts.username) {
    conditions.push(`username ILIKE $${idx++}`);
    params.push(`%${opts.username}%`);
  }
  if (opts.status) {
    conditions.push(`status = $${idx++}`);
    params.push(opts.status);
  }
  if (opts.dateFrom) {
    conditions.push(`created_at >= $${idx++}`);
    params.push(opts.dateFrom);
  }
  if (opts.dateTo) {
    conditions.push(`created_at <= $${idx++}`);
    params.push(opts.dateTo + "T23:59:59.999Z");
  }
  if (opts.search) {
    conditions.push(`(username ILIKE $${idx} OR action ILIKE $${idx} OR tenant_name ILIKE $${idx})`);
    params.push(`%${opts.search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count
  const countParams = [...params];
  const countResult = await sql(`SELECT COUNT(*) as total FROM activity_logs ${where}`, countParams);
  const total = parseInt(countResult[0]?.total || "0");

  // Fetch
  params.push(limit, offset);
  const logs = await sql(
    `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  return {
    logs: logs as ActivityLog[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/** Extract IP from request */
export function getClientIP(req: any): string {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    ""
  );
}
