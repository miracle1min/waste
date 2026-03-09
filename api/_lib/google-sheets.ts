/**
 * Google Sheets integration using fetch + JWT (Node.js compatible).
 * BUG-030 fix: Centralized auth functions — exported for reuse.
 */
import crypto from 'crypto';

// ===== JWT Auth (EXPORTED — BUG-030 fix) =====

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createGoogleJWT(credentials: { client_email: string; private_key: string }, scope: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: credentials.client_email,
    scope,
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

/**
 * Get Google access token. Exported for reuse by other API files.
 * BUG-030 fix: Single source of truth for auth.
 * @param scope - 'readwrite' (default) or 'readonly'
 */
export async function getGoogleAccessToken(
  credentials: { client_email: string; private_key: string },
  scope: 'readwrite' | 'readonly' = 'readwrite'
): Promise<string> {
  const scopeUrl = scope === 'readonly'
    ? 'https://www.googleapis.com/auth/spreadsheets.readonly'
    : 'https://www.googleapis.com/auth/spreadsheets';

  const jwt = createGoogleJWT(credentials, scopeUrl);

  // BUG-031 fix: Add timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${tokenResponse.status} - ${errorText}`);
  }

  const data = (await tokenResponse.json()) as { access_token: string };
  return data.access_token;
}

// Keep backward compat alias (internal use)
async function getAccessToken(credentials: { client_email: string; private_key: string }): Promise<string> {
  return getGoogleAccessToken(credentials, 'readwrite');
}

// ===== Sheets API Helpers =====

const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

const HEADERS = [
  'SHIFT', 'STORE', 'STATION', 'NAMA PRODUK', 'KODE PRODUK', 'JUMLAH PRODUK', 'UNIT',
  'METODE PEMUSNAHAN', 'ALASAN PEMUSNAHAN', 'JAM & TGL PEMUSNAHAN',
  'PARAF QC', 'PARAF MANAJER', 'DOKUMENTASI 1', 'DOKUMENTASI 2', 'DOKUMENTASI 3',
  'DOKUMENTASI 4', 'DOKUMENTASI 5', 'DOKUMENTASI 6', 'DOKUMENTASI 7',
  'DOKUMENTASI 8', 'DOKUMENTASI 9', 'DOKUMENTASI 10'
];

