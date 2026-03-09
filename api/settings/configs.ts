import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllConfigs, upsertConfig, deleteConfig } from "../_lib/db.js";
import { testConnection, seedDatabase, switchDatabase } from "../_lib/database-ops.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const role = req.headers["x-user-role"] as string;
  if (role !== "super_admin") return res.status(403).json({ error: "Akses ditolak! Cuma Super Admin yang boleh." });

  try {
    if (req.method === "GET") {
      const configs = await getAllConfigs();
      return res.json({ configs });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = req.body || {};

      // Database management actions
      if (body.action === "db-test") {
        if (!body.db_url) return res.status(400).json({ error: "URL database wajib diisi!" });
        const result = await testConnection(body.db_url);
        return res.json(result);
      }

      if (body.action === "db-seed") {
        if (!body.target_url) return res.status(400).json({ error: "URL database target wajib diisi!" });
        const sourceUrl = process.env.NEON_DATABASE_URL;
        if (!sourceUrl) return res.status(500).json({ error: "NEON_DATABASE_URL belum di-set!" });
        const result = await seedDatabase(sourceUrl, body.target_url);
        return res.json(result);
      }

      if (body.action === "db-switch") {
        if (!body.new_url) return res.status(400).json({ error: "URL database baru wajib diisi!" });
        const result = await switchDatabase(body.new_url);
        return res.json(result);
      }

      // Special action: migrate from env vars
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
          config: {
            tenant_id: config.tenant_id,
            has_spreadsheet: !!config.google_spreadsheet_id,
            has_sheets_creds: !!config.google_sheets_credentials,
            has_r2: !!config.r2_account_id,
            has_extra: !!config.extra_config,
          },
        });
      }

      // Normal upsert
      if (!body.tenant_id) return res.status(400).json({ error: "tenant_id wajib diisi!" });
      const config = await upsertConfig(body);
      return res.json({ success: true, config });
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
    console.error("Configs API error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
}
