/**
 * Database failover operations — test, seed, switch
 * Uses @neondatabase/serverless (HTTP driver, no pg needed)
 */
import { neon } from "@neondatabase/serverless";

const TABLES_DDL = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
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

export async function seedDatabase(sourceUrl: string, targetUrl: string): Promise<{ ok: boolean; message: string; details?: any }> {
  const srcSql = neon(sourceUrl);
  const tgtSql = neon(targetUrl);
  const details: Record<string, number> = {};

  try {
    // 1. Create tables in target
    for (const ddl of TABLES_DDL) {
      await tgtSql(ddl);
    }

    // 2. Clear target tables (reverse order for FK)
    for (const table of [...DATA_TABLES].reverse()) {
      await tgtSql(`DELETE FROM ${table}`);
    }

    // 3. Copy data table by table
    for (const table of DATA_TABLES) {
      const src = await srcSql(`SELECT * FROM ${table}`);
      if (src.length === 0) { details[table] = 0; continue; }

      for (const row of src) {
        const keys = Object.keys(row);
        const vals = Object.values(row);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        const idCol = table === "tenants" ? "id" : table === "users" ? "username" : table === "tenant_configs" ? "tenant_id" : "id";
        await tgtSql(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${idCol}) DO NOTHING`, vals);
      }

      // Reset sequences for serial columns
      if (table !== "tenants") {
        try {
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
    // 1. Get current NEON_DATABASE_URL env var ID
    const envRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
      headers: { Authorization: `Bearer ${vercelToken}` },
    });
    const envData = await envRes.json();
    const neonEnv = envData.envs?.find((e: any) => e.key === "NEON_DATABASE_URL");

    if (!neonEnv) {
      return { ok: false, message: "Env var NEON_DATABASE_URL ga ketemu di Vercel!" };
    }

    // 2. Update NEON_DATABASE_URL with new URL
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

    // 3. Trigger redeployment
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
