import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';
import { tenantQuery } from './_lib/tenant-db.js';
import { requireAuth, getAuthorizedTenantId, handleAuthError } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

/**
 * Signature lookup API — reads from per-tenant DB (personnel table)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  if (checkRateLimit(req, res, { name: "signatures", maxRequests: 60, windowSeconds: 60 })) return;

  // SEC-FIX: Require authentication and use JWT-based tenant
  let jwtPayload;
  try {
    jwtPayload = requireAuth(req);
  } catch (err) {
    return handleAuthError(err, res);
  }

  try {
    const tenantId = getAuthorizedTenantId(req, jwtPayload);
    if (!tenantId) return res.status(400).json({ success: false, message: 'tenant_id wajib diisi' });

    const tenantCreds = await resolveTenantCredentials(tenantId);
    const publicUrl = (tenantCreds.r2PublicUrl || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    if (!publicUrl) {
      return res.status(500).json({ success: false, message: 'R2_PUBLIC_URL belum diset' });
    }

    const name = (req.query.name as string || '').toUpperCase().trim();
    const role = (req.query.role as string || '').toLowerCase().trim();

    // Single lookup by name
    if (name) {
      const rows = await tenantQuery(tenantId,
        'SELECT name, full_name, role, signature_url FROM personnel WHERE tenant_id = $1 AND name = $2 AND status = $3',
        [tenantId, name, 'active']
      );
      if (!rows.length) {
        return res.status(404).json({ success: false, message: `TTD untuk "${name}" ga ketemu` });
      }
      const p = rows[0];
      return res.json({
        success: true,
        name: p.name,
        full_name: p.full_name,
        role: p.role,
        url: p.signature_url ? `${publicUrl}/${p.signature_url}` : null,
      });
    }

    // List all (optionally filtered by role)
    let sql = 'SELECT name, full_name, role, signature_url FROM personnel WHERE tenant_id = $1 AND status = $2';
    const params: any[] = [tenantId, 'active'];
    if (role && ['qc', 'manager'].includes(role)) {
      sql += ' AND role = $3';
      params.push(role);
    }
    sql += ' ORDER BY role, name';

    const rows = await tenantQuery(tenantId, sql, params);

    const signatures: Record<string, string> = {};
    const personnel: any[] = [];
    for (const p of rows) {
      const url = p.signature_url ? `${publicUrl}/${p.signature_url}` : null;
      if (url) signatures[p.name] = url;
      personnel.push({
        name: p.name,
        full_name: p.full_name,
        role: p.role,
        url,
      });
    }

    return res.json({ success: true, signatures, personnel });
  } catch (err: any) {
    console.error('Signatures API error:', err);
    // SEC-FIX: Don't leak internal error details to client
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
}
