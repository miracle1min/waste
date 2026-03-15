import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createToken, requireRole, handleAuthError } from "../_lib/auth.js";
import { getMasterSQL } from "../_lib/tenant-db.js";

function decodeBase64Url(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface GoogleUserInfo {
  email: string;
  name: string;
  picture: string;
}

function extractUserFromIdToken(idToken: string): GoogleUserInfo {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid id_token format");
  const payload = JSON.parse(decodeBase64Url(parts[1]));
  return {
    email: payload.email || "",
    name: payload.name || "",
    picture: payload.picture || "",
  };
}

// GET without code → redirect to Google OAuth
// GET with code → handle callback
// POST action=link → link Google account (super_admin only)
// POST action=setup → create google_users table
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();

  // POST requests: link or setup
  if (req.method === "POST" || req.method === "DELETE") {
    return handlePostActions(req, res);
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // GET with code param → callback flow
  const code = req.query.code as string;
  if (code) {
    return handleCallback(req, res);
  }

  // GET with action=setup → setup table
  const action = req.query.action as string;
  if (action === "setup") {
    return handleSetup(req, res);
  }

  // GET with action=list → list linked users (super_admin)
  if (action === "list") {
    return handleListLinkedUsers(req, res);
  }

  // Default GET → redirect to Google
  return handleRedirect(req, res);
}

// === REDIRECT TO GOOGLE ===
async function handleRedirect(req: VercelRequest, res: VercelResponse) {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "GOOGLE_OAUTH_CLIENT_ID not configured" });
    }

    const tenantId = (req.query.tenant_id as string) || "";
    const origin = `https://${req.headers.host || "gacoanku.my.id"}`;
    const redirectUri = `${origin}/api/auth/google`;

    const state = Buffer.from(JSON.stringify({ tenant_id: tenantId })).toString("base64");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.redirect(302, googleAuthUrl);
  } catch (err: any) {
    console.error("Google OAuth init error:", err);
    return res.status(500).json({ error: "Gagal memulai Google OAuth" });
  }
}

// === CALLBACK HANDLER ===
async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const baseUrl = `https://${req.headers.host || "gacoanku.my.id"}`;

  try {
    const code = req.query.code as string;
    const stateParam = req.query.state as string;
    const errorParam = req.query.error as string;

    if (errorParam) {
      return res.redirect(302, `${baseUrl}/?google_auth=error&message=${encodeURIComponent("Login Google dibatalkan.")}`);
    }

    if (!code) {
      return res.redirect(302, `${baseUrl}/?google_auth=error&message=${encodeURIComponent("Kode otorisasi tidak ditemukan.")}`);
    }

    // Decode state
    let tenantId = "";
    if (stateParam) {
      try {
        const stateData = JSON.parse(Buffer.from(stateParam, "base64").toString("utf8"));
        tenantId = stateData.tenant_id || "";
      } catch {}
    }

    // Exchange code for tokens
    const origin = `https://${req.headers.host || "gacoanku.my.id"}`;
    const redirectUri = `${origin}/api/auth/google`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Google token exchange failed:", errText);
      return res.redirect(302, `${baseUrl}/?google_auth=error&message=${encodeURIComponent("Gagal menukar kode otorisasi dengan Google.")}`);
    }

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

    // Extract user info from id_token
    const googleUser = extractUserFromIdToken(tokenData.id_token);

    if (!googleUser.email) {
      return res.redirect(302, `${baseUrl}/?google_auth=error&message=${encodeURIComponent("Email tidak ditemukan dari akun Google.")}`);
    }

    // Look up user in google_users table
    const masterSql = getMasterSQL();
    const rows = await masterSql`SELECT * FROM google_users WHERE google_email = ${googleUser.email}`;

    if (rows.length === 0) {
      return res.redirect(302, `${baseUrl}/?google_auth=error&message=${encodeURIComponent("Akun Google belum terdaftar. Hubungi Super Admin untuk menghubungkan akun.")}&email=${encodeURIComponent(googleUser.email)}`);
    }

    const row = rows[0];

    // Update last_login and google info
    await masterSql`UPDATE google_users SET last_login = NOW(), google_name = ${googleUser.name}, google_picture = ${googleUser.picture} WHERE google_email = ${googleUser.email}`;

    // Create JWT token
    const token = createToken({
      userId: row.user_id,
      username: row.username,
      role: row.role,
      tenantId: row.tenant_id || "",
    });

    // Look up tenant name
    let tenantName = "";
    if (row.tenant_id) {
      const tenantRows = await masterSql`SELECT name FROM tenants WHERE id = ${row.tenant_id}`;
      if (tenantRows.length > 0) {
        tenantName = tenantRows[0].name || "";
      }
    }

    const displayName = row.display_name || row.username;

    // Redirect to frontend with auth data
    const params = new URLSearchParams({
      google_auth: "success",
      token,
      username: row.username,
      role: row.role,
      tenant_id: row.tenant_id || "",
      tenant_name: tenantName,
      display_name: displayName,
    });

    return res.redirect(302, `${baseUrl}/?${params.toString()}`);
  } catch (err: any) {
    console.error("Google OAuth callback error:", err);
    return res.redirect(302, `${baseUrl}/?google_auth=error&message=${encodeURIComponent("Terjadi kesalahan saat login dengan Google.")}`);
  }
}

// === POST ACTIONS: LINK / SETUP ===
async function handlePostActions(req: VercelRequest, res: VercelResponse) {
  const action = req.body?.action || "link";

  if (action === "setup") {
    return handleSetup(req, res);
  }

  // Link/unlink requires super_admin
  try {
    requireRole(req, "super_admin");
  } catch (err) {
    return handleAuthError(err, res);
  }

  const sql = getMasterSQL();

  try {
    if (req.method === "DELETE" || action === "unlink") {
      const { google_email } = req.body || {};
      if (!google_email) {
        return res.status(400).json({ error: "google_email wajib diisi." });
      }
      await sql`DELETE FROM google_users WHERE google_email = ${google_email}`;
      return res.status(200).json({ success: true, message: "Google account unlinked successfully." });
    }

    // POST link
    const { google_email, user_id, username, display_name, role, tenant_id } = req.body || {};
    if (!google_email || !user_id || !username) {
      return res.status(400).json({ error: "google_email, user_id, dan username wajib diisi." });
    }

    await sql`
      INSERT INTO google_users (google_email, user_id, username, display_name, role, tenant_id)
      VALUES (${google_email}, ${user_id}, ${username}, ${display_name || ""}, ${role || "admin_store"}, ${tenant_id || ""})
      ON CONFLICT (google_email) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        tenant_id = EXCLUDED.tenant_id
    `;

    return res.status(200).json({ success: true, message: "Google account linked successfully." });
  } catch (err: any) {
    console.error("Google link error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan: " + err.message });
  }
}

// === LIST LINKED USERS ===
async function handleListLinkedUsers(req: VercelRequest, res: VercelResponse) {
  try {
    requireRole(req, "super_admin");
  } catch (err) {
    return handleAuthError(err, res);
  }

  try {
    const sql = getMasterSQL();
    const rows = await sql`SELECT * FROM google_users ORDER BY linked_at DESC`;
    return res.status(200).json({ success: true, data: rows });
  } catch (err: any) {
    console.error("Google list error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan: " + err.message });
  }
}

// === SETUP TABLE ===
async function handleSetup(req: VercelRequest, res: VercelResponse) {
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
