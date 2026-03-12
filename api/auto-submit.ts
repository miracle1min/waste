import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseForm, fileToBuffer } from './_lib/parse-form.js';
import { uploadToR2 } from './_lib/r2.js';
import { appendGroupedToGoogleSheets } from './_lib/google-sheets.js';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';

export const config = { api: { bodyParser: false } };

// BUG-013 fix: Safe JSON parse
function safeJsonParse(input: string | undefined, fallback: any[] = []): any[] {
  if (!input) return fallback;
  try {
    return JSON.parse(input);
  } catch {
    throw new Error(`Format data tidak valid: "${input.substring(0, 50)}..."`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { fields, files } = await parseForm(req);

    // === PDF Backup Mode ===
    if (fields.mode === 'upload-pdf') {
      const tenantId = extractTenantId(req);
      const pdfFile = files.pdfFile;
      const fileName = fields.fileName || `report_${Date.now()}.pdf`;

      if (!pdfFile) {
        return res.status(400).json({ success: false, message: 'No PDF file provided' });
      }

      const buffer = await fileToBuffer(pdfFile);
      const key = `${tenantId}/pdf-reports/${fileName}`;
      const url = await uploadToR2(buffer, key, 'application/pdf');

      return res.json({ success: true, url, key, fileName });
    }

    // === Single Photo Upload Mode ===
    if (fields.mode === 'upload-photo') {
      const tenantId = extractTenantId(req);
      const tenantCreds = await resolveTenantCredentials(tenantId);
      const photoFile = files.photo;

      if (!photoFile || Array.isArray(photoFile) || photoFile.size === 0) {
        return res.status(400).json({ success: false, message: 'No photo file provided' });
      }

      const { buffer, name, type } = await fileToBuffer(photoFile);
      const folder = fields.folder || 'waste-management/dokumentasi';
      const url = await uploadToR2(buffer, name, type, folder, {
        accountId: tenantCreds.r2AccountId, accessKeyId: tenantCreds.r2AccessKeyId,
        secretAccessKey: tenantCreds.r2SecretAccessKey, bucketName: tenantCreds.r2BucketName, publicUrl: tenantCreds.r2PublicUrl
      });

      return res.json({ success: true, url });
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
    const tenantId = extractTenantId(req);
    const tenantCreds = await resolveTenantCredentials(tenantId);

    // Upload documentation photos — BUG-015 fix: Track failures
    const dokumentasiUrls: string[] = [];
    for (let i = 0; i < 10; i++) {
      const file = files[`dokumentasi_${i}`];
      if (file && !Array.isArray(file) && file.size > 0) {
        try {
          const { buffer, name, type } = await fileToBuffer(file);
          const url = await uploadToR2(buffer, name, type, 'waste-management/dokumentasi', {
            accountId: tenantCreds.r2AccountId, accessKeyId: tenantCreds.r2AccessKeyId,
            secretAccessKey: tenantCreds.r2SecretAccessKey, bucketName: tenantCreds.r2BucketName, publicUrl: tenantCreds.r2PublicUrl
          });
          dokumentasiUrls.push(url);
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
        const url = await uploadToR2(buffer, name, type, 'waste-management/dokumentasi', {
          accountId: tenantCreds.r2AccountId, accessKeyId: tenantCreds.r2AccessKeyId,
          secretAccessKey: tenantCreds.r2SecretAccessKey, bucketName: tenantCreds.r2BucketName, publicUrl: tenantCreds.r2PublicUrl
        });
        dokumentasiUrls.push(url);
      } catch (e) {
        console.error('Single docs upload error:', e);
        warnings.push('Gagal upload dokumentasi');
      }
    }
    // Support pre-uploaded dokumentasi URLs
    if (fields.dokumentasiUrls) {
      try {
        const preUploadedUrls = JSON.parse(fields.dokumentasiUrls);
        if (Array.isArray(preUploadedUrls)) {
          dokumentasiUrls.push(...preUploadedUrls);
        }
      } catch {}
    }
    if (dokumentasiUrls.length > 0) {
      imageUrls.dokumentasi = dokumentasiUrls.join('\n');
    }

    // Submit to Google Sheets — BUG-033 fix: Properly propagate errors (already handled)
    const creds = tenantCreds;
    if (creds.googleSheetsCredentials && creds.googleSpreadsheetId) {
      await appendGroupedToGoogleSheets(creds.googleSheetsCredentials, creds.googleSpreadsheetId, data, imageUrls, shift, storeName);
    } else {
      return res.status(500).json({ success: false, message: 'Google Sheets credentials not configured' });
    }

    const response: any = {
      success: true,
      message: `Data auto-waste ${kategoriInduk} berhasil disimpan`,
      data: { kategoriInduk, itemsProcessed: productList.length, shift, storeName },
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
