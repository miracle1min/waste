import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';
import { query } from './_lib/db.js';

/**
 * Signature lookup API - now reads from DB (personnel table)
 * GET /api/signatures?tenant_id=xxx           → all signatures for tenant
 * GET /api/signatures?tenant_id=xxx&name=PAJAR → single signature
 * GET /api/signatures?tenant_id=xxx&role=qc    → filter by role
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const tenantId = (req.query.tenant_id as string) || extractTenantId(req);
    const tenantCreds = await resolveTenantCredentials(tenantId);
    const publicUrl = (tenantCreds.r2PublicUrl || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    if (!publicUrl) {
      return res.status(500).json({ success: false, message: 'R2_PUBLIC_URL belum diset' });
    }

    const name = (req.query.name as string || '').toUpperCase().trim();
    const role = (req.query.role as string || '').toLowerCase().trim();

    // Single lookup by name
    if (name) {
      const rows = await query(
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

    const rows = await query(sql, params);

    // Build signatures map (backward compatible) + detailed list
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
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
}
