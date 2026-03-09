import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAllUsers, createUser, updateUser, deleteUser, getAllTenants } from '../_lib/master-sheet';

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
      const users = await getAllUsers();
      // Jangan expose password ke frontend
      const safeUsers = users.map(({ password, ...u }) => u);
      return res.status(200).json({ users: safeUsers });
    }

    if (req.method === 'POST') {
      const { tenant_id, username, password, role: userRole } = req.body || {};
      if (!tenant_id || !username || !password || !userRole) {
        return res.status(400).json({ error: 'Semua field wajib diisi' });
      }
      const user = await createUser({ tenant_id, username, password, role: userRole });
      const { password: _, ...safeUser } = user;
      return res.status(201).json({ user: safeUser });
    }

    if (req.method === 'PUT') {
      const { id, ...data } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID user wajib' });
      const user = await updateUser(id, data);
      if (!user) return res.status(404).json({ error: 'User ga ketemu' });
      const { password: _, ...safeUser } = user;
      return res.status(200).json({ user: safeUser });
    }

    if (req.method === 'DELETE') {
      const id = (req.query.id as string) || req.body?.id;
      if (!id) return res.status(400).json({ error: 'ID user wajib' });
      const ok = await deleteUser(id);
      if (!ok) return res.status(404).json({ error: 'User ga ketemu' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Users API error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
