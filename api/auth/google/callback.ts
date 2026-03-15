import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createToken } from "../../_lib/auth.js";
import { getMasterSQL } from "../../_lib/tenant-db.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
    const redirectUri = `${origin}/api/auth/google/callback`;

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
      // User not registered
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
