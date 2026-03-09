/**
 * Multipart form data parser for Vercel serverless functions.
 * Uses formidable to parse incoming requests.
 */
import formidable from 'formidable';
import type { IncomingMessage } from 'http';
import fs from 'fs';

export interface ParsedForm {
  fields: Record<string, string>;
  files: Record<string, formidable.File | formidable.File[]>;
}

export async function parseForm(req: IncomingMessage): Promise<ParsedForm> {
  const form = formidable({ multiples: true, maxFileSize: 50 * 1024 * 1024 });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);

      // Normalize fields: formidable v3 returns arrays
      const normalizedFields: Record<string, string> = {};
      for (const [key, value] of Object.entries(fields)) {
        normalizedFields[key] = Array.isArray(value) ? (value[0] as string) || '' : String(value || '');
      }

      // Normalize files
      const normalizedFiles: Record<string, formidable.File | formidable.File[]> = {};
      for (const [key, value] of Object.entries(files)) {
        if (Array.isArray(value) && value.length === 1) {
          normalizedFiles[key] = value[0];
        } else {
          normalizedFiles[key] = value as formidable.File | formidable.File[];
        }
      }

      resolve({ fields: normalizedFields, files: normalizedFiles });
    });
  });
}

export async function fileToBuffer(file: formidable.File): Promise<{ buffer: Buffer; name: string; type: string }> {
  const buffer = await fs.promises.readFile(file.filepath);
  return {
    buffer,
    name: file.originalFilename || 'upload',
    type: file.mimetype || 'application/octet-stream',
  };
}
