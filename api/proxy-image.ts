import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, handleAuthError } from './_lib/auth.js';

// BUG-006 fix: Proper URL hostname validation to prevent SSRF
const ALLOWED_HOSTNAMES = [
  'res.cloudinary.com',
  // R2 public URLs — match pattern *.r2.dev and *.r2.cloudflarestorage.com
];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    // Must be HTTPS
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    // Check exact match
    if (hostname === 'res.cloudinary.com') return true;
    // Check R2 patterns
    if (hostname.endsWith('.r2.dev')) return true;
    if (hostname.endsWith('.r2.cloudflarestorage.com')) return true;
    return false;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // SEC-FIX: Require authentication to prevent open proxy abuse
  try {
    requireAuth(req);
  } catch (err) {
    return handleAuthError(err, res);
  }

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  if (!isAllowedUrl(url)) {
    return res.status(403).json({ error: 'URL tidak diizinkan. Hanya Cloudinary dan R2 yang diperbolehkan.' });
  }

  try {
    // BUG-031 fix: Add timeout with AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';

    return res.json({
      success: true,
      dataUrl: `data:${contentType};base64,${base64}`,
    });
  } catch (error: any) {
    console.error('Proxy image error:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout' });
    }
    return res.status(500).json({ error: 'Failed to proxy image' });
  }
}
