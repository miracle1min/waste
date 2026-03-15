import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';
import { getGoogleAccessToken } from './_lib/google-sheets.js';

// BUG-016 fix: Parse date string manually
function formatDateToTab(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    const d = new Date(dateStr);
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = d.getUTCFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  }
  const [y, m, d] = parts;
  return `${d}/${m}/${y.slice(-2)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // If shift and station params present, handle as check-duplicate
  const { date, shift, station } = req.query;
  if (date && shift && station) {
    return handleCheckDuplicate(req, res);
  }

  if (!date) {
    return res.status(400).json({ error: 'Missing date parameter' });
  }

  try {
    const tenantId = extractTenantId(req);
    const tenantCreds = await resolveTenantCredentials(tenantId);

    if (!tenantCreds.googleSheetsCredentials || !tenantCreds.googleSpreadsheetId) {
      return res.status(500).json({ error: 'Google Sheets belum di-setting buat resto ini' });
    }

    const credentials = JSON.parse(tenantCreds.googleSheetsCredentials);
    const SPREADSHEET_ID = tenantCreds.googleSpreadsheetId;
    // BUG-030 fix: Use shared auth function
    const accessToken = await getGoogleAccessToken(credentials, 'readonly');
    const tabName = formatDateToTab(date as string);

    // BUG-031 fix: Add timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(tabName)}!A:V?valueRenderOption=FORMULA`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.json({ success: true, data: [], storeName: '', date: date, grouped: {} });
    }

    const sheetData = (await response.json()) as { values?: string[][] };
    const rows = sheetData.values || [];
    const dataRows = rows.slice(1);

    const entries = dataRows.map(row => ({
      shift: row[0] || '',
      store: row[1] || '',
      station: row[2] || '',
      namaProduk: row[3] || '',
      kodeProduk: row[4] || '',
      jumlahProduk: row[5] || '',
      unit: row[6] || '',
      metodePemusnahan: row[7] || '',
      alasanPemusnahan: row[8] || '',
      jamTanggalPemusnahan: row[9] || '',
      parafQC: row[10] || '',
      parafManager: row[11] || '',
      dokumentasi: Array.from({ length: 10 }, (_, i) => row[12 + i] || '').filter(d => d),
    }));

    const storeName = entries.find(e => e.store)?.store || '';

    const shifts = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT'];
    const grouped: Record<string, typeof entries> = {};
    shifts.forEach(s => { grouped[s] = []; });

    entries.forEach(entry => {
      const shift = entry.shift.toUpperCase();
      if (grouped[shift]) {
        grouped[shift].push(entry);
      } else if (shift) {
        grouped[shift] = [entry];
      }
    });

    return res.json({
      success: true,
      date: date,
      tabName: tabName,
      storeName: storeName,
      grouped: grouped,
      raw: entries,
    });
  } catch (error: any) {
    console.error('Get day data error:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout' });
    }
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
}

// === CHECK DUPLICATE HANDLER (merged from check-duplicate.ts) ===
async function handleCheckDuplicate(req: VercelRequest, res: VercelResponse) {
  const { date, shift, station } = req.query;

  try {
    const tenantId = extractTenantId(req);
    const tenantCreds = await resolveTenantCredentials(tenantId);
    if (!tenantCreds.googleSheetsCredentials || !tenantCreds.googleSpreadsheetId) {
      return res.status(500).json({ error: 'Missing Google Sheets config' });
    }

    const credentials = JSON.parse(tenantCreds.googleSheetsCredentials);
    const accessToken = await getGoogleAccessToken(credentials, 'readonly');
    const tabName = formatDateToTab(date as string);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${tenantCreds.googleSpreadsheetId}/values/${encodeURIComponent(tabName)}!A:C`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.json({ isDuplicate: false });
    }

    const data = (await response.json()) as { values?: string[][] };
    const rows = data.values || [];

    const isDuplicate = rows.some(row =>
      row[0]?.toUpperCase() === (shift as string).toUpperCase() &&
      row[2]?.toUpperCase() === (station as string).toUpperCase()
    );

    return res.json({ isDuplicate });
  } catch (error) {
    console.error('Check duplicate error:', error);
    return res.json({ isDuplicate: false });
  }
}
