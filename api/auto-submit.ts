import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { parseForm, fileToBuffer } from './_lib/parse-form.js';
import { buildBlobProxyUrl, getRequestOrigin, uploadToBlob } from './_lib/blob.js';
import { appendGroupedToGoogleSheets, appendTesterToGoogleSheets } from './_lib/google-sheets.js';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';
import { requireAuth, getAuthorizedTenantId, handleAuthError } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { sendWhatsAppNotif } from './_lib/twilio-wa.js';

export const config = { api: { bodyParser: false } };

// SEC-FIX: Allowed MIME types for file uploads
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
]);
const ALLOWED_PDF_TYPES = new Set(['application/pdf']);

function isAllowedImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(mimeType.toLowerCase());
}

function isAllowedPdfType(mimeType: string): boolean {
  return ALLOWED_PDF_TYPES.has(mimeType.toLowerCase());
}

// BUG-013 fix: Safe JSON parse
function safeJsonParse(input: string | undefined, fallback: any[] = []): any[] {
  if (!input) return fallback;
  try {
    return JSON.parse(input);
  } catch {
    throw new Error(`Format data tidak valid: "${input.substring(0, 50)}..."`);
  }
}

function formatDateToSheetTab(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y.slice(-2)}`;
}

type UploadKind = 'dokumentasi' | 'pdf';

function getUploadConfig(kind: UploadKind): {
  maxSize: number;
  allowedContentTypes: string[];
} {
  if (kind === 'pdf') {
    return {
      maxSize: 25 * 1024 * 1024,
      allowedContentTypes: ['application/pdf'],
    };
  }

  return {
    maxSize: 5 * 1024 * 1024,
    allowedContentTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  };
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/** Get production origin for Sheets — replaces localhost in dev mode */
function getSheetsOrigin(req: VercelRequest): string {
  const origin = getRequestOrigin(req);
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return process.env.PUBLIC_URL || `https://${(req.headers.host as string)?.replace(/:.*$/, '') || 'gacoanku.my.id'}`;
    }
  } catch {}
  return origin;
}

/** Rewrite localhost proxy URLs to production domain for Sheets persistence */
function resolveProxyOrigin(url: string, sheetsOrigin: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return url.replace(parsed.origin, sheetsOrigin.replace(/\/$/, ''));
    }
  } catch {}
  return url;
}

async function readJsonBody<T>(req: VercelRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bodyText = '';

    // Try express rawBody first (vercel dev sometimes pre-parses)
    if ((req as any).rawBody) {
      bodyText = (req as any).rawBody.toString('utf8');
    } else if ((req as any).body && typeof (req as any).body === 'object') {
      // Already parsed by middleware
      return resolve((req as any).body as T);
    }

    if (bodyText) {
      try { return resolve(JSON.parse(bodyText) as T); }
      catch { reject(new Error(`Format data tidak valid: "${bodyText.substring(0, 50)}..."`)); }
      return;
    }

    let streamEnded = false;
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      streamEnded = true;
      bodyText = Buffer.concat(chunks).toString('utf8');
      if (!bodyText) {
        return reject(new Error('Payload upload kosong.'));
      }
      try { resolve(JSON.parse(bodyText) as T); }
      catch { reject(new Error(`Format data tidak valid: "${bodyText.substring(0, 50)}..."`)); }
    });
    req.on('error', (err) => reject(err));
    // Timeout safeguard
    setTimeout(() => {
      if (!streamEnded) {
        reject(new Error('Timeout membaca request body.'));
      }
    }, 15000);
  });
}

function parseClientPayload(clientPayload: string | null): { kind: UploadKind; tenantId: string } {
  if (!clientPayload) {
    throw new Error('clientPayload wajib diisi.');
  }

  const payload = JSON.parse(clientPayload) as { kind?: UploadKind; tenantId?: string };
  if (!payload.kind || !payload.tenantId) {
    throw new Error('Payload upload tidak lengkap.');
  }
  if (!['dokumentasi', 'pdf'].includes(payload.kind)) {
    throw new Error('Jenis upload tidak didukung.');
  }
  return { kind: payload.kind, tenantId: payload.tenantId };
}

