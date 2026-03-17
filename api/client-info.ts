import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.headers["x-real-ip"]?.toString() ||
    req.socket?.remoteAddress ||
    "Unknown";

  return res.json({ success: true, ip });
}
