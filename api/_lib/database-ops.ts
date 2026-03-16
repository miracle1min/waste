/**
 * Database operations — test, seed, switch + per-tenant seed
 * Uses @neondatabase/serverless (HTTP driver)
 */
import { neon } from "@neondatabase/serverless";

const ALLOWED_TABLES = new Set(["tenants", "users", "tenant_configs", "personnel"]);

function assertValidTable(table: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
}

// Master DB tables (tenants registry)
const MASTER_TABLES_DDL = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    neon_database_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    role TEXT DEFAULT 'admin_store',
    tenant_id TEXT REFERENCES tenants(id),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
];

// Per-tenant DB tables
const TENANT_TABLES_DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    role TEXT DEFAULT 'admin_store',
    tenant_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tenant_configs (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT UNIQUE NOT NULL,
    google_spreadsheet_id TEXT DEFAULT '',
    google_sheets_credentials TEXT DEFAULT '',
    r2_account_id TEXT DEFAULT '',
    r2_access_key_id TEXT DEFAULT '',
    r2_secret_access_key TEXT DEFAULT '',
    r2_bucket_name TEXT DEFAULT '',
    r2_public_url TEXT DEFAULT '',
    extra_config JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS personnel (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL,
    signature_url TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
];

// Legacy combined DDL (for backward compat with existing DB tab)
const TABLES_DDL = [
  ...MASTER_TABLES_DDL,
  `CREATE TABLE IF NOT EXISTS tenant_configs (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT UNIQUE NOT NULL REFERENCES tenants(id),
    google_spreadsheet_id TEXT DEFAULT '',
    google_sheets_credentials TEXT DEFAULT '',
    r2_account_id TEXT DEFAULT '',
    r2_access_key_id TEXT DEFAULT '',
    r2_secret_access_key TEXT DEFAULT '',
    r2_bucket_name TEXT DEFAULT '',
    r2_public_url TEXT DEFAULT '',
    extra_config JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS personnel (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL,
    signature_url TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
];

const DATA_TABLES = ["tenants", "users", "tenant_configs", "personnel"];

export async function testConnection(dbUrl: string): Promise<{ ok: boolean; message: string; tables?: string[] }> {
  try {
    const sql = neon(dbUrl);
    const r = await sql`SELECT version()`;
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`;
    return {
      ok: true,
      message: `Koneksi berhasil! ${r[0].version.split(" on ")[0]}`,
      tables: tables.map((t: any) => t.table_name),
    };
  } catch (err: any) {
    return { ok: false, message: `Gagal konek: ${err.message}` };
  }
}

