import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseForm, fileToBuffer } from './lib/parse-form.js';
import { uploadToR2 } from './lib/r2.js';
import { appendGroupedToGoogleSheets } from './lib/google-sheets.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { fields, files } = await parseForm(req);

    const productList = JSON.parse(fields.productList || '[]');
    const kodeProdukList = JSON.parse(fields.kodeProdukList || '[]');
    const jumlahProdukList = JSON.parse(fields.jumlahProdukList || '[]');
    const unitList = JSON.parse(fields.unitList || '[]');
    const metodePemusnahanList = JSON.parse(fields.metodePemusnahanList || '[]');
    const alasanPemusnahanList = JSON.parse(fields.alasanPemusnahanList || '[]');

    const shift = fields.shift || 'OPENING';
    const storeName = fields.storeName || 'BEKASI KP. BULU';

    const data = {
      tanggal: fields.tanggal,
      kategoriInduk: fields.kategoriInduk,
      productList,
      kodeProdukList,
      jumlahProdukList: jumlahProdukList.map((qty: any) => typeof qty === 'string' ? parseInt(qty) || 1 : qty),
      unitList,
      metodePemusnahanList,
      alasanPemusnahanList,
      jamTanggalPemusnahan: fields.jamTanggalPemusnahan,
    };

    const imageUrls: Record<string, string> = {};

    // Upload paraf QC
    const qcFile = files.parafQC;
    if (qcFile && !Array.isArray(qcFile) && qcFile.size > 0) {
      try {
        const { buffer, name, type } = await fileToBuffer(qcFile);
        imageUrls.parafQC = await uploadToR2(buffer, name, type, 'waste-management/paraf-qc');
      } catch (e) { console.error('QC upload error:', e); }
    }

    // Upload paraf Manager
    const mgrFile = files.parafManager;
    if (mgrFile && !Array.isArray(mgrFile) && mgrFile.size > 0) {
      try {
        const { buffer, name, type } = await fileToBuffer(mgrFile);
        imageUrls.parafManager = await uploadToR2(buffer, name, type, 'waste-management/paraf-manager');
      } catch (e) { console.error('Manager upload error:', e); }
    }

    // Upload multiple dokumentasi files
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
    // Also check non-indexed
    const singleDoc = files.dokumentasi;
    if (singleDoc && !Array.isArray(singleDoc) && singleDoc.size > 0) {
      try {
        const { buffer, name, type } = await fileToBuffer(singleDoc);
        const url = await uploadToR2(buffer, name, type, 'waste-management/dokumentasi');
        dokumentasiUrls.push(url);
      } catch (e) { console.error('Single docs upload error:', e); }
    }
    if (dokumentasiUrls.length > 0) imageUrls.dokumentasi = dokumentasiUrls.join('\n');

    // Submit to Google Sheets
    const { GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SPREADSHEET_ID } = process.env;
    if (GOOGLE_SHEETS_CREDENTIALS && GOOGLE_SPREADSHEET_ID) {
      try {
        await appendGroupedToGoogleSheets(GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SPREADSHEET_ID, data, imageUrls, shift, storeName);
      } catch (e) { console.error('Google Sheets error:', e); }
    }

    res.json({ success: true, message: `Data kategori ${data.kategoriInduk} berhasil disimpan`, data });
  } catch (error) {
    console.error('Submit-grouped error:', error);
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan data' });
  }
}
