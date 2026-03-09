import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAllTenantConfigs, getTenantConfig, saveTenantConfig, deleteTenantConfig } from '../_lib/master-sheet';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-role');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const role = req.headers['x-user-role'];
  if (role !== 'super_admin') {
    return res.status(403).json({ error: 'Akses ditolak — cuma Super Admin yang boleh' });
  }

  try {
    if (req.method === 'GET') {
      const tenantId = req.query.tenant_id as string;
      if (tenantId) {
        const config = await getTenantConfig(tenantId);
        return res.status(200).json({ config: config || null });
      }
      const configs = await getAllTenantConfigs();
      return res.status(200).json({ configs });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { tenant_id, ...configData } = req.body || {};
      if (!tenant_id) {
        return res.status(400).json({ error: 'tenant_id wajib' });
      }
      const config = await saveTenantConfig(tenant_id, configData);
      return res.status(200).json({ config });
    }

    if (req.method === 'DELETE') {
      const tenantId = (req.query.tenant_id as string) || req.body?.tenant_id;
      if (!tenantId) return res.status(400).json({ error: 'tenant_id wajib' });
      const ok = await deleteTenantConfig(tenantId);
      if (!ok) return res.status(404).json({ error: 'Config ga ketemu' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Configs API error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