/** Seed a NEW per-tenant database — creates tables only (no data copy) */
export async function seedTenantDatabase(targetUrl: string, tenantId: string): Promise<{ ok: boolean; message: string; tables?: string[] }> {
  try {
    const tgtSql = neon(targetUrl);

    // Create per-tenant tables
    for (const ddl of TENANT_TABLES_DDL) {
      await tgtSql(ddl);
    }

    // Verify tables created
    const tables = await tgtSql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`;

    return {
      ok: true,
      message: `Database untuk tenant "${tenantId}" berhasil di-seed! 🎉 ${tables.length} tabel dibuat.`,
      tables: tables.map((t: any) => t.table_name),
    };
  } catch (err: any) {
    return { ok: false, message: `Seed gagal: ${err.message}` };
  }
}

/** Migrate data from master DB to per-tenant DB */
export async function migrateToTenantDb(
  sourceUrl: string,
  targetUrl: string,
  tenantId: string
): Promise<{ ok: boolean; message: string; details?: any }> {
  const srcSql = neon(sourceUrl);
  const tgtSql = neon(targetUrl);
  const details: Record<string, number> = {};

  try {
    // 1. Create tables in target
    for (const ddl of TENANT_TABLES_DDL) {
      await tgtSql(ddl);
    }

    // 2. Copy users for this tenant
    const users = await srcSql`SELECT * FROM users WHERE tenant_id = ${tenantId}`;
    for (const row of users) {
      const keys = Object.keys(row);
      const vals = Object.values(row);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      await tgtSql(`INSERT INTO users (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT (username) DO NOTHING`, vals);
    }
    details.users = users.length;

    // 3. Copy tenant_configs
    const configs = await srcSql`SELECT * FROM tenant_configs WHERE tenant_id = ${tenantId}`;
    for (const row of configs) {
      const keys = Object.keys(row);
      const vals = Object.values(row);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      await tgtSql(`INSERT INTO tenant_configs (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT (tenant_id) DO NOTHING`, vals);
    }
    details.tenant_configs = configs.length;

    // 4. Copy personnel
    const personnel = await srcSql`SELECT * FROM personnel WHERE tenant_id = ${tenantId}`;
    for (const row of personnel) {
      const keys = Object.keys(row);
      const vals = Object.values(row);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      await tgtSql(`INSERT INTO personnel (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, vals);
    }
    details.personnel = personnel.length;

    // 5. Reset sequences
    for (const table of ["users", "tenant_configs", "personnel"]) {
      assertValidTable(table);
      try {
        await tgtSql(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
      } catch (_) { /* no sequence */ }
    }

    const total = Object.values(details).reduce((a, b) => a + b, 0);
    return {
      ok: true,
      message: `Migrasi berhasil! ${total} data ditransfer ke database tenant "${tenantId}" 🎉`,
      details,
    };
  } catch (err: any) {
    return { ok: false, message: `Migrasi gagal: ${err.message}` };
  }
}

/** Legacy full seed (backward compat) */
export async function seedDatabase(sourceUrl: string, targetUrl: string): Promise<{ ok: boolean; message: string; details?: any }> {
  const srcSql = neon(sourceUrl);
  const tgtSql = neon(targetUrl);
  const details: Record<string, number> = {};

  try {
    for (const ddl of TABLES_DDL) {
      await tgtSql(ddl);
    }

    for (const table of [...DATA_TABLES].reverse()) {
      assertValidTable(table);
      await tgtSql(`DELETE FROM ${table}`);
    }

    for (const table of DATA_TABLES) {
      assertValidTable(table);
      const src = await srcSql(`SELECT * FROM ${table}`);
      if (src.length === 0) { details[table] = 0; continue; }

      for (const row of src) {
        const keys = Object.keys(row);
        const vals = Object.values(row);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        const idCol = table === "tenants" ? "id" : table === "users" ? "username" : table === "tenant_configs" ? "tenant_id" : "id";
        await tgtSql(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${idCol}) DO NOTHING`, vals);
      }

      if (table !== "tenants") {
        try {
          assertValidTable(table);
          await tgtSql(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
        } catch (_) { /* no sequence */ }
      }

      details[table] = src.length;
    }

    const total = Object.values(details).reduce((a, b) => a + b, 0);
    return {
      ok: true,
      message: `Seed berhasil! ${total} data berhasil ditransfer ke database baru 🎉`,
      details,
    };
  } catch (err: any) {
    return { ok: false, message: `Seed gagal: ${err.message}` };
  }
}

export async function switchDatabase(newUrl: string): Promise<{ ok: boolean; message: string }> {
  const vercelToken = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!vercelToken || !projectId) {
    return { ok: false, message: "VERCEL_TOKEN atau VERCEL_PROJECT_ID belum di-set!" };
  }

  try {
    const envRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
      headers: { Authorization: `Bearer ${vercelToken}` },
    });
    const envData = await envRes.json();
    const neonEnv = envData.envs?.find((e: any) => e.key === "NEON_DATABASE_URL");

    if (!neonEnv) {
      return { ok: false, message: "Env var NEON_DATABASE_URL ga ketemu di Vercel!" };
    }

    const updateRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${neonEnv.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: newUrl }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json();
      return { ok: false, message: `Gagal update env var: ${JSON.stringify(err)}` };
    }

    const deploymentsRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1&target=production`,
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    );
    const deploymentsData = await deploymentsRes.json();
    const lastDeploy = deploymentsData.deployments?.[0];

    if (lastDeploy) {
      await fetch(`https://api.vercel.com/v13/deployments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "waste",
          project: projectId,
          target: "production",
          gitSource: {
            type: "github",
            repoId: lastDeploy.gitSource?.repoId,
            ref: lastDeploy.gitSource?.ref || "main",
          },
        }),
      });
    }

    return {
      ok: true,
      message: "Database berhasil di-switch! 🔄 Vercel lagi redeploy, tunggu ~30 detik...",
    };
  } catch (err: any) {
    return { ok: false, message: `Switch gagal: ${err.message}` };
  }
}
