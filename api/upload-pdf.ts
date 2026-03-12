/**
 * Upload PDF to R2 for backup.
 * Accepts multipart form with:
 *   - pdfFile: the PDF blob
 *   - fileName: desired file name (e.g. BA_WASTE_20260312.pdf)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseForm, fileToBuffer } from './_lib/parse-form.js';
import { uploadToR2 } from './_lib/r2.js';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { fields, files } = await parseForm(req);
    const fileName = fields.fileName || `BA_WASTE_${Date.now()}.pdf`;

    const pdfFile = files.pdfFile;
    if (!pdfFile || Array.isArray(pdfFile) || pdfFile.size === 0) {
      return res.status(400).json({ success: false, message: 'PDF file is required' });
    }

    const { buffer, type } = await fileToBuffer(pdfFile);
    const tenantId = extractTenantId(req);
    const tenantCreds = await resolveTenantCredentials(tenantId);

    const url = await uploadToR2(
      buffer,
      fileName,
      type || 'application/pdf',
      'waste-management/pdf-backup',
      {
        accountId: tenantCreds.r2AccountId,
        accessKeyId: tenantCreds.r2AccessKeyId,
        secretAccessKey: tenantCreds.r2SecretAccessKey,
        bucketName: tenantCreds.r2BucketName,
        publicUrl: tenantCreds.r2PublicUrl,
      }
    );

    res.json({ success: true, url, fileName });
  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Gagal upload PDF ke R2',
    });
  }
}
