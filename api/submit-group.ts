import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseForm, fileToBuffer } from './lib/parse-form.js';
import { uploadToR2 } from './lib/r2.js';
import { appendGroupToGoogleSheets } from './lib/google-sheets.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { fields, files } = await parseForm(req);

    const tanggal = fields.tanggal;
    const kategoriInduk = fields.kategoriInduk;
    const itemsCount = parseInt(fields.itemsCount) || 0;

    const processedItems: any[] = [];

    for (let i = 0; i < itemsCount; i++) {
      const itemData: any = {
        tanggal,
        kategoriInduk,
        namaProduk: fields[`items[${i}].namaProduk`] || '',
        kodeProduk: fields[`items[${i}].kodeProduk`] || '',
        jumlahProduk: parseInt(fields[`items[${i}].jumlahProduk`]) || 0,
        unit: fields[`items[${i}].unit`] || '',
        metodePemusnahan: fields[`items[${i}].metodePemusnahan`] || '',
        alasanPemusnahan: fields[`items[${i}].alasanPemusnahan`] || '',
        jamTanggalPemusnahan: fields[`items[${i}].jamTanggalPemusnahan`] || '',
        parafQCUrl: '',
        parafManagerUrl: '',
        dokumentasiUrl: '',
      };

      // Upload paraf QC
      const qcFile = files[`items[${i}].parafQC`];
      if (qcFile && !Array.isArray(qcFile) && qcFile.size > 0) {
        try {
          const { buffer, name, type } = await fileToBuffer(qcFile);
          itemData.parafQCUrl = await uploadToR2(buffer, name, type, 'waste-management/paraf-qc');
        } catch (e) { console.error(`QC upload error item ${i}:`, e); }
      }

      // Upload paraf Manager
      const mgrFile = files[`items[${i}].parafManager`];
      if (mgrFile && !Array.isArray(mgrFile) && mgrFile.size > 0) {
        try {
          const { buffer, name, type } = await fileToBuffer(mgrFile);
          itemData.parafManagerUrl = await uploadToR2(buffer, name, type, 'waste-management/paraf-manager');
        } catch (e) { console.error(`Manager upload error item ${i}:`, e); }
      }

      // Upload dokumentasi
      const docFile = files[`items[${i}].dokumentasi`];
      if (docFile && !Array.isArray(docFile) && docFile.size > 0) {
        try {
          const { buffer, name, type } = await fileToBuffer(docFile);
          itemData.dokumentasiUrl = await uploadToR2(buffer, name, type, 'waste-management/dokumentasi');
        } catch (e) { console.error(`Docs upload error item ${i}:`, e); }
      }

      processedItems.push(itemData);
    }

    // Submit to Google Sheets
    const { GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SPREADSHEET_ID } = process.env;
    if (GOOGLE_SHEETS_CREDENTIALS && GOOGLE_SPREADSHEET_ID && processedItems.length > 0) {
      try {
        await appendGroupToGoogleSheets(GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SPREADSHEET_ID, tanggal, kategoriInduk, processedItems);
      } catch (e) { console.error('Google Sheets error:', e); }
    }

    res.json({
      success: true,
      message: `Data grup ${kategoriInduk} berhasil disimpan`,
      data: { kategoriInduk, itemsProcessed: processedItems.length, totalItems: itemsCount },
    });
  } catch (error) {
    console.error('Submit-group error:', error);
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan grup data' });
  }
}
