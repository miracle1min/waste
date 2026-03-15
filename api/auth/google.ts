import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "GOOGLE_OAUTH_CLIENT_ID not configured" });
    }

    const tenantId = (req.query.tenant_id as string) || "";
    const origin = `https://${req.headers.host || "gacoanku.my.id"}`;
    const redirectUri = `${origin}/api/auth/google/callback`;

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
