import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createJWT(credentials: { client_email: string; private_key: string }): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaimSet = base64url(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = base64url(sign.sign(credentials.private_key));
  return `${signatureInput}.${signature}`;
}

async function getAccessToken(credentials: { client_email: string; private_key: string }): Promise<string> {
  const jwt = createJWT(credentials);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!tokenResponse.ok) throw new Error(`Token error: ${tokenResponse.status}`);
  const data = (await tokenResponse.json()) as { access_token: string };
  return data.access_token;
}

function formatDateToTab(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear().toString().slice(-2);
  return `${day}/${month}/${year}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'Missing date parameter' });
  }

  try {
    const { GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SPREADSHEET_ID } = process.env;
    if (!GOOGLE_SHEETS_CREDENTIALS || !GOOGLE_SPREADSHEET_ID) {
      return res.status(500).json({ error: 'Missing Google Sheets config' });
    }

    const credentials = JSON.parse(GOOGLE_SHEETS_CREDENTIALS);
    const accessToken = await getAccessToken(credentials);
    const tabName = formatDateToTab(date as string);

    // Read all data from the tab
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SPREADSHEET_ID}/values/${encodeURIComponent(tabName)}!A:V?valueRenderOption=FORMULA`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return res.json({ success: true, data: [], storeName: '', date: date });
    }

    const sheetData = (await response.json()) as { values?: string[][] };
    const rows = sheetData.values || [];

    // Skip header row
    const dataRows = rows.slice(1);

    // Parse rows into structured data
    // Columns: SHIFT(0) | STORE(1) | STATION(2) | NAMA PRODUK(3) | KODE PRODUK(4) | JUMLAH(5) | UNIT(6) | METODE(7) | ALASAN(8) | JAM(9) | QC(10) | MANAJER(11) | DOK1-10(12-21)
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

    // Get store name from first entry
    const storeName = entries.find(e => e.store)?.store || 'BEKASI KP. BULU';

    // Group by shift
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
  } catch (error) {
    console.error('Get day data error:', error);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
}
