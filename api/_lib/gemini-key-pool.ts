/**
 * Gemini API Key Pool — Sticky Pool Strategy
 *
 * Sticky: setiap kombinasi userId+tenantId+date selalu dapat key yang sama
 * Pool: unlimited keys, dikelola via super_admin settings
 * Fallback: pesan friendly kalau semua key gagal
 */
import { getMasterSQL } from './tenant-db.js';

export interface GeminiApiKey {
  id: number;
  key_name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// In-memory cache untuk menghindari DB query setiap request
let cachedKeys: GeminiApiKey[] = [];
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 1 menit

export async function getActiveKeys(): Promise<GeminiApiKey[]> {
  const now = Date.now();
  if (cachedKeys.length > 0 && now < cacheExpiry) {
    return cachedKeys;
  }

  try {
    const sql = getMasterSQL();
    const rows = await sql`
      SELECT id, key_name, api_key, is_active, created_at, updated_at
      FROM gemini_api_keys
      WHERE is_active = true
      ORDER BY id ASC
    `;
    cachedKeys = rows as GeminiApiKey[];
    cacheExpiry = now + CACHE_TTL_MS;
    return cachedKeys;
  } catch (err) {
    console.error('[KeyPool] Failed to fetch keys from DB:', err);
    // Fallback ke env var kalau DB gagal
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey) {
      return [{ id: 0, key_name: 'env-fallback', api_key: envKey, is_active: true, created_at: '', updated_at: '' }];
    }
    return [];
  }
}

export function invalidateCache() {
  cachedKeys = [];
  cacheExpiry = 0;
}

/**
 * Sticky hash: userId + tenantId + YYYYMMDD → consistent index per user per day
 */
function stickyHash(userId: string | number, tenantId: string): number {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const str = `${userId}-${tenantId}-${today}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit int
  }
  return Math.abs(hash);
}

/**
 * Get sticky API key untuk user tertentu
 * Returns null kalau tidak ada key aktif
 */
export async function getStickyApiKey(
  userId: string | number,
  tenantId: string
): Promise<string | null> {
  const keys = await getActiveKeys();
  if (keys.length === 0) return null;

  const hash = stickyHash(userId, tenantId);
  const index = hash % keys.length;
  return keys[index].api_key;
}

/**
 * Get ordered list of keys starting from sticky key
 * Dipakai untuk fallback: coba sticky key dulu, kalau gagal coba key lain
 */
export async function getOrderedKeys(
  userId: string | number,
  tenantId: string
): Promise<string[]> {
  const keys = await getActiveKeys();
  if (keys.length === 0) return [];

  const hash = stickyHash(userId, tenantId);
  const startIndex = hash % keys.length;

  // Reorder: mulai dari sticky key, lanjut ke key berikutnya
  const ordered: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const idx = (startIndex + i) % keys.length;
    ordered.push(keys[idx].api_key);
  }
  return ordered;
}

/**
 * Friendly fallback message kalau semua key habis/gagal
 */
export const FALLBACK_MESSAGES = [
  'Waduh, sorry nih! QC Helper lagi cuti mudik dulu ya hehe 🙏 Coba lagi bentar lagi ya!',
  'Aduh maaf banget, QC Helper-nya lagi istirahat sebentar nih 😅 Tunggu sebentar ya, pasti balik!',
  'Hehe sorry ya, QC Helper lagi overload dikit nih 🙈 Coba lagi dalam beberapa menit ya!',
  'Maaf ya, lagi ada gangguan kecil nih di QC Helper 🙏 Kalau urgent, hubungi admin dulu ya!',
];

export function getFallbackMessage(): string {
  const idx = Math.floor(Math.random() * FALLBACK_MESSAGES.length);
  return FALLBACK_MESSAGES[idx];
}

// ==================== CRUD OPERATIONS ====================

export async function getAllKeys(): Promise<Array<Omit<GeminiApiKey, 'api_key'> & { api_key_masked: string }>> {
  const sql = getMasterSQL();
  const rows = await sql`
    SELECT id, key_name, is_active, created_at, updated_at,
           CONCAT(LEFT(api_key, 8), '...', RIGHT(api_key, 4)) as api_key_masked
    FROM gemini_api_keys
    ORDER BY id ASC
  `;
  return rows as Array<Omit<GeminiApiKey, 'api_key'> & { api_key_masked: string }>;
}

export async function createKey(keyName: string, apiKey: string): Promise<GeminiApiKey> {
  const sql = getMasterSQL();
  const rows = await sql`
    INSERT INTO gemini_api_keys (key_name, api_key, is_active)
    VALUES (${keyName}, ${apiKey}, true)
    RETURNING *
  `;
  invalidateCache();
  return rows[0] as GeminiApiKey;
}

export async function updateKey(id: number, data: { key_name?: string; api_key?: string; is_active?: boolean }): Promise<GeminiApiKey | null> {
  const sql = getMasterSQL();
  const rows = await sql`
    UPDATE gemini_api_keys SET
      key_name   = COALESCE(${data.key_name ?? null}, key_name),
      api_key    = COALESCE(${data.api_key ?? null}, api_key),
      is_active  = COALESCE(${data.is_active ?? null}, is_active),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  invalidateCache();
  return (rows[0] as GeminiApiKey) || null;
}

export async function deleteKey(id: number): Promise<boolean> {
  const sql = getMasterSQL();
  const rows = await sql`DELETE FROM gemini_api_keys WHERE id = ${id} RETURNING id`;
  invalidateCache();
  return rows.length > 0;
}

export async function ensureGeminiKeysTable(): Promise<void> {
  try {
    const sql = getMasterSQL();
    await sql`
      CREATE TABLE IF NOT EXISTS gemini_api_keys (
        id SERIAL PRIMARY KEY,
        key_name TEXT UNIQUE NOT NULL,
        api_key TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
  } catch (err) {
    console.error('[KeyPool] Failed to ensure table:', err);
  }
}
