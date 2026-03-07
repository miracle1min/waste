import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseForm, fileToBuffer } from './lib/parse-form.js';
import { uploadToCloudinary } from './lib/cloudinary.js';
import { appendToGoogleSheets } from './lib/google-sheets.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { fields, files } = await parseForm(req);

    const data = {
      tanggal: fields.tanggal?.trim() || '',
      kategoriInduk: fields.kategoriInduk?.trim() || 'NOODLE',
      namaProduk: fields.namaProduk?.trim() || '',
      kodeProduk: fields.kodeProduk?.trim() || '',
      jumlahProduk: parseInt(fields.jumlahProduk, 10) || 1,
      unit: fields.unit?.trim() || '',
      metodePemusnahan: fields.metodePemusnahan?.trim() || '',
      alasanPemusnahan: fields.alasanPemusnahan?.trim() || '',
      jamTanggalPemusnahan: fields.jamTanggalPemusnahan?.trim() || '',
    };

    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    const imageUrls: Record<string, string> = {};

    // Upload paraf QC
    const parafQCFile = files.parafQC;
    if (parafQCFile && !Array.isArray(parafQCFile) && parafQCFile.size > 0) {
      const { buffer, name, type } = await fileToBuffer(parafQCFile);
      imageUrls.parafQC = await uploadToCloudinary(buffer, name, type, 'waste-management/paraf-qc', CLOUDINARY_CLOUD_NAME!, CLOUDINARY_API_KEY!, CLOUDINARY_API_SECRET!);
    }

    // Upload paraf Manager
    const parafManagerFile = files.parafManager;
    if (parafManagerFile && !Array.isArray(parafManagerFile) && parafManagerFile.size > 0) {
      const { buffer, name, type } = await fileToBuffer(parafManagerFile);
      imageUrls.parafManager = await uploadToCloudinary(buffer, name, type, 'waste-management/paraf-manager', CLOUDINARY_CLOUD_NAME!, CLOUDINARY_API_KEY!, CLOUDINARY_API_SECRET!);
    }

    // Upload dokumentasi
    const dokumentasiFile = files.dokumentasi;
    if (dokumentasiFile && !Array.isArray(dokumentasiFile) && dokumentasiFile.size > 0) {
      const { buffer, name, type } = await fileToBuffer(dokumentasiFile);
      imageUrls.dokumentasi = await uploadToCloudinary(buffer, name, type, 'waste-management/dokumentasi', CLOUDINARY_CLOUD_NAME!, CLOUDINARY_API_KEY!, CLOUDINARY_API_SECRET!);
    }

    // Submit to Google Sheets
    const { GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SPREADSHEET_ID } = process.env;
    if (GOOGLE_SHEETS_CREDENTIALS && GOOGLE_SPREADSHEET_ID) {
      try {
        await appendToGoogleSheets(GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SPREADSHEET_ID, data, imageUrls);
      } catch (e) { console.error('Google Sheets error:', e); }
    }

    res.json({ success: true, message: 'Data berhasil disimpan', data });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan data' });
  }
}
