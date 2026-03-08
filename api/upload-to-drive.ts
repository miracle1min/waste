import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// ============================================================
// Google Drive Upload API Endpoint
// Receives a base64-encoded PDF and uploads it to Google Drive
// ============================================================

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createJWT(credentials: { client_email: string; private_key: string }, scopes: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: credentials.client_email,
    scope: scopes,
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
  const jwt = createJWT(credentials, 'https://www.googleapis.com/auth/drive.file');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Token error: ${tokenResponse.status} - ${errText}`);
  }
  const data = (await tokenResponse.json()) as { access_token: string };
  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileName, pdfBase64 } = req.body as { fileName?: string; pdfBase64?: string };

    if (!fileName || !pdfBase64) {
      return res.status(400).json({ error: 'Missing fileName or pdfBase64 in request body' });
    }

    const { GOOGLE_SHEETS_CREDENTIALS, GOOGLE_DRIVE_FOLDER_ID } = process.env;

    if (!GOOGLE_SHEETS_CREDENTIALS) {
      return res.status(500).json({ error: 'Missing GOOGLE_SHEETS_CREDENTIALS' });
    }
    if (!GOOGLE_DRIVE_FOLDER_ID) {
      return res.status(500).json({ error: 'Missing GOOGLE_DRIVE_FOLDER_ID. Set this env var to the Google Drive folder ID.' });
    }

    const credentials = JSON.parse(GOOGLE_SHEETS_CREDENTIALS);
    const accessToken = await getAccessToken(credentials);

    // Convert base64 to Buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Build multipart upload request for Google Drive API
    const metadata = {
      name: fileName,
      mimeType: 'application/pdf',
      parents: [GOOGLE_DRIVE_FOLDER_ID],
    };

    const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');

    const metadataPart = 
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n`;

    const filePart = 
      `--${boundary}\r\n` +
      `Content-Type: application/pdf\r\n\r\n`;

    const ending = `\r\n--${boundary}--`;

    // Combine parts into a single buffer
    const bodyParts = Buffer.concat([
      Buffer.from(metadataPart, 'utf-8'),
      Buffer.from(filePart, 'utf-8'),
      pdfBuffer,
      Buffer.from(ending, 'utf-8'),
    ]);

    // Upload to Google Drive
    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': bodyParts.length.toString(),
        },
        body: bodyParts,
      }
    );

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.error('Google Drive upload error:', errText);
      return res.status(500).json({ error: 'Failed to upload to Google Drive', details: errText });
    }

    const uploadResult = (await uploadResponse.json()) as { id: string; name: string; webViewLink?: string };

    // Make the file accessible via link (optional - anyone with link can view)
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploadResult.id}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });
    } catch (permErr) {
      // Non-critical: file is still uploaded, just not publicly accessible
      console.warn('Could not set file permissions:', permErr);
    }

    // Get the web view link
    const fileInfoResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${uploadResult.id}?fields=webViewLink,webContentLink`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );
    const fileInfo = (await fileInfoResponse.json()) as { webViewLink?: string; webContentLink?: string };

    return res.json({
      success: true,
      fileId: uploadResult.id,
      fileName: uploadResult.name,
      webViewLink: fileInfo.webViewLink || `https://drive.google.com/file/d/${uploadResult.id}/view`,
      webContentLink: fileInfo.webContentLink || null,
      message: `PDF berhasil dibackup ke Google Drive!`,
    });

  } catch (error) {
    console.error('Upload to Drive error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Internal server error', details: errMsg });
  }
}
