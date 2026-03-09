import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../_lib/master-sheet';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }

    const result = await authenticateUser(username, password);

    if (!result) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    return res.status(200).json({
      success: true,
      user: result.user,
      tenant: result.tenant,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Ada masalah di server, coba lagi' });
  }
}
