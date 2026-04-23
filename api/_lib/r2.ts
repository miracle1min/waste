/**
 * Cloudflare R2 upload helper — sekarang support tenant-specific credentials.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

// FIX #38: Cache S3Client per credential set to avoid creating new client per upload
const clientCache = new Map<string, S3Client>();

function createR2Client(creds: R2Credentials): S3Client {
  const cacheKey = `${creds.accountId}:${creds.accessKeyId}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;
  
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${creds.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey },
  });
  clientCache.set(cacheKey, client);
  return client;
}

function getDefaultR2Credentials(): R2Credentials {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured.');
  }
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName: process.env.R2_BUCKET_NAME || 'ba-waste',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  };
}

/**
 * Upload file ke R2. Kalau r2Creds dikasih, pakai credentials tenant itu.
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string,
  r2Creds?: Partial<R2Credentials>
): Promise<string> {
  const defaults = getDefaultR2Credentials();
  const creds: R2Credentials = {
    accountId: r2Creds?.accountId || defaults.accountId,
    accessKeyId: r2Creds?.accessKeyId || defaults.accessKeyId,
    secretAccessKey: r2Creds?.secretAccessKey || defaults.secretAccessKey,
    bucketName: r2Creds?.bucketName || defaults.bucketName,
    publicUrl: r2Creds?.publicUrl || defaults.publicUrl,
  };

  if (!creds.publicUrl) {
    throw new Error('R2_PUBLIC_URL not configured.');
  }

  const client = createR2Client(creds);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${folder}/${timestamp}-${random}-${safeName}`;

  await client.send(new PutObjectCommand({
    Bucket: creds.bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  }));

  const baseUrl = creds.publicUrl.replace(/\/$/, '');
  return `${baseUrl}/${key}`;
}