async function sheetsRequest(accessToken: string, url: string, method = 'GET', body?: any): Promise<any> {
  // BUG-031 fix: Add timeout to all sheets requests
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${errorText}`);
  }
  return response.json();
}

async function ensureSheetTab(accessToken: string, spreadsheetId: string, tabName: string): Promise<void> {
  const spreadsheet = await sheetsRequest(accessToken, `${SHEETS_BASE_URL}/${spreadsheetId}`);
  const sheetExists = spreadsheet.sheets?.some((sheet: any) => sheet.properties?.title === tabName);

  if (!sheetExists) {
    const addSheetResponse = await sheetsRequest(accessToken, `${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, 'POST', {
      requests: [{ addSheet: { properties: { title: tabName } } }]
    });
    const newSheetId = addSheetResponse.replies?.[0]?.addSheet?.properties?.sheetId || 0;

    await sheetsRequest(
      accessToken,
      `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:V1?valueInputOption=RAW`,
      'PUT',
      { values: [HEADERS] }
    );

    await sheetsRequest(accessToken, `${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, 'POST', {
      requests: [
        {
          repeatCell: {
            range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 22 },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
                wrapStrategy: 'WRAP'
              }
            },
            fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment,backgroundColor,wrapStrategy)'
          }
        },
        {
          updateSheetProperties: {
            properties: { sheetId: newSheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount'
          }
        },
        {
          updateDimensionProperties: {
            range: { sheetId: newSheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 40 },
            fields: 'pixelSize'
          }
        },
        ...[
          { start: 0, end: 1, size: 100 },
          { start: 1, end: 2, size: 180 },
          { start: 2, end: 3, size: 120 },
          { start: 3, end: 4, size: 200 },
          { start: 4, end: 5, size: 130 },
          { start: 5, end: 6, size: 100 },
          { start: 6, end: 7, size: 80 },
          { start: 7, end: 8, size: 180 },
          { start: 8, end: 9, size: 160 },
          { start: 9, end: 10, size: 160 },
          { start: 10, end: 11, size: 100 },
          { start: 11, end: 12, size: 100 },
          { start: 12, end: 22, size: 100 },
        ].map(col => ({
          updateDimensionProperties: {
            range: { sheetId: newSheetId, dimension: 'COLUMNS', startIndex: col.start, endIndex: col.end },
            properties: { pixelSize: col.size },
            fields: 'pixelSize'
          }
        }))
      ]
    });
  }
}

async function getRowCount(accessToken: string, spreadsheetId: string, tabName: string): Promise<number> {
  try {
    const response = await sheetsRequest(accessToken, `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:A`);
    return (response.values || []).length;
  } catch {
    return 1;
  }
}

async function getSheetId(accessToken: string, spreadsheetId: string, tabName: string): Promise<number> {
  const spreadsheet = await sheetsRequest(accessToken, `${SHEETS_BASE_URL}/${spreadsheetId}`);
  const sheet = spreadsheet.sheets?.find((s: any) => s.properties?.title === tabName);
  return sheet?.properties?.sheetId || 0;
}

// BUG-032 fix: Sanitize URLs before embedding in IMAGE formulas
function sanitizeUrlForFormula(url: string): string {
  // Remove any double quotes and potentially dangerous characters
  return url.replace(/["\\]/g, '').trim();
}

function buildImageFormula(url: string): string {
  if (!url) return '';
  const safeUrl = sanitizeUrlForFormula(url);
  if (!safeUrl) return '';
  return `=IMAGE("${safeUrl}"; 4; 90; 90)`;
}

// Helper: safely uppercase any string value
function toUpper(val: any): string {
  if (val == null) return '';
  return String(val).toUpperCase();
}

function buildDokumentasiColumns(dokumentasiUrl: string): string[] {
  const urls = dokumentasiUrl ? dokumentasiUrl.split('\n').filter((u: string) => u.trim()) : [];
  return Array.from({ length: 10 }, (_, i) =>
    i < urls.length ? buildImageFormula(urls[i].trim()) : ''
  );
}

function formatWIBForSheetTab(date?: Date | string): string {
  let targetDate: Date;
  if (date) {
    targetDate = typeof date === 'string' ? new Date(date) : date;
  } else {
    targetDate = new Date();
  }
  const day = targetDate.getDate().toString().padStart(2, '0');
  const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
  const year = targetDate.getFullYear().toString().slice(-2);
  return `${day}/${month}/${year}`;
}

// ===== Public API =====

function formatJamForStorage(datetimeLocal: string): string {
  if (!datetimeLocal || datetimeLocal === '-') return '-';
  const match = datetimeLocal.match(/T(\d{2}:\d{2})/);
  if (match) return `${match[1]} WIB`;
  if (datetimeLocal.includes('WIB')) return datetimeLocal;
  if (/^\d{2}:\d{2}/.test(datetimeLocal)) return `${datetimeLocal.substring(0,5)} WIB`;
  return datetimeLocal;
}

// BUG-023 fix: Added SHIFT and STORE columns to appendToGoogleSheets
export async function appendToGoogleSheets(
  credentialsString: string, spreadsheetId: string, data: any, imageUrls: any, shift?: string, storeName?: string
): Promise<void> {
  const credentials = JSON.parse(credentialsString);
  const accessToken = await getAccessToken(credentials);
  const tabName = formatWIBForSheetTab(data.tanggal);
  await ensureSheetTab(accessToken, spreadsheetId, tabName);

  const dokumentasiCols = buildDokumentasiColumns(imageUrls.dokumentasi || '');
  const rowData = [
    toUpper(shift || 'OPENING'),
    toUpper(storeName),
    toUpper(data.kategoriInduk),
    toUpper(data.namaProduk),
    toUpper(data.kodeProduk),
    data.jumlahProduk,
    toUpper(data.unit),
    toUpper(data.metodePemusnahan),
    toUpper(data.alasanPemusnahan),
    (data.jamTanggalPemusnahanList
      ? data.jamTanggalPemusnahanList.map((j: string) => formatJamForStorage(j)).join('\n')
      : formatJamForStorage(data.jamTanggalPemusnahan)),
    buildImageFormula(imageUrls.parafQC || ''),
    buildImageFormula(imageUrls.parafManager || ''),
    ...dokumentasiCols
  ];

  await sheetsRequest(
    accessToken,
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:V:append?valueInputOption=USER_ENTERED`,
    'POST',
    { values: [rowData] }
  );
}

