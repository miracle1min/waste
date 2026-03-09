import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';

/**
 * Signature lookup API.
 * Returns the R2 URL for a given person's signature.
 * 
 * GET /api/signatures?name=PAJAR
 * GET /api/signatures (returns all mappings)
 */

const SIGNATURE_MAP: Record<string, string> = {
  // QC
  PAJAR: 'signatures/pajar.jpeg',
  RIZKI: 'signatures/rizki.jpeg',
  JOHAN: 'signatures/johan.jpeg',
  LUISA: 'signatures/luisa.jpeg',
  // MANAJER
  GISSEL: 'signatures/gissel.jpg',
  ANISA: 'signatures/anisa.jpeg',
  HUTRI: 'signatures/hutri.jpeg',
  IMBRON: 'signatures/imbron.jpg',
  AQIL: 'signatures/aqil.jpg',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const tenantId = extractTenantId(req);
  const tenantCreds = await resolveTenantCredentials(tenantId);
  const publicUrl = (tenantCreds.r2PublicUrl || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (!publicUrl) {
    return res.status(500).json({ success: false, message: 'R2_PUBLIC_URL not configured' });
  }

  const name = (req.query.name as string || '').toUpperCase().trim();

  if (name) {
    const key = SIGNATURE_MAP[name];
    if (!key) {
      return res.status(404).json({ success: false, message: `Tanda tangan untuk "${name}" tidak ditemukan` });
    }
    return res.json({ success: true, name, url: `${publicUrl}/${key}` });
  }

  // Return all mappings
  const all: Record<string, string> = {};
  for (const [n, key] of Object.entries(SIGNATURE_MAP)) {
    all[n] = `${publicUrl}/${key}`;
  }
  return res.json({ success: true, signatures: all });
}
