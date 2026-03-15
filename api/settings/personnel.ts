import type { VercelRequest, VercelResponse } from '@vercel/node';
import { tenantQuery } from '../_lib/tenant-db.js';
import { requireRole, handleAuthError, getAuthorizedTenantId, extractToken, verifyToken } from '../_lib/auth.js';

/**
 * Personnel CRUD API (admin only) — now uses per-tenant DB
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    requireRole(req, "super_admin", "admin_store");
  } catch (err) {
    return handleAuthError(err, res);
  }

  try {
    switch (req.method) {
      case 'GET': {
        // SEC-FIX: Use JWT-based tenant isolation
        const jwt = verifyToken(extractToken(req) || "");
        const tenantId = jwt ? getAuthorizedTenantId(req, jwt) : (req.query.tenant_id as string);
        if (!tenantId) return res.status(400).json({ success: false, message: 'tenant_id wajib diisi' });
        const rows = await tenantQuery(tenantId,
          'SELECT id, tenant_id, name, full_name, role, signature_url, status, created_at FROM personnel WHERE tenant_id = $1 ORDER BY role, name',
          [tenantId]
        );
        return res.json({ success: true, personnel: rows });
      }

      case 'POST': {
        const { tenant_id, name, full_name, role, signature_url, status } = req.body || {};
        if (!tenant_id || !name || !role) {
          return res.status(400).json({ success: false, message: 'tenant_id, name, dan role wajib diisi' });
        }
        if (!['qc', 'manager'].includes(role)) {
          return res.status(400).json({ success: false, message: 'role harus qc atau manager' });
        }
        const rows = await tenantQuery(tenant_id,
          'INSERT INTO personnel (tenant_id, name, full_name, role, signature_url, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [tenant_id, name.toUpperCase(), full_name || name, role, signature_url || null, status || 'active']
        );
        return res.status(201).json({ success: true, personnel: rows[0] });
      }

      case 'PUT': {
        const id = req.query.id as string;
        const tenantId = (req.body?.tenant_id || req.query.tenant_id) as string;
        if (!id) return res.status(400).json({ success: false, message: 'id wajib diisi' });
        if (!tenantId) return res.status(400).json({ success: false, message: 'tenant_id wajib diisi' });
        const { name, full_name, role, signature_url, status } = req.body || {};
        const sets: string[] = [];
        const vals: any[] = [];
        let idx = 1;
        if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name.toUpperCase()); }
        if (full_name !== undefined) { sets.push(`full_name = $${idx++}`); vals.push(full_name); }
        if (role !== undefined) { sets.push(`role = $${idx++}`); vals.push(role); }
        if (signature_url !== undefined) { sets.push(`signature_url = $${idx++}`); vals.push(signature_url); }
        if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }
        if (!sets.length) return res.status(400).json({ success: false, message: 'Ga ada yang diupdate' });
        sets.push(`updated_at = NOW()`);
        vals.push(id);
        const rows = await tenantQuery(tenantId,
          `UPDATE personnel SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
          vals
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Personnel ga ketemu' });
        return res.json({ success: true, personnel: rows[0] });
      }

      case 'DELETE': {
        const delId = req.query.id as string;
        const tenantId = (req.query.tenant_id || req.body?.tenant_id) as string;
        if (!delId) return res.status(400).json({ success: false, message: 'id wajib diisi' });
        if (!tenantId) return res.status(400).json({ success: false, message: 'tenant_id wajib diisi' });
        const rows = await tenantQuery(tenantId, 'DELETE FROM personnel WHERE id = $1 RETURNING id', [delId]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Personnel ga ketemu' });
        return res.json({ success: true, deleted: true });
      }

      default:
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
  } catch (err: any) {
    console.error('Personnel API error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
}
