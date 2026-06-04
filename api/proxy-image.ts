import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';
import { requireAuth, handleAuthError } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { validate, proxyImageSchema } from './_lib/validators.js';

// BUG-006 fix: Proper URL hostname validation to prevent SSRF
const ALLOWED_HOSTNAMES = [
  'res.cloudinary.com',
  // R2 public URLs — match pattern *.r2.dev and *.r2.cloudflarestorage.com
];

function isAllowedUrl(urlStr: string, requestHost?: string): boolean {
  try {
    const parsed = new URL(urlStr);
    // Must be HTTPS
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    const normalizedRequestHost = (requestHost || '').toLowerCase();
    // Check exact match
    if (hostname === 'res.cloudinary.com') return true;
    if (normalizedRequestHost && hostname === normalizedRequestHost && parsed.pathname === '/api/signatures') return true;
    // Check R2 patterns
    if (hostname.endsWith('.r2.dev')) return true;
    if (hostname.endsWith('.r2.cloudflarestorage.com')) return true;
    if (hostname.endsWith('.blob.vercel-storage.com')) return true;
    return false;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req, res, { name: "proxy", maxRequests: 60, windowSeconds: 60 })) return;

  // SEC-FIX: Require authentication to prevent open proxy abuse
  try {
    requireAuth(req);
  } catch (err) {
    return handleAuthError(err, res);
  }

  const parsed = validate(proxyImageSchema, req.query, res);
  if (!parsed) return;
  const { url } = parsed;

  const requestHost = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || '';

  if (!isAllowedUrl(url, requestHost)) {
    return res.status(403).json({ error: 'URL tidak diizinkan. Hanya Cloudinary, R2, dan Vercel Blob yang diperbolehkan.' });
  }

  try {
    const MAX_SIZE = 5 * 1024 * 1024;
    let buffer: Buffer;
    let contentType = 'image/png';

    if (new URL(url).hostname.endsWith('.private.blob.vercel-storage.com')) {
      const blob = await get(url, { access: 'private', useCache: true });
      if (!blob || blob.statusCode !== 200) {
        return res.status(404).json({ error: 'Blob tidak ditemukan' });
      }
      contentType = blob.blob.contentType || contentType;
      const arrayBuffer = await new Response(blob.stream).arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      // BUG-031 fix: Add timeout with AbortController
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch image' });
      }

      // FIX #37: Limit proxied image size to prevent memory exhaustion (max 5MB)
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_SIZE) {
        return res.status(413).json({ error: 'Image too large (max 5MB)' });
      }

      buffer = Buffer.from(await response.arrayBuffer());
      contentType = response.headers.get('content-type') || contentType;
    }
    if (buffer.length > MAX_SIZE) {
      return res.status(413).json({ error: 'Image too large (max 5MB)' });
    }
    const base64 = buffer.toString('base64');

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
