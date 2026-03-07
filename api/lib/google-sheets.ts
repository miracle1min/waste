/**
 * Google Sheets integration using fetch + JWT (Node.js compatible).
 * Uses crypto module for JWT signing — works natively on Vercel Node runtime.
 */
import crypto from 'crypto';

// ===== JWT Auth =====

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createJWT(credentials: { client_email: string; private_key: string }): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${tokenResponse.status} - ${errorText}`);
  }

  const data = (await tokenResponse.json()) as { access_token: string };
  return data.access_token;
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
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
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

    // Write header values
    await sheetsRequest(
      accessToken,
      `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:V1?valueInputOption=RAW`,
      'PUT',
      { values: [HEADERS] }
    );

    // Format header row: Bold, centered, dark background with white text, freeze row
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
        }
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

function buildDokumentasiColumns(dokumentasiUrl: string): string[] {
  const urls = dokumentasiUrl ? dokumentasiUrl.split('\n').filter((u: string) => u.trim()) : [];
  return Array.from({ length: 10 }, (_, i) =>
    i < urls.length ? `=IMAGE("${urls[i].trim()}"; 4; 90; 90)` : ''
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

export async function appendToGoogleSheets(
  credentialsString: string, spreadsheetId: string, data: any, imageUrls: any
): Promise<void> {
  const credentials = JSON.parse(credentialsString);
  const accessToken = await getAccessToken(credentials);
  const tabName = formatWIBForSheetTab(data.tanggal);
  await ensureSheetTab(accessToken, spreadsheetId, tabName);

  const dokumentasiCols = buildDokumentasiColumns(imageUrls.dokumentasi || '');
  const rowData = [
    data.kategoriInduk,
    data.namaProduk,
    data.kodeProduk,
    data.jumlahProduk,
    data.unit,
    data.metodePemusnahan,
    data.alasanPemusnahan || '',
    data.jamTanggalPemusnahan,
    imageUrls.parafQC ? `=IMAGE("${imageUrls.parafQC}"; 4; 90; 90)` : '',
    imageUrls.parafManager ? `=IMAGE("${imageUrls.parafManager}"; 4; 90; 90)` : '',
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
  const categoryHeaderRow = [kategoriInduk.toUpperCase(), ...Array(19).fill('')];

  const itemRows = items.map((item: any) => {
    const dokumentasiCols = buildDokumentasiColumns(item.dokumentasiUrl || '');
    return [
      '',
      item.namaProduk.toUpperCase(),
      item.kodeProduk.toUpperCase(),
      item.jumlahProduk,
      item.unit.toUpperCase(),
      item.metodePemusnahan.toUpperCase(),
      item.alasanPemusnahan || '',
      item.jamTanggalPemusnahan,
      item.parafQCUrl ? `=IMAGE("${item.parafQCUrl}"; 4; 90; 90)` : '❌ Tidak ada',
      item.parafManagerUrl ? `=IMAGE("${item.parafManagerUrl}"; 4; 90; 90)` : '❌ Tidak ada',
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

  const productNames = data.productList.join('\n').toUpperCase();
  const productCodes = data.kodeProdukList.join('\n').toUpperCase();
  const quantities = data.jumlahProdukList.join('\n');
  const units = data.unitList.join('\n').toUpperCase();
  const methods = data.metodePemusnahanList.join('\n').toUpperCase();
  const reasons = data.alasanPemusnahanList.join('\n');

  const dokumentasiCols = buildDokumentasiColumns(imageUrls.dokumentasi || '');
  const categoryRow = [
    (shift || 'OPENING').toUpperCase(),
    (storeName || 'BEKASI KP. BULU').toUpperCase(),
    data.kategoriInduk.toUpperCase(),
    productNames, productCodes, quantities, units, methods, reasons,
    data.jamTanggalPemusnahan,
    imageUrls.parafQC ? `=IMAGE("${imageUrls.parafQC}"; 4; 90; 90)` : '❌ Tidak ada',
    imageUrls.parafManager ? `=IMAGE("${imageUrls.parafManager}"; 4; 90; 90)` : '❌ Tidak ada',
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
