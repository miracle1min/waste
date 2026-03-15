import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMasterSQL } from "../../_lib/tenant-db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sql = getMasterSQL();

    await sql`
      CREATE TABLE IF NOT EXISTS google_users (
        id SERIAL PRIMARY KEY,
        google_email VARCHAR(255) UNIQUE NOT NULL,
        google_name VARCHAR(255),
        google_picture TEXT,
        user_id INTEGER NOT NULL,
        username VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'admin_store',
        tenant_id VARCHAR(100) NOT NULL DEFAULT '',
        linked_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_google_users_email ON google_users(google_email)`;

    return res.status(200).json({
      success: true,
      message: "Google users table created successfully.",
    });
  } catch (err: any) {
    console.error("Google OAuth setup error:", err);
    return res.status(500).json({ error: "Failed to create google_users table: " + err.message });
  }
}
