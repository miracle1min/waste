import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';
import { getGoogleAccessToken } from './_lib/google-sheets.js';

// BUG-016 fix: Parse date string manually instead of relying on new Date() timezone
function formatDateToTab(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    // Fallback for unexpected format
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

  const { date, shift, station } = req.query;
  if (!date || !shift || !station) {
    return res.status(400).json({ error: 'Missing date, shift, or station parameter' });
  }

  try {
    const tenantId = extractTenantId(req);
    const tenantCreds = await resolveTenantCredentials(tenantId);
    if (!tenantCreds.googleSheetsCredentials || !tenantCreds.googleSpreadsheetId) {
      return res.status(500).json({ error: 'Missing Google Sheets config' });
    }

    const credentials = JSON.parse(tenantCreds.googleSheetsCredentials);
    // BUG-030 fix: Use shared auth function instead of duplicated code
    const accessToken = await getGoogleAccessToken(credentials, 'readonly');
    const tabName = formatDateToTab(date as string);

    // BUG-031 fix: Add timeout
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