function assertAuthorizedPath(pathname: string, tenantId: string, kind: UploadKind) {
  const expectedPrefix =
    kind === 'pdf'
      ? `${sanitizeSegment(tenantId)}/pdf-reports/`
      : `${sanitizeSegment(tenantId)}/waste-management/dokumentasi/`;

  if (!pathname.startsWith(expectedPrefix)) {
    throw new Error('Path upload tidak valid.');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  if (checkRateLimit(req, res, { name: "auto-submit", maxRequests: 30, windowSeconds: 60 })) return;

  try {
    if (req.query.mode === 'blob-upload') {
      const body = await readJsonBody<HandleUploadBody>(req);
      let jwtPayload = null;

      if (body.type === 'blob.generate-client-token') {
        try {
          jwtPayload = requireAuth(req);
        } catch (err) {
          return handleAuthError(err, res);
        }
      }

      const result = await handleUpload({
        request: req,
        body,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          if (!jwtPayload) {
            throw new Error('Unauthorized');
          }

          const authorizedTenantId = getAuthorizedTenantId(req, jwtPayload);
          const payload = parseClientPayload(clientPayload);

          if (payload.tenantId !== authorizedTenantId) {
            throw new Error('Tenant upload tidak sesuai.');
          }

          assertAuthorizedPath(pathname, authorizedTenantId, payload.kind);
          const config = getUploadConfig(payload.kind);

          return {
            allowedContentTypes: config.allowedContentTypes,
            maximumSizeInBytes: config.maxSize,
            addRandomSuffix: false,
            tokenPayload: JSON.stringify(payload),
          };
        },
        onUploadCompleted: async () => {},
      });

      return res.status(200).json(result);
    }

    const { fields, files } = await parseForm(req);
    const origin = getRequestOrigin(req);
    const sheetsOrigin = getSheetsOrigin(req);

    // === PDF Backup Mode ===
    // SEC-FIX: Require authentication for all modes
    let jwtPayload;
    try {
      jwtPayload = requireAuth(req);
    } catch (err) {
      return handleAuthError(err, res);
    }

    if (fields.mode === 'upload-pdf') {
      const tenantId = getAuthorizedTenantId(req, jwtPayload);
      const pdfFile = files.pdfFile;
      const fileName = fields.fileName || `report_${Date.now()}.pdf`;

      if (!pdfFile) {
        return res.status(400).json({ success: false, message: 'No PDF file provided' });
      }
      if (Array.isArray(pdfFile)) {
        return res.status(400).json({ success: false, message: 'Only one PDF file is allowed' });
      }

      const { buffer, type: pdfMimeType } = await fileToBuffer(pdfFile);
      // SEC-FIX: Validate PDF file type
      if (!isAllowedPdfType(pdfMimeType)) {
        return res.status(400).json({ success: false, message: 'Only PDF files are allowed for upload-pdf mode' });
      }
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const folder = `${tenantId}/pdf-reports`;
      const privateUrl = await uploadToBlob(buffer, safeFileName, 'application/pdf', folder);
      const url = buildBlobProxyUrl(privateUrl, sheetsOrigin);
      const key = `${folder}/${safeFileName}`;

      return res.json({ success: true, url, key, fileName });
    }

    // === Single Photo Upload Mode ===
    if (fields.mode === 'upload-photo') {
      const tenantId = getAuthorizedTenantId(req, jwtPayload);
      const photoFile = files.photo;

      if (!photoFile || Array.isArray(photoFile) || photoFile.size === 0) {
        return res.status(400).json({ success: false, message: 'No photo file provided' });
      }

      const { buffer, name, type } = await fileToBuffer(photoFile);
      // SEC-FIX: Validate image file type
      if (!isAllowedImageType(type)) {
        return res.status(400).json({ success: false, message: `File type "${type}" not allowed. Use JPEG, PNG, WebP, or GIF.` });
      }
      // SEC-FIX: Sanitize folder path to prevent path traversal
      const rawFolder = fields.folder || 'waste-management/dokumentasi';
      const folder = `${tenantId}/${rawFolder.replace(/\.\./g, '').replace(/^\/+/, '')}`;
      const privateUrl = await uploadToBlob(buffer, name, type, folder);
      const url = buildBlobProxyUrl(privateUrl, sheetsOrigin);

      return res.json({ success: true, url });
    }

    // === Combined WhatsApp Notification Mode ===
    if (fields.mode === 'send-wa-notif') {
      try {
        const stations = JSON.parse(fields.stations || '[]');
        const testerData = fields.testerAllOk !== undefined ? {
          allOk: fields.testerAllOk === 'true',
          items: safeJsonParse(fields.testerItems || '[]'),
          kendala: fields.testerKendala || '',
        } : undefined;
        await sendWhatsAppNotif({
          storeName: fields.storeName || 'Unknown',
          shift: fields.shift || '',
          tanggal: fields.tanggal || '',
          submittedBy: jwtPayload?.displayName && jwtPayload.displayName !== jwtPayload.username
            ? `${jwtPayload.displayName} (${jwtPayload.username})`
            : jwtPayload?.username || 'Unknown',
          stations,
          tester: testerData,
        });
        return res.json({ success: true, message: 'Notification sent' });
      } catch (err) {
        console.error('[WA Notif] Failed:', err);
        return res.json({ success: true, message: 'Notification failed but ok' });
      }
    }

    // === Submit Tester Mode ===
    if (fields.mode === 'submit-tester') {
      const testerItems = safeJsonParse(fields.testerItems);
      const testerAllOk = fields.testerAllOk === 'true';
      const testerKendala = fields.testerKendala || '';
      const tanggal = fields.tanggal;
      const toUpperLocal = (v: any) => v != null ? String(v).toUpperCase() : '';
      const shift = toUpperLocal(fields.shift || 'OPENING');
      const storeName = toUpperLocal(fields.storeName || 'BEKASI KP. BULU');
      const jam = fields.jam || '';

      const resultText = testerAllOk
        ? 'Semua sisa bahan dan produk AMAN & Approved.'
        : testerKendala;

      if (!tanggal) {
        return res.status(400).json({ success: false, message: 'Tanggal wajib diisi!' });
      }

      const tenantId = getAuthorizedTenantId(req, jwtPayload);
      const tenantCreds = await resolveTenantCredentials(tenantId);
      const targetTab = formatDateToSheetTab(tanggal);

      if (!tenantCreds.googleSheetsCredentials || !tenantCreds.googleSpreadsheetId) {
        return res.status(500).json({ success: false, message: 'Google Sheets credentials not configured' });
      }

      // Parse pre-uploaded documentation URLs for tester
      const testerDokumentasiUrls: string[] = [];
      if (fields.dokumentasiUrls) {
        try {
          const parsed = JSON.parse(fields.dokumentasiUrls);
          if (Array.isArray(parsed)) testerDokumentasiUrls.push(...parsed);
        } catch {}
      }

      console.log('[auto-submit][tester] append start', {
        tenantId,
        tanggal,
        targetTab,
        shift,
        storeName,
        testerItemsCount: testerItems.length,
      });

      await appendTesterToGoogleSheets(
        tenantCreds.googleSheetsCredentials,
        tenantCreds.googleSpreadsheetId,
        {
          tanggal,
          shift,
          storeName,
          testerItems,
          testerAllOk,
          resultText,
          jam,
          parafQCUrl: fields.parafQCUrl || '',
          parafManagerUrl: fields.parafManagerUrl || '',
          dokumentasiUrls: testerDokumentasiUrls,
        }
      );

      console.log('[auto-submit][tester] append success', {
        tenantId,
        tanggal,
        targetTab,
        shift,
        storeName,
        testerItemsCount: testerItems.length,
      });

      return res.json({ success: true, message: 'Tester berhasil disimpan', targetTab });
    }

    // Force all string data to UPPERCASE for consistency
    const toUpper = (v: any) => v != null ? String(v).toUpperCase() : '';

    const tanggal = fields.tanggal;
    const kategoriInduk = toUpper(fields.kategoriInduk);
    const shift = toUpper(fields.shift || 'OPENING');
    const storeName = toUpper(fields.storeName || 'BEKASI KP. BULU');

    // BUG-025 fix: Validate required fields
    if (!tanggal) {
      return res.status(400).json({ success: false, message: 'Tanggal wajib diisi!' });
    }
    if (!kategoriInduk) {
      return res.status(400).json({ success: false, message: 'Kategori/Station wajib diisi!' });
    }

    const parafQCUrl = fields.parafQCUrl || '';
    const parafManagerUrl = fields.parafManagerUrl || '';

    const mapUpper = (arr: any[]) => arr.map((v: any) => typeof v === 'string' ? v.toUpperCase() : v);
    const productList = mapUpper(safeJsonParse(fields.productList));
    const kodeProdukList = mapUpper(safeJsonParse(fields.kodeProdukList));
    const jumlahProdukList = safeJsonParse(fields.jumlahProdukList);
    const unitList = mapUpper(safeJsonParse(fields.unitList));
    const metodePemusnahanList = mapUpper(safeJsonParse(fields.metodePemusnahanList));
    const alasanPemusnahanList = mapUpper(safeJsonParse(fields.alasanPemusnahanList));
    const jamTanggalPemusnahanList = fields.jamTanggalPemusnahanList
      ? safeJsonParse(fields.jamTanggalPemusnahanList)
      : null;

    if (productList.length === 0) {
      return res.status(400).json({ success: false, message: 'Minimal 1 produk harus diisi!' });
    }

    const data = {
      tanggal,
      kategoriInduk,
      productList,
      kodeProdukList,
      jumlahProdukList: jumlahProdukList.map((qty: any) => typeof qty === 'string' ? parseInt(qty) || 1 : qty),
      unitList,
      metodePemusnahanList,
      alasanPemusnahanList,
      jamTanggalPemusnahan: fields.jamTanggalPemusnahan || '',
      jamTanggalPemusnahanList,
    };

    const imageUrls: Record<string, string> = {
      parafQC: parafQCUrl,
      parafManager: parafManagerUrl,
    };

    const warnings: string[] = [];
    const tenantId = getAuthorizedTenantId(req, jwtPayload);
    const tenantCreds = await resolveTenantCredentials(tenantId);
    const targetTab = formatDateToSheetTab(tanggal);

    // Upload documentation photos — BUG-015 fix: Track failures
    const dokumentasiUrls: string[] = [];
    for (let i = 0; i < 10; i++) {
      const file = files[`dokumentasi_${i}`];
      if (file && !Array.isArray(file) && file.size > 0) {
        try {
          const { buffer, name, type } = await fileToBuffer(file);
          const privateUrl = await uploadToBlob(buffer, name, type, `${tenantId}/waste-management/dokumentasi`);
          dokumentasiUrls.push(buildBlobProxyUrl(privateUrl, sheetsOrigin));
        } catch (e) {
          console.error(`Docs upload error ${i}:`, e);
          warnings.push(`Gagal upload dokumentasi ${i + 1}`);
        }
      }
    }
    const singleDoc = files.dokumentasi;
    if (singleDoc && !Array.isArray(singleDoc) && singleDoc.size > 0) {
      try {
        const { buffer, name, type } = await fileToBuffer(singleDoc);
        const privateUrl = await uploadToBlob(buffer, name, type, `${tenantId}/waste-management/dokumentasi`);
        dokumentasiUrls.push(buildBlobProxyUrl(privateUrl, sheetsOrigin));
      } catch (e) {
        console.error('Single docs upload error:', e);
        warnings.push('Gagal upload dokumentasi');
      }
    }
    // Support pre-uploaded dokumentasi URLs
    // SEC-FIX: Validate URLs to prevent injection of javascript: or data: URIs
    if (fields.dokumentasiUrls) {
      try {
        const preUploadedUrls = JSON.parse(fields.dokumentasiUrls);
        if (Array.isArray(preUploadedUrls)) {
          const safeUrls = preUploadedUrls.filter((u: unknown) =>
            typeof u === 'string' && /^https?:\/\//.test(u)
          );
          dokumentasiUrls.push(...safeUrls.map((u: string) => resolveProxyOrigin(u, sheetsOrigin)));
        }
      } catch {}
    }
    if (dokumentasiUrls.length > 0) {
      imageUrls.dokumentasi = dokumentasiUrls.join('\n');
    }

    // Submit to Google Sheets — BUG-033 fix: Properly propagate errors (already handled)
    const creds = tenantCreds;
    if (creds.googleSheetsCredentials && creds.googleSpreadsheetId) {
      console.log('[auto-submit] append start', {
        tenantId,
        tanggal,
        targetTab,
        shift,
        storeName,
        kategoriInduk,
        itemsProcessed: productList.length,
      });
      await appendGroupedToGoogleSheets(creds.googleSheetsCredentials, creds.googleSpreadsheetId, data, imageUrls, shift, storeName);
      console.log('[auto-submit] append success', {
        tenantId,
        tanggal,
        targetTab,
        shift,
        storeName,
        kategoriInduk,
        itemsProcessed: productList.length,
      });
    } else {
      return res.status(500).json({ success: false, message: 'Google Sheets credentials not configured' });
    }

    const response: any = {
      success: true,
      message: `Data auto-waste ${kategoriInduk} berhasil disimpan`,
      data: { kategoriInduk, itemsProcessed: productList.length, shift, storeName, targetTab },
    };
    if (warnings.length > 0) {
      response.warnings = warnings;
      response.message += ` (⚠️ ${warnings.length} file gagal diupload)`;
    }

    res.json(response);
  } catch (error) {
    console.error('Auto-submit error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan data auto-waste',
    });
  }
}
