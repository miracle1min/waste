import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // Step 1: Check env var
    const url = process.env.NEON_DATABASE_URL;
    if (!url) {
      return res.json({ step: 1, error: "NEON_DATABASE_URL not set", envKeys: Object.keys(process.env).filter(k => k.startsWith('NEON') || k.startsWith('MASTER')) });
    }

    // Step 2: Try importing neon
    const { neon } = await import("@neondatabase/serverless");
    
    // Step 3: Try connecting
    const sql = neon(url);
    const result = await sql`SELECT 1 as test`;
    
    return res.json({ success: true, result, urlPrefix: url.substring(0, 30) + "..." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5) : [];
    return res.json({ error: msg, stack });
  }
}
