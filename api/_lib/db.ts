/**
 * Neon Database Library — Multi-DB architecture.
 * 
 * Master DB: tenants registry (NEON_DATABASE_URL)
 * Per-Tenant DB: users, tenant_configs, personnel (tenants.neon_database_url)
 */
import { getMasterSQL, getTenantSQL, tenantQuery } from "./tenant-db.js";

// Generic query helper — uses MASTER DB (for backward compat & tenant queries)
export async function query(sql: string, params: any[] = []): Promise<any[]> {
  const db = getMasterSQL();
  const result = await db(sql, params);
  return result as any[];
}

// ==================== TENANTS (Master DB) ====================
export interface Tenant {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: string;
  neon_database_url: string;
  created_at: string;
}

export async function getAllTenants(): Promise<Tenant[]> {
  const sql = getMasterSQL();
  const rows = await sql`SELECT * FROM tenants ORDER BY created_at DESC`;
  return rows as Tenant[];
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const sql = getMasterSQL();
  const rows = await sql`SELECT * FROM tenants WHERE id = ${id}`;
  return (rows[0] as Tenant) || null;
}

export async function createTenant(t: Omit<Tenant, "created_at">): Promise<Tenant> {
  const sql = getMasterSQL();
  const rows = await sql`
    INSERT INTO tenants (id, name, address, phone, status, neon_database_url)
    VALUES (${t.id}, ${t.name}, ${t.address || ""}, ${t.phone || ""}, ${t.status || "active"}, ${t.neon_database_url || ""})
    RETURNING *`;
  return rows[0] as Tenant;
}

export async function updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant | null> {
  const sql = getMasterSQL();
  const rows = await sql`
    UPDATE tenants SET
      name = COALESCE(${data.name ?? null}, name),
      address = COALESCE(${data.address ?? null}, address),
      phone = COALESCE(${data.phone ?? null}, phone),
      status = COALESCE(${data.status ?? null}, status),
      neon_database_url = COALESCE(${data.neon_database_url ?? null}, neon_database_url)
    WHERE id = ${id}
    RETURNING *`;
  return (rows[0] as Tenant) || null;
}

export async function deleteTenant(id: string): Promise<boolean> {
  const sql = getMasterSQL();
  const rows = await sql`DELETE FROM tenants WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

// ==================== USERS (Per-Tenant DB) ====================
export interface User {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: string;
  tenant_id: string | null;
  status: string;
  created_at: string;
}

/** Get all users — for super admin, fetch from master DB */
export async function getAllUsers(): Promise<User[]> {
  const sql = getMasterSQL();
  const rows = await sql`SELECT * FROM users ORDER BY created_at DESC`;
  return rows as User[];
}

/** Get all users for a specific tenant from their own DB */
export async function getUsersByTenant(tenantId: string): Promise<User[]> {
  const rows = await tenantQuery(tenantId,
    'SELECT * FROM users WHERE tenant_id = $1 ORDER BY created_at DESC',
    [tenantId]
  );
  return rows as User[];
}

/** Get user by username — checks tenant DB first, then master DB for super admins */
export async function getUserByUsername(username: string, tenantId?: string): Promise<User | null> {
  // If tenant specified, check tenant DB first
  if (tenantId) {
    try {
      const rows = await tenantQuery(tenantId,
        'SELECT * FROM users WHERE username = $1 AND status = $2',
        [username, 'active']
      );
      if (rows.length) return rows[0] as User;
    } catch (err) {
      console.error(`Error checking tenant DB for user "${username}":`, err);
    }
  }

  // Fallback: check master DB (for super admins or if no tenant specified)
  const sql = getMasterSQL();
  const rows = await sql`SELECT * FROM users WHERE username = ${username} AND status = 'active'`;
  return (rows[0] as User) || null;
}

/** Create user in tenant's DB (or master DB for super admins) */
export async function createUser(u: {
  username: string;
  password_hash: string;
  display_name: string;
  role: string;
  tenant_id: string | null;
}): Promise<User> {
  // Super admin goes to master DB
  if (u.role === "super_admin" || u.tenant_id === "ALL") {
    const sql = getMasterSQL();
    const rows = await sql`
      INSERT INTO users (username, password_hash, display_name, role, tenant_id, status)
      VALUES (${u.username}, ${u.password_hash}, ${u.display_name}, ${u.role}, ${u.tenant_id}, 'active')
      RETURNING *`;
    return rows[0] as User;
  }

  // Tenant user goes to tenant's DB
  if (!u.tenant_id) throw new Error("tenant_id wajib diisi untuk non-super_admin!");
  const rows = await tenantQuery(u.tenant_id,
    `INSERT INTO users (username, password_hash, display_name, role, tenant_id, status)
     VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
    [u.username, u.password_hash, u.display_name, u.role, u.tenant_id]
  );
  return rows[0] as User;
}

