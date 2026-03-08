import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Allow Cloudinary URLs and R2 URLs for security
  const isCloudinary = url.includes('res.cloudinary.com');
  const isR2 = url.includes('.r2.dev') || url.includes('.r2.cloudflarestorage.com');
  
  if (!isCloudinary && !isR2) {
    return res.status(403).json({ error: 'Only Cloudinary and R2 URLs are allowed' });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';

    return res.json({
      success: true,
      dataUrl: `data:${contentType};base64,${base64}`,
    });
  } catch (error) {
    console.error('Proxy image error:', error);
    return res.status(500).json({ error: 'Failed to proxy image' });
  }
}
