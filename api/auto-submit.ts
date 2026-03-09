import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseForm, fileToBuffer } from './_lib/parse-form.js';
import { uploadToR2 } from './_lib/r2.js';
import { appendGroupedToGoogleSheets } from './_lib/google-sheets.js';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';

export const config = { api: { bodyParser: false } };

/**
 * Auto-submit API for Waste Otomatis.
 * Accepts parsed waste data with pre-existing signature URLs (from R2 master signatures).
 * Documentation photos are uploaded as multipart files.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { fields, files } = await parseForm(req);

    const tanggal = fields.tanggal;
    const kategoriInduk = fields.kategoriInduk;
    const shift = fields.shift || 'OPENING';
    const storeName = fields.storeName || 'BEKASI KP. BULU';

    // Pre-existing signature URLs from R2 (not uploaded files)
    const parafQCUrl = fields.parafQCUrl || '';
    const parafManagerUrl = fields.parafManagerUrl || '';

    // Parse item lists from JSON
    const productList = JSON.parse(fields.productList || '[]');
    const kodeProdukList = JSON.parse(fields.kodeProdukList || '[]');
    const jumlahProdukList = JSON.parse(fields.jumlahProdukList || '[]');
    const unitList = JSON.parse(fields.unitList || '[]');
    const metodePemusnahanList = JSON.parse(fields.metodePemusnahanList || '[]');
    const alasanPemusnahanList = JSON.parse(fields.alasanPemusnahanList || '[]');
    const jamTanggalPemusnahanList = fields.jamTanggalPemusnahanList 
      ? JSON.parse(fields.jamTanggalPemusnahanList) 
      : null;

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

    // Upload documentation photos
    const dokumentasiUrls: string[] = [];
    for (let i = 0; i < 10; i++) {
      const file = files[`dokumentasi_${i}`];
      if (file && !Array.isArray(file) && file.size > 0) {
        try {
          const { buffer, name, type } = await fileToBuffer(file);
          const url = await uploadToR2(buffer, name, type, 'waste-management/dokumentasi');
          dokumentasiUrls.push(url);
        } catch (e) { console.error(`Docs upload error ${i}:`, e); }
      }
    }
    const singleDoc = files.dokumentasi;
    if (singleDoc && !Array.isArray(singleDoc) && singleDoc.size > 0) {
      try {
        const { buffer, name, type } = await fileToBuffer(singleDoc);
        const url = await uploadToR2(buffer, name, type, 'waste-management/dokumentasi');
        dokumentasiUrls.push(url);
      } catch (e) { console.error('Single docs upload error:', e); }
    }
    if (dokumentasiUrls.length > 0) {
      imageUrls.dokumentasi = dokumentasiUrls.join('\n');
    }

    // Submit to Google Sheets (multi-tenant)
    const tenantId = extractTenantId(req);
    const creds = await resolveTenantCredentials(tenantId);
    if (creds.googleSheetsCredentials && creds.googleSpreadsheetId) {
      try {
        await appendGroupedToGoogleSheets(creds.googleSheetsCredentials, creds.googleSpreadsheetId, data, imageUrls, shift, storeName);
      } catch (e) {
        console.error('Google Sheets error:', e);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan ke Google Sheets: ' + (e instanceof Error ? e.message : String(e)) });
      }
    } else {
      return res.status(500).json({ success: false, message: 'Google Sheets credentials not configured' });
    }

    res.json({
      success: true,
      message: `Data auto-waste ${kategoriInduk} berhasil disimpan`,
      data: {
        kategoriInduk,
        itemsProcessed: productList.length,
        shift,
        storeName,
      },
    });
  } catch (error) {
    console.error('Auto-submit error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan data auto-waste',
    });
  }
}
