import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';
import crypto from 'crypto';

// Reuse JWT auth from google-sheets lib
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

  const { date, shift, station } = req.query;
  if (!date || !shift || !station) {
    return res.status(400).json({ error: 'Missing date, shift, or station parameter' });
  }

  try {
    const tenantId = extractTenantId(req);
    const tenantCreds = await resolveTenantCredentials(tenantId);
    if (!tenantCreds.googleCredentials || !tenantCreds.googleSpreadsheetId) {
      return res.status(500).json({ error: 'Missing Google Sheets config' });
    }

    const credentials = JSON.parse(tenantCreds.googleCredentials);
    const accessToken = await getAccessToken(credentials);
    const tabName = formatDateToTab(date as string);

    // Try to read the tab data
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${tenantCreds.googleSpreadsheetId}/values/${encodeURIComponent(tabName)}!A:C`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      // Tab doesn't exist = no duplicate
      return res.json({ isDuplicate: false });
    }

    const data = (await response.json()) as { values?: string[][] };
    const rows = data.values || [];

    // Check if any row has matching SHIFT (col A) and STATION (col C)
    const isDuplicate = rows.some(row => 
      row[0]?.toUpperCase() === (shift as string).toUpperCase() && 
      row[2]?.toUpperCase() === (station as string).toUpperCase()
    );

    return res.json({ isDuplicate });
  } catch (error) {
    console.error('Check duplicate error:', error);
    return res.json({ isDuplicate: false }); // Don't block submit on error
  }
}