/** Update user — route to correct DB */
export async function updateUser(id: number, data: Partial<User>, tenantId?: string): Promise<User | null> {
  const doUpdate = async (sqlFn: (sql: string, params: any[]) => Promise<any[]>) => {
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (data.display_name !== undefined) { sets.push(`display_name = $${idx++}`); vals.push(data.display_name); }
    if (data.role !== undefined) { sets.push(`role = $${idx++}`); vals.push(data.role); }
    if (data.tenant_id !== undefined) { sets.push(`tenant_id = $${idx++}`); vals.push(data.tenant_id); }
    if (data.status !== undefined) { sets.push(`status = $${idx++}`); vals.push(data.status); }
    if (data.password_hash !== undefined) { sets.push(`password_hash = $${idx++}`); vals.push(data.password_hash); }
    if (!sets.length) return null;
    vals.push(id);
    const rows = await sqlFn(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return (rows[0] as User) || null;
  };

  // If tenant specified, try tenant DB first
  if (tenantId && tenantId !== "ALL") {
    try {
      const result = await doUpdate((sql, params) => tenantQuery(tenantId, sql, params));
      if (result) return result;
    } catch (err) {
      console.error("Error updating in tenant DB:", err);
    }
  }

  // Fallback to master DB
  const masterSql = getMasterSQL();
  return doUpdate(async (sql, params) => {
    const result = await masterSql(sql, params);
    return result as any[];
  });
}

/** Delete user from correct DB */
export async function deleteUser(id: number, tenantId?: string): Promise<boolean> {
  if (tenantId && tenantId !== "ALL") {
    try {
      const rows = await tenantQuery(tenantId, 'DELETE FROM users WHERE id = $1 RETURNING id', [id]);
      if (rows.length) return true;
    } catch (err) {
      console.error("Error deleting from tenant DB:", err);
    }
  }

  // Fallback to master
  const sql = getMasterSQL();
  const rows = await sql`DELETE FROM users WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

// ==================== TENANT CONFIGS (Per-Tenant DB) ====================
export interface TenantConfig {
  id: number;
  tenant_id: string;
  google_spreadsheet_id: string;
  google_sheets_credentials: string;
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket_name: string;
  r2_public_url: string;
  extra_config: Record<string, unknown>;
  updated_at: string;
}

export async function getAllConfigs(): Promise<TenantConfig[]> {
  // For super admin view: gather configs from all tenants
  const masterSql = getMasterSQL();
  const tenants = await masterSql`SELECT id, neon_database_url FROM tenants WHERE status = 'active'`;
  const allConfigs: TenantConfig[] = [];

  for (const tenant of tenants) {
    try {
      const rows = await tenantQuery(tenant.id, 'SELECT * FROM tenant_configs ORDER BY tenant_id', []);
      allConfigs.push(...(rows as TenantConfig[]));
    } catch (err) {
      console.error(`Error fetching configs for tenant ${tenant.id}:`, err);
    }
  }

  return allConfigs;
}

export async function getConfigByTenantId(tenantId: string): Promise<TenantConfig | null> {
  try {
    const rows = await tenantQuery(tenantId,
      'SELECT * FROM tenant_configs WHERE tenant_id = $1',
      [tenantId]
    );
    return (rows[0] as TenantConfig) || null;
  } catch (err) {
    // Fallback to master DB if tenant DB not set up yet
    console.error(`Tenant DB not available for ${tenantId}, falling back to master:`, err);
    const sql = getMasterSQL();
    const rows = await sql`SELECT * FROM tenant_configs WHERE tenant_id = ${tenantId}`;
    return (rows[0] as TenantConfig) || null;
  }
}

export async function upsertConfig(c: {
  tenant_id: string;
  google_spreadsheet_id?: string;
  google_sheets_credentials?: string;
  r2_account_id?: string;
  r2_access_key_id?: string;
  r2_secret_access_key?: string;
  r2_bucket_name?: string;
  r2_public_url?: string;
  extra_config?: Record<string, unknown>;
}): Promise<TenantConfig> {
  const sql = `
    INSERT INTO tenant_configs (tenant_id, google_spreadsheet_id, google_sheets_credentials, r2_account_id, r2_access_key_id, r2_secret_access_key, r2_bucket_name, r2_public_url, extra_config)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (tenant_id) DO UPDATE SET
      google_spreadsheet_id = COALESCE(NULLIF($2, ''), tenant_configs.google_spreadsheet_id),
      google_sheets_credentials = COALESCE(NULLIF($3, ''), tenant_configs.google_sheets_credentials),
      r2_account_id = COALESCE(NULLIF($4, ''), tenant_configs.r2_account_id),
      r2_access_key_id = COALESCE(NULLIF($5, ''), tenant_configs.r2_access_key_id),
      r2_secret_access_key = COALESCE(NULLIF($6, ''), tenant_configs.r2_secret_access_key),
      r2_bucket_name = COALESCE(NULLIF($7, ''), tenant_configs.r2_bucket_name),
      r2_public_url = COALESCE(NULLIF($8, ''), tenant_configs.r2_public_url),
      extra_config = COALESCE($9::jsonb, tenant_configs.extra_config),
      updated_at = NOW()
    RETURNING *`;
  
  const params = [
    c.tenant_id,
    c.google_spreadsheet_id || "",
    c.google_sheets_credentials || "",
    c.r2_account_id || "",
    c.r2_access_key_id || "",
    c.r2_secret_access_key || "",
    c.r2_bucket_name || "",
    c.r2_public_url || "",
    JSON.stringify(c.extra_config || {}),
  ];

  const rows = await tenantQuery(c.tenant_id, sql, params);
  return rows[0] as TenantConfig;
}

export async function deleteConfig(tenantId: string): Promise<boolean> {
  const rows = await tenantQuery(tenantId,
    'DELETE FROM tenant_configs WHERE tenant_id = $1 RETURNING id',
    [tenantId]
  );
  return rows.length > 0;
}