export async function appendGroupToGoogleSheets(
  credentialsString: string, spreadsheetId: string, tanggal: string, kategoriInduk: string, items: any[]
): Promise<void> {
  const credentials = JSON.parse(credentialsString);
  const accessToken = await getAccessToken(credentials);
  const tabName = formatWIBForSheetTab(tanggal);
  await ensureSheetTab(accessToken, spreadsheetId, tabName);

  const rowNumber = await getRowCount(accessToken, spreadsheetId, tabName);
  const categoryHeaderRow = [toUpper(kategoriInduk), ...Array(21).fill('')];

  const itemRows = items.map((item: any) => {
    const dokumentasiCols = buildDokumentasiColumns(item.dokumentasiUrl || '');
    return [
      '',
      '',
      '',
      toUpper(item.namaProduk),
      toUpper(item.kodeProduk),
      item.jumlahProduk,
      toUpper(item.unit),
      toUpper(item.metodePemusnahan),
      toUpper(item.alasanPemusnahan),
      formatJamForStorage(item.jamTanggalPemusnahan),
      buildImageFormula(item.parafQCUrl || ''),
      buildImageFormula(item.parafManagerUrl || ''),
      ...dokumentasiCols
    ];
  });

  await sheetsRequest(
    accessToken,
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:V:append?valueInputOption=USER_ENTERED`,
    'POST',
    { values: [categoryHeaderRow, ...itemRows] }
  );

  const sheetId = await getSheetId(accessToken, spreadsheetId, tabName);
  await sheetsRequest(accessToken, `${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, 'POST', {
    requests: [
      {
        repeatCell: {
          range: { sheetId, startRowIndex: rowNumber, endRowIndex: rowNumber + 1, startColumnIndex: 0, endColumnIndex: 22 },
          cell: { userEnteredFormat: { textFormat: { bold: true }, horizontalAlignment: 'CENTER' } },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment)'
        }
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: rowNumber + 1, endRowIndex: rowNumber + 1 + items.length, startColumnIndex: 0, endColumnIndex: 11 },
          cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
          fields: 'userEnteredFormat(horizontalAlignment)'
        }
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowNumber + 1, endIndex: rowNumber + 1 + items.length },
          properties: { pixelSize: 100 },
          fields: 'pixelSize'
        }
      }
    ]
  });
}

export async function appendGroupedToGoogleSheets(
  credentialsString: string, spreadsheetId: string, data: any, imageUrls: any, shift?: string, storeName?: string
): Promise<void> {
  const credentials = JSON.parse(credentialsString);
  const accessToken = await getAccessToken(credentials);
  const tabName = formatWIBForSheetTab(data.tanggal);
  await ensureSheetTab(accessToken, spreadsheetId, tabName);

  const rowNumber = await getRowCount(accessToken, spreadsheetId, tabName);

  const productNames = data.productList.map((v: string) => toUpper(v)).join('\n');
  const productCodes = data.kodeProdukList.map((v: string) => toUpper(v)).join('\n');
  const quantities = data.jumlahProdukList.join('\n');
  const units = data.unitList.map((v: string) => toUpper(v)).join('\n');
  const methods = data.metodePemusnahanList.map((v: string) => toUpper(v)).join('\n');
  const reasons = data.alasanPemusnahanList.map((v: string) => toUpper(v)).join('\n');

  const dokumentasiCols = buildDokumentasiColumns(imageUrls.dokumentasi || '');
  const categoryRow = [
    toUpper(shift || 'OPENING'),
    toUpper(storeName || 'BEKASI KP. BULU'),
    toUpper(data.kategoriInduk),
    productNames, productCodes, quantities, units, methods, reasons,
    formatJamForStorage(data.jamTanggalPemusnahan),
    buildImageFormula(imageUrls.parafQC || ''),
    buildImageFormula(imageUrls.parafManager || ''),
    ...dokumentasiCols
  ];

  await sheetsRequest(
    accessToken,
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:V:append?valueInputOption=USER_ENTERED`,
    'POST',
    { values: [categoryRow] }
  );

  const sheetId = await getSheetId(accessToken, spreadsheetId, tabName);
  await sheetsRequest(accessToken, `${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, 'POST', {
    requests: [
      {
        repeatCell: {
          range: { sheetId, startRowIndex: rowNumber, endRowIndex: rowNumber + 1, startColumnIndex: 0, endColumnIndex: 22 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              wrapStrategy: 'WRAP'
            }
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
        }
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowNumber, endIndex: rowNumber + 1 },
          properties: { pixelSize: 100 },
          fields: 'pixelSize'
        }
      }
    ]
  });
}
