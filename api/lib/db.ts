/**
 * Neon Database Library — pusat data tenants, users, dan configs.
 * Uses dynamic import to avoid Vercel bundling issues.
 */

type NeonQueryFunction = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

let _sql: NeonQueryFunction | null = null;

async function getSQL(): Promise<NeonQueryFunction> {
  if (_sql) return _sql;
  const url = process.env.NEON_DATABASE_URL;
  if (!url) throw new Error("NEON_DATABASE_URL not set");
  const { neon } = await import("@neondatabase/serverless");
  _sql = neon(url) as unknown as NeonQueryFunction;
  return _sql;
}

// ==================== TENANTS ====================
export interface Tenant {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: string;
  created_at: string;
}

export async function getAllTenants(): Promise<Tenant[]> {
  const sql = await getSQL();
  const rows = await sql`SELECT * FROM tenants ORDER BY created_at DESC`;
  return rows as unknown as Tenant[];
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const sql = await getSQL();
  const rows = await sql`SELECT * FROM tenants WHERE id = ${id}`;
  return (rows[0] as unknown as Tenant) || null;
}

export async function createTenant(t: Omit<Tenant, "created_at">): Promise<Tenant> {
  const sql = await getSQL();
  const rows = await sql`
    INSERT INTO tenants (id, name, address, phone, status)
    VALUES (${t.id}, ${t.name}, ${t.address || ""}, ${t.phone || ""}, ${t.status || "active"})
    RETURNING *`;
  return rows[0] as unknown as Tenant;
}

export async function updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant | null> {
  const sql = await getSQL();
  const rows = await sql`
    UPDATE tenants SET
      name = COALESCE(${data.name ?? null}, name),
      address = COALESCE(${data.address ?? null}, address),
      phone = COALESCE(${data.phone ?? null}, phone),
      status = COALESCE(${data.status ?? null}, status)
    WHERE id = ${id}
    RETURNING *`;
  return (rows[0] as unknown as Tenant) || null;
}

export async function deleteTenant(id: string): Promise<boolean> {
  const sql = await getSQL();
  const rows = await sql`DELETE FROM tenants WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

// ==================== USERS ====================
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

export async function getAllUsers(): Promise<User[]> {
  const sql = await getSQL();
  const rows = await sql`SELECT * FROM users ORDER BY created_at DESC`;
  return rows as unknown as User[];
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const sql = await getSQL();
  const rows = await sql`SELECT * FROM users WHERE username = ${username} AND status = 'active'`;
  return (rows[0] as unknown as User) || null;
}

export async function createUser(u: {
  username: string;
  password_hash: string;
  display_name: string;
  role: string;
  tenant_id: string | null;
}): Promise<User> {
  const sql = await getSQL();
  const rows = await sql`
    INSERT INTO users (username, password_hash, display_name, role, tenant_id, status)
    VALUES (${u.username}, ${u.password_hash}, ${u.display_name}, ${u.role}, ${u.tenant_id}, 'active')
    RETURNING *`;
  return rows[0] as unknown as User;
}

export async function updateUser(id: number, data: Partial<User>): Promise<User | null> {
  const sql = await getSQL();
  const rows = await sql`
    UPDATE users SET
      display_name = COALESCE(${data.display_name ?? null}, display_name),
      role = COALESCE(${data.role ?? null}, role),
      tenant_id = COALESCE(${data.tenant_id ?? null}, tenant_id),
      status = COALESCE(${data.status ?? null}, status),
      password_hash = COALESCE(${data.password_hash ?? null}, password_hash)
    WHERE id = ${id}
    RETURNING *`;
  return (rows[0] as unknown as User) || null;
}

export async function deleteUser(id: number): Promise<boolean> {
  const sql = await getSQL();
  const rows = await sql`DELETE FROM users WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

// ==================== TENANT CONFIGS ====================
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
  const sql = await getSQL();
  const rows = await sql`SELECT * FROM tenant_configs ORDER BY tenant_id`;
  return rows as unknown as TenantConfig[];
}

export async function getConfigByTenantId(tenantId: string): Promise<TenantConfig | null> {
  const sql = await getSQL();
  const rows = await sql`SELECT * FROM tenant_configs WHERE tenant_id = ${tenantId}`;
  return (rows[0] as unknown as TenantConfig) || null;
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
  const sql = await getSQL();
  const rows = await sql`
    INSERT INTO tenant_configs (tenant_id, google_spreadsheet_id, google_sheets_credentials, r2_account_id, r2_access_key_id, r2_secret_access_key, r2_bucket_name, r2_public_url, extra_config)
    VALUES (
      ${c.tenant_id},
      ${c.google_spreadsheet_id || ""},
      ${c.google_sheets_credentials || ""},
      ${c.r2_account_id || ""},
      ${c.r2_access_key_id || ""},
      ${c.r2_secret_access_key || ""},
      ${c.r2_bucket_name || ""},
      ${c.r2_public_url || ""},
      ${JSON.stringify(c.extra_config || {})}
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
      google_spreadsheet_id = COALESCE(NULLIF(${c.google_spreadsheet_id || ""}, ''), tenant_configs.google_spreadsheet_id),
      google_sheets_credentials = COALESCE(NULLIF(${c.google_sheets_credentials || ""}, ''), tenant_configs.google_sheets_credentials),
      r2_account_id = COALESCE(NULLIF(${c.r2_account_id || ""}, ''), tenant_configs.r2_account_id),
      r2_access_key_id = COALESCE(NULLIF(${c.r2_access_key_id || ""}, ''), tenant_configs.r2_access_key_id),
      r2_secret_access_key = COALESCE(NULLIF(${c.r2_secret_access_key || ""}, ''), tenant_configs.r2_secret_access_key),
      r2_bucket_name = COALESCE(NULLIF(${c.r2_bucket_name || ""}, ''), tenant_configs.r2_bucket_name),
      r2_public_url = COALESCE(NULLIF(${c.r2_public_url || ""}, ''), tenant_configs.r2_public_url),
      extra_config = COALESCE(${JSON.stringify(c.extra_config || {})}::jsonb, tenant_configs.extra_config),
      updated_at = NOW()
    RETURNING *`;
  return rows[0] as unknown as TenantConfig;
}

export async function deleteConfig(tenantId: string): Promise<boolean> {
  const sql = await getSQL();
  const rows = await sql`DELETE FROM tenant_configs WHERE tenant_id = ${tenantId} RETURNING id`;
  return rows.length > 0;
}
