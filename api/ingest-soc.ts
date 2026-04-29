import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyJwt } from './_lib/auth';
import {
  getSocContent,
  chunkSocDocument,
  generateEmbeddings,
  storeChunks,
  getIngestionStatus,
} from './_lib/rag';

/**
 * SOC Ingestion Endpoint
 * 
 * POST /api/ingest-soc - Ingest SOC document into vector database
 * GET /api/ingest-soc - Check ingestion status
 * 
 * Requires super_admin role
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Auth check
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const token = authHeader.slice(7);
    const decoded = verifyJwt(token);
    
    if (!decoded || decoded.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: super_admin only' });
    }

    // GET: Check status
    if (req.method === 'GET') {
      const status = await getIngestionStatus();
      return res.status(200).json({ success: true, ...status });
    }

    // POST: Ingest
    if (req.method === 'POST') {
      console.log('[Ingest] Starting SOC ingestion...');
      
      // Step 1: Load and chunk document
      console.log('[Ingest] Loading SOC document...');
      const content = await getSocContent();
      
      console.log('[Ingest] Chunking document...');
      const chunks = chunkSocDocument(content);
      console.log(`[Ingest] Created ${chunks.length} chunks`);
      
      // Step 2: Generate embeddings
      console.log('[Ingest] Generating embeddings (this will take ~10-15 minutes)...');
      const chunksWithEmbeddings = await generateEmbeddings(chunks, (current, total) => {
        if (current % 10 === 0) {
          console.log(`[Ingest] Progress: ${current}/${total} (${Math.round((current/total)*100)}%)`);
        }
      });
      
      console.log(`[Ingest] Generated ${chunksWithEmbeddings.length} embeddings`);
      
      // Step 3: Store in Redis
      console.log('[Ingest] Storing chunks in Redis...');
      await storeChunks(chunksWithEmbeddings);
      
      console.log('[Ingest] ✅ Ingestion complete!');
      
      return res.status(200).json({
        success: true,
        message: 'SOC ingestion complete',
        totalChunks: chunksWithEmbeddings.length,
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[Ingest] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
