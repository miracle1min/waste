import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireRole, handleAuthError } from '../../_lib/auth.js';
import {
  getAllKeys,
  createKey,
  updateKey,
  deleteKey,
  ensureGeminiKeysTable,
  invalidateCache,
} from '../../_lib/gemini-key-pool.js';

export async function handleGeminiKeys(req: VercelRequest, res: VercelResponse) {
  try {
    requireRole(req, 'super_admin');
  } catch (err) {
    return handleAuthError(err, res);
  }

  await ensureGeminiKeysTable();

  try {
    switch (req.method) {
      case 'GET': {
        const keys = await getAllKeys();
        return res.json({ success: true, keys });
      }

      case 'POST': {
        const { key_name, api_key } = req.body || {};
        if (!key_name || typeof key_name !== 'string' || !key_name.trim()) {
          return res.status(400).json({ success: false, message: 'key_name wajib diisi' });
        }
        if (!api_key || typeof api_key !== 'string' || !api_key.trim()) {
          return res.status(400).json({ success: false, message: 'api_key wajib diisi' });
        }
        const created = await createKey(key_name.trim(), api_key.trim());
        return res.status(201).json({ success: true, key: { ...created, api_key: undefined } });
      }

      case 'PUT': {
        const id = parseInt(req.query.id as string);
        if (!id || isNaN(id)) {
          return res.status(400).json({ success: false, message: 'id wajib diisi' });
        }
        const { key_name, api_key, is_active } = req.body || {};
        const updated = await updateKey(id, {
          ...(key_name !== undefined && { key_name: key_name.trim() }),
          ...(api_key !== undefined && { api_key: api_key.trim() }),
          ...(is_active !== undefined && { is_active: Boolean(is_active) }),
        });
        if (!updated) return res.status(404).json({ success: false, message: 'Key tidak ditemukan' });
        return res.json({ success: true, key: { ...updated, api_key: undefined } });
      }

      case 'DELETE': {
        const id = parseInt(req.query.id as string);
        if (!id || isNaN(id)) {
          return res.status(400).json({ success: false, message: 'id wajib diisi' });
        }
        const deleted = await deleteKey(id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Key tidak ditemukan' });
        invalidateCache();
        return res.json({ success: true, deleted: true });
      }

      default:
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
  } catch (err: any) {
    console.error('[GeminiKeys] Error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
}
