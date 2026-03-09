import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Token error: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// Parse tab name "DD/MM/YY" to Date
function parseTabToDate(tab: string): Date | null {
  const match = tab.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
}

// Format Date to tab name
function dateToTab(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear().toString().slice(-2);
  return `${day}/${month}/${year}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { startDate, endDate } = req.query;

  try {
    const { GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SPREADSHEET_ID } = process.env;
    if (!GOOGLE_SHEETS_CREDENTIALS || !GOOGLE_SPREADSHEET_ID) {
      return res.status(500).json({ error: 'Missing config' });
    }

    const credentials = JSON.parse(GOOGLE_SHEETS_CREDENTIALS);
    const accessToken = await getAccessToken(credentials);

    // 1. Get all sheet tabs
    const spreadsheet = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SPREADSHEET_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).then(r => r.json()) as any;

    const allTabs = (spreadsheet.sheets || [])
      .map((s: any) => s.properties?.title)
      .filter((t: string) => /^\d{2}\/\d{2}\/\d{2}$/.test(t))
      .sort((a: string, b: string) => {
        const da = parseTabToDate(a);
        const db = parseTabToDate(b);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      });

    // 2. Filter tabs by date range
    let filteredTabs = allTabs;
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      filteredTabs = allTabs.filter((tab: string) => {
        const d = parseTabToDate(tab);
        return d && d >= start && d <= end;
      });
    }

    // 3. Fetch data from each tab (batch read)
    const dailyData: any[] = [];
    const stationTotals: Record<string, number> = {};
    const shiftTotals: Record<string, number> = {};
    const productCounts: Record<string, { count: number; qty: number }> = {};
    let totalItems = 0;
    let totalQty = 0;

    // Fetch in batches of 5 to avoid rate limit
    for (let i = 0; i < filteredTabs.length; i += 5) {
      const batch = filteredTabs.slice(i, i + 5);
      const ranges = batch.map((tab: string) => `${encodeURIComponent(tab)}!A2:V1000`).join('&ranges=');
      
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SPREADSHEET_ID}/values:batchGet?ranges=${ranges}&valueRenderOption=UNFORMATTED_VALUE`;
      const batchRes = await fetch(batchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(r => r.json()) as any;

      const valueRanges = batchRes.valueRanges || [];

      for (let j = 0; j < batch.length; j++) {
        const tab = batch[j];
        const rows = valueRanges[j]?.values || [];
        const tabDate = parseTabToDate(tab);
        
        let dayItems = 0;
        let dayQty = 0;
        const dayStations: Record<string, number> = {};
        const dayShifts: Record<string, number> = {};

        for (const row of rows) {
          const shift = (row[0] || '').toString().toUpperCase();
          const station = (row[2] || '').toString().toUpperCase();
          const productName = (row[3] || '').toString();
          const qtyStr = (row[5] || '').toString();

          // Skip empty rows or category headers
          if (!productName || !station) continue;

          // Handle multiline values (grouped entries)
          const products = productName.split('\n').filter((p: string) => p.trim());
          const quantities = qtyStr.split('\n').filter((q: string) => q.trim());

          for (let k = 0; k < products.length; k++) {
            const pName = products[k].trim().toUpperCase();
            const qty = parseFloat(quantities[k]) || 1;
            
            totalItems++;
            totalQty += qty;
            dayItems++;
            dayQty += qty;

            // Station totals
            if (station) {
              stationTotals[station] = (stationTotals[station] || 0) + qty;
              dayStations[station] = (dayStations[station] || 0) + qty;
            }

            // Shift totals
            if (shift) {
              shiftTotals[shift] = (shiftTotals[shift] || 0) + qty;
              dayShifts[shift] = (dayShifts[shift] || 0) + qty;
            }

            // Product counts
            if (pName) {
              if (!productCounts[pName]) productCounts[pName] = { count: 0, qty: 0 };
              productCounts[pName].count++;
              productCounts[pName].qty += qty;
            }
          }
        }

        dailyData.push({
          date: tabDate?.toISOString().split('T')[0] || tab,
          tab,
          items: dayItems,
          qty: dayQty,
          stations: dayStations,
          shifts: dayShifts,
        });
      }
    }

    // Sort daily data by date
    dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Top 10 products
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));

    return res.json({
      success: true,
      availableDates: allTabs,
      summary: {
        totalDays: filteredTabs.length,
        totalItems,
        totalQty,
        avgItemsPerDay: filteredTabs.length ? Math.round(totalItems / filteredTabs.length) : 0,
        avgQtyPerDay: filteredTabs.length ? Math.round(totalQty / filteredTabs.length) : 0,
      },
      dailyData,
      stationTotals,
      shiftTotals,
      topProducts,
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}
