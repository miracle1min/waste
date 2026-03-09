import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseForm, fileToBuffer } from './_lib/parse-form.js';
import { uploadToR2 } from './_lib/r2.js';
import { appendGroupedToGoogleSheets } from './_lib/google-sheets.js';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';
import { logActivity, getClientIP } from './_lib/activity-logger.js';

export const config = { api: { bodyParser: false } };

// BUG-013 fix: Safe JSON parse with error handling
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

    const productList = safeJsonParse(fields.productList);
    const kodeProdukList = safeJsonParse(fields.kodeProdukList);
    const jumlahProdukList = safeJsonParse(fields.jumlahProdukList);
    const unitList = safeJsonParse(fields.unitList);
    const metodePemusnahanList = safeJsonParse(fields.metodePemusnahanList);
    const alasanPemusnahanList = safeJsonParse(fields.alasanPemusnahanList);

    // BUG-025 fix: Validate required fields
    if (!fields.tanggal) {
      return res.status(400).json({ success: false, message: 'Tanggal wajib diisi!' });
    }
    if (!fields.kategoriInduk) {
      return res.status(400).json({ success: false, message: 'Kategori/Station wajib diisi!' });
    }
    if (productList.length === 0) {
      return res.status(400).json({ success: false, message: 'Minimal 1 produk harus diisi!' });
    }

    const shift = (fields.shift || 'OPENING').toUpperCase();
    const storeName = (fields.storeName || 'BEKASI KP. BULU').toUpperCase();

    // Force all string data to UPPERCASE for consistency
    const toUpper = (v: any) => v != null ? String(v).toUpperCase() : '';
    const mapUpper = (arr: any[]) => arr.map((v: any) => typeof v === 'string' ? v.toUpperCase() : v);

    const data = {
      tanggal: fields.tanggal,
      kategoriInduk: toUpper(fields.kategoriInduk),
      productList: mapUpper(productList),
      kodeProdukList: mapUpper(kodeProdukList),
      jumlahProdukList: jumlahProdukList.map((qty: any) => typeof qty === 'string' ? parseInt(qty) || 1 : qty),
      unitList: mapUpper(unitList),
      metodePemusnahanList: mapUpper(metodePemusnahanList),
      alasanPemusnahanList: mapUpper(alasanPemusnahanList),
      jamTanggalPemusnahan: fields.jamTanggalPemusnahan,
      jamTanggalPemusnahanList: fields.jamTanggalPemusnahanList ? safeJsonParse(fields.jamTanggalPemusnahanList) : null,
    };

    const imageUrls: Record<string, string> = {};
    const warnings: string[] = [];

    // Upload paraf QC — BUG-015 fix: Track upload failures
    const tenantId = extractTenantId(req);
    const tenantCreds = await resolveTenantCredentials(tenantId);
    const qcFile = files.parafQC;
    if (qcFile && !Array.isArray(qcFile) && qcFile.size > 0) {
      try {
        const { buffer, name, type } = await fileToBuffer(qcFile);
        imageUrls.parafQC = await uploadToR2(buffer, name, type, 'waste-management/paraf-qc', {
          accountId: tenantCreds.r2AccountId, accessKeyId: tenantCreds.r2AccessKeyId,
          secretAccessKey: tenantCreds.r2SecretAccessKey, bucketName: tenantCreds.r2BucketName, publicUrl: tenantCreds.r2PublicUrl
        });
      } catch (e) {
        console.error('QC upload error:', e);
        warnings.push('Gagal upload paraf QC');
      }
    }

    // Upload paraf Manager — BUG-021 fix: Pass tenant credentials (was using default)
    const mgrFile = files.parafManager;
    if (mgrFile && !Array.isArray(mgrFile) && mgrFile.size > 0) {
      try {
        const { buffer, name, type } = await fileToBuffer(mgrFile);
        imageUrls.parafManager = await uploadToR2(buffer, name, type, 'waste-management/paraf-manager', {
          accountId: tenantCreds.r2AccountId, accessKeyId: tenantCreds.r2AccessKeyId,
          secretAccessKey: tenantCreds.r2SecretAccessKey, bucketName: tenantCreds.r2BucketName, publicUrl: tenantCreds.r2PublicUrl
        });
      } catch (e) {
        console.error('Manager upload error:', e);
        warnings.push('Gagal upload paraf Manager');
      }
    }

    // Upload multiple dokumentasi files
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
    if (dokumentasiUrls.length > 0) imageUrls.dokumentasi = dokumentasiUrls.join('\n');

    // Submit to Google Sheets — BUG-014 fix: Don't silently swallow errors
    const creds = tenantCreds;
    if (creds.googleSheetsCredentials && creds.googleSpreadsheetId) {
      await appendGroupedToGoogleSheets(creds.googleSheetsCredentials, creds.googleSpreadsheetId, data, imageUrls, shift, storeName);
    } else {
      return res.status(500).json({ success: false, message: 'Google Sheets belum dikonfigurasi untuk tenant ini.' });
    }

    // Log waste submission
    logActivity({
      action: "SUBMIT_WASTE",
      category: "waste",
      username: storeName,
      tenantId: extractTenantId(req) || "",
      tenantName: storeName,
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"] || "",
      details: {
        station: data.kategoriInduk,
        shift,
        date: data.tanggal,
        itemCount: productList.length,
        photoCount: imageUrls.filter(Boolean).length,
      },
      status: "success",
    });

    const response: any = { success: true, message: `Data kategori ${data.kategoriInduk} berhasil disimpan`, data };
    // BUG-015 fix: Report warnings for failed uploads
    if (warnings.length > 0) {
      response.warnings = warnings;
      response.message += ` (⚠️ ${warnings.length} file gagal diupload)`;
    }

    res.json(response);
  } catch (error) {
    console.error('Submit-grouped error:', error);
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan data' });
  }
}
