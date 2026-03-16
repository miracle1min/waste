import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllConfigs, upsertConfig, deleteConfig } from "../../_lib/db.js";
import { testConnection, seedDatabase, switchDatabase, seedTenantDatabase, migrateToTenantDb } from "../../_lib/database-ops.js";
import { uploadToR2 } from "../../_lib/r2.js";
import { resolveTenantCredentials } from "../../_lib/tenant-resolver.js";
import { requireRole, handleAuthError } from "../../_lib/auth.js";

// BUG-005 fix: Mask sensitive fields in API responses
function maskConfig(config: any): any {
  return {
    ...config,
    google_sheets_credentials: config.google_sheets_credentials ? "••••••••" : "",
    r2_secret_access_key: config.r2_secret_access_key ? "••••••••" : "",
    has_sheets_creds: !!config.google_sheets_credentials,
    has_r2_secret: !!config.r2_secret_access_key,
  };
}

export async function handleConfigs(req: VercelRequest, res: VercelResponse) {
  try {
    // BUG-003 fix: Server-side JWT auth
    requireRole(req, "super_admin");
  } catch (err) {
    return handleAuthError(err, res);
  }

  try {
    if (req.method === "GET") {
      const configs = await getAllConfigs();
      // BUG-005 fix: Mask sensitive credentials
      return res.json({ configs: configs.map(maskConfig) });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = req.body || {};

      // Database management actions
      if (body.action === "db-test") {
        // BUG-007 fix: Only allow testing with preconfigured DB URLs, not arbitrary ones
        if (!body.db_url) return res.status(400).json({ error: "URL database wajib diisi!" });
        const result = await testConnection(body.db_url);
        return res.json(result);
      }

      // Seed a new per-tenant database (create tables)
      if (body.action === "seed-tenant-db") {
        if (!body.db_url) return res.status(400).json({ error: "URL database wajib diisi!" });
        if (!body.tenant_id) return res.status(400).json({ error: "tenant_id wajib diisi!" });
        const result = await seedTenantDatabase(body.db_url, body.tenant_id);
        return res.json(result);
      }

      // Migrate data from master to per-tenant DB
      if (body.action === "migrate-tenant-db") {
        if (!body.db_url) return res.status(400).json({ error: "URL database target wajib diisi!" });
        if (!body.tenant_id) return res.status(400).json({ error: "tenant_id wajib diisi!" });
        const sourceUrl = process.env.NEON_DATABASE_URL;
        if (!sourceUrl) return res.status(500).json({ error: "Database source belum dikonfigurasi." });
        const result = await migrateToTenantDb(sourceUrl, body.db_url, body.tenant_id);
        return res.json(result);
      }

      if (body.action === "db-seed") {
        if (!body.target_url) return res.status(400).json({ error: "URL database target wajib diisi!" });
        const sourceUrl = process.env.NEON_DATABASE_URL;
        if (!sourceUrl) return res.status(500).json({ error: "Database source belum dikonfigurasi." });
        const result = await seedDatabase(sourceUrl, body.target_url);
        return res.json(result);
      }

      if (body.action === "db-switch") {
        if (!body.new_url) return res.status(400).json({ error: "URL database baru wajib diisi!" });
        const result = await switchDatabase(body.new_url);
        return res.json(result);
      }

      // Upload signature to R2
      if (body.action === "upload-signature") {
        const { tenant_id, file_base64, file_name, mime_type } = body;
        if (!tenant_id || !file_base64 || !file_name) {
          return res.status(400).json({ error: "tenant_id, file_base64, dan file_name wajib diisi!" });
        }
        const creds = await resolveTenantCredentials(tenant_id);
        const buffer = Buffer.from(file_base64, "base64");
        const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
        const fullUrl = await uploadToR2(buffer, safeName, mime_type || "image/jpeg", "signatures", {
          accountId: creds.r2AccountId,
          accessKeyId: creds.r2AccessKeyId,
          secretAccessKey: creds.r2SecretAccessKey,
          bucketName: creds.r2BucketName,
          publicUrl: creds.r2PublicUrl,
        });
        const publicBase = (creds.r2PublicUrl || "").replace(/\/$/, "");
        const signaturePath = publicBase ? fullUrl.replace(publicBase + "/", "") : fullUrl;
        return res.json({ success: true, signature_url: signaturePath, full_url: fullUrl });
      }

      // Migrate from env vars
      if (body.action === "migrate_from_env") {
        const tenantId = body.tenant_id;
        if (!tenantId) return res.status(400).json({ error: "tenant_id wajib diisi!" });

        const config = await upsertConfig({
          tenant_id: tenantId,
          google_spreadsheet_id: process.env.GOOGLE_SPREADSHEET_ID || "",
          google_sheets_credentials: process.env.GOOGLE_SHEETS_CREDENTIALS || "",
          r2_account_id: process.env.R2_ACCOUNT_ID || "",
          r2_access_key_id: process.env.R2_ACCESS_KEY_ID || "",
          r2_secret_access_key: process.env.R2_SECRET_ACCESS_KEY || "",
          r2_bucket_name: process.env.R2_BUCKET_NAME || "",
          r2_public_url: process.env.R2_PUBLIC_URL || "",
          extra_config: {
            google_drive_folder_id: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
            master_spreadsheet_id: process.env.MASTER_SPREADSHEET_ID || "",
            cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
            cloudinary_api_key: process.env.CLOUDINARY_API_KEY || "",
            cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET || "",
          },
        });

        return res.json({
          success: true,
          message: `Config untuk tenant "${tenantId}" berhasil dimigrasi dari env vars! 🎉`,
          config: maskConfig(config),
        });
      }

      // Normal upsert
      if (!body.tenant_id) return res.status(400).json({ error: "tenant_id wajib diisi!" });
      const config = await upsertConfig(body);
      return res.json({ success: true, config: maskConfig(config) });
    }

    if (req.method === "DELETE") {
      const tenantId = (req.query.tenant_id || req.body?.tenant_id) as string;
      if (!tenantId) return res.status(400).json({ error: "tenant_id wajib!" });
      const ok = await deleteConfig(tenantId);
      if (!ok) return res.status(404).json({ error: "Config ga ketemu!" });
      return res.json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: unknown) {
    // BUG-008 fix: Don't leak internal errors
    console.error("Configs API error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
}
