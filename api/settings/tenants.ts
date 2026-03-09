import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAllTenants, createTenant, updateTenant, deleteTenant } from '../_lib/master-sheet';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-role');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Super admin check
  const role = req.headers['x-user-role'];
  if (role !== 'super_admin') {
    return res.status(403).json({ error: 'Akses ditolak — cuma Super Admin yang boleh' });
  }

  try {
    if (req.method === 'GET') {
      const tenants = await getAllTenants();
      return res.status(200).json({ tenants });
    }

    if (req.method === 'POST') {
      const { name, store_code } = req.body || {};
      if (!name || !store_code) {
        return res.status(400).json({ error: 'Nama store dan kode store wajib diisi' });
      }
      const tenant = await createTenant({ name, store_code });
      return res.status(201).json({ tenant });
    }

    if (req.method === 'PUT') {
      const { id, ...data } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID tenant wajib' });
      const tenant = await updateTenant(id, data);
      if (!tenant) return res.status(404).json({ error: 'Tenant ga ketemu' });
      return res.status(200).json({ tenant });
    }

    if (req.method === 'DELETE') {
      const id = (req.query.id as string) || req.body?.id;
      if (!id) return res.status(400).json({ error: 'ID tenant wajib' });
      const ok = await deleteTenant(id);
      if (!ok) return res.status(404).json({ error: 'Tenant ga ketemu' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Tenants API error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
