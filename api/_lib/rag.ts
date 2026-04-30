import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';
import { getActiveKeys } from './gemini-key-pool.js';

// ==================== TYPES ====================

export interface SocChunk {
  id: string;
  content: string;
  section: string;
  embedding?: number[];
  metadata?: {
    station?: string;
    level?: string;
    lineStart?: number;
    lineEnd?: number;
  };
}

export interface SearchResult {
  chunk: SocChunk;
  score: number;
}

// ==================== REDIS CLIENT ====================

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (redis) return redis;
  
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    throw new Error('Missing KV_REST_API_URL or KV_REST_API_TOKEN environment variables');
  }
  
  redis = new Redis({ url, token });
  return redis;
}

// ==================== SOC CONTENT LOADER ====================

let cachedSocContent: string | null = null;

export async function getSocContent(): Promise<string> {
  if (cachedSocContent) return cachedSocContent;
  
  // Try to fetch from Vercel Blob first (production)
  const blobUrl = process.env.BLOB_SOC_URL;
  if (blobUrl) {
    try {
      console.log('[SOC] Fetching from Vercel Blob:', blobUrl);
      const response = await fetch(blobUrl);
      if (response.ok) {
        cachedSocContent = await response.text();
        console.log('[SOC] Loaded from Blob:', (cachedSocContent.length / 1024).toFixed(2), 'KB');
        return cachedSocContent;
      }
    } catch (error) {
      console.error('[SOC] Failed to fetch from Blob:', error);
      // Fall through to filesystem
    }
  }
  
  // Fallback to local filesystem (development)
  try {
    const filePath = path.join(process.cwd(), 'soc_master.md');
    cachedSocContent = fs.readFileSync(filePath, 'utf-8');
    console.log('[SOC] Loaded from filesystem:', (cachedSocContent.length / 1024).toFixed(2), 'KB');
    return cachedSocContent;
  } catch (error) {
    throw new Error('SOC document not found. Please upload soc_master.md to Vercel Blob or place in project root.');
  }
}

// ==================== CHUNKING ====================

/**
 * Split SOC document into semantic chunks
 * Strategy: Split by sections (## headers) and sub-sections
 */
export function chunkSocDocument(content: string): SocChunk[] {
  const lines = content.split('\n');
  const chunks: SocChunk[] = [];
  
  let currentSection = '';
  let currentContent: string[] = [];
  let currentStation = '';
  let currentLevel = '';
  let lineStart = 0;
  
  const flushChunk = (lineEnd: number) => {
    if (currentContent.length === 0) return;
    
    const text = currentContent.join('\n').trim();
    if (text.length < 50) return; // Skip tiny chunks
    
    chunks.push({
      id: `chunk_${chunks.length}`,
      content: text,
      section: currentSection,
      metadata: {
        station: currentStation,
        level: currentLevel,
        lineStart,
        lineEnd,
      },
    });
    
    currentContent = [];
  };
  
  lines.forEach((line, idx) => {
    // Detect section headers
    if (line.startsWith('# ')) {
      flushChunk(idx - 1);
      currentSection = line.replace(/^#\s+/, '').trim();
      currentStation = extractStation(currentSection);
      currentLevel = '';
      lineStart = idx;
      currentContent = [line];
    } else if (line.startsWith('## ')) {
      flushChunk(idx - 1);
      currentSection = line.replace(/^##\s+/, '').trim();
      currentLevel = extractLevel(currentSection);
      lineStart = idx;
      currentContent = [line];
    } else {
      currentContent.push(line);
      
      // Flush chunk every ~500 lines or at table boundaries
      if (currentContent.length > 500 || (line.trim() === '' && currentContent.length > 100)) {
        flushChunk(idx);
        lineStart = idx + 1;
      }
    }
  });
  
  // Flush remaining
  flushChunk(lines.length - 1);
  
  return chunks;
}

function extractStation(text: string): string {
  const match = text.match(/STATION\s+(NOODLE|DIMSUM|BAR|PRODUKSI)/i);
  return match ? match[1].toUpperCase() : '';
}

function extractLevel(text: string): string {
  const match = text.match(/(CREW|SUPERVISOR|MANAGER|LEADER)\s+LEVEL/i);
  return match ? match[1].toUpperCase() : '';
}

// ==================== EMBEDDINGS ====================

/**
 * Generate embedding using Gemini API
 * Tries all active keys from pool, fallback to env var
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Get keys from pool, fallback to env var
  const poolKeys = await getActiveKeys();
  const apiKeys = poolKeys.map(k => k.api_key);
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && !apiKeys.includes(envKey)) apiKeys.push(envKey);

  if (apiKeys.length === 0) throw new Error('No Gemini API keys available');

  for (const apiKey of apiKeys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-2',
        content: { parts: [{ text }] },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.embedding.values;
    }

    const error = await response.text();
    console.warn(`[RAG] Embedding key failed (${response.status}):`, error.slice(0, 100));
    if (response.status !== 429 && response.status !== 403) break;
  }

  throw new Error('All Gemini API keys failed for embedding');
}

/**
 * Batch generate embeddings with rate limiting
 */
export async function generateEmbeddings(
  chunks: SocChunk[],
  onProgress?: (current: number, total: number) => void
): Promise<SocChunk[]> {
  const results: SocChunk[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      const embedding = await generateEmbedding(chunk.content);
      results.push({ ...chunk, embedding });
      
      if (onProgress) onProgress(i + 1, chunks.length);
      
      // Rate limit: 15 RPM for free tier = 1 request per 4 seconds
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 4100));
      }
    } catch (error) {
      console.error(`Failed to embed chunk ${chunk.id}:`, error);
      // Skip failed chunks
    }
  }
  
  return results;
}

// ==================== VECTOR SEARCH ====================

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search for relevant chunks using vector similarity
 */
export async function searchSocChunks(
  query: string,
  topK: number = 3
): Promise<SearchResult[]> {
  const redis = getRedisClient();
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  
  // Get all chunk IDs
  const chunkIds = await redis.smembers('soc:chunk_ids');
  if (!chunkIds || chunkIds.length === 0) {
    throw new Error('No SOC chunks found in database. Run ingestion first.');
  }
  
  // Fetch all chunks and compute similarity
  const results: SearchResult[] = [];
  
  for (const chunkId of chunkIds) {
    const chunkData = await redis.get(`soc:chunk:${chunkId}`);
    if (!chunkData) continue;
    
    const chunk = typeof chunkData === 'string' ? JSON.parse(chunkData) : chunkData;
    
    if (!chunk.embedding) continue;
    
    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    results.push({ chunk, score });
  }
  
  // Sort by score descending and return top K
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

// ==================== STORAGE ====================

/**
 * Store chunks in Redis
 */
export async function storeChunks(chunks: SocChunk[]): Promise<void> {
  const redis = getRedisClient();
  
  // Clear existing data
  const existingIds = await redis.smembers('soc:chunk_ids');
  if (existingIds && existingIds.length > 0) {
    for (const id of existingIds) {
      await redis.del(`soc:chunk:${id}`);
    }
    await redis.del('soc:chunk_ids');
  }
  
  // Store new chunks
  for (const chunk of chunks) {
    await redis.set(`soc:chunk:${chunk.id}`, JSON.stringify(chunk));
    await redis.sadd('soc:chunk_ids', chunk.id);
  }
  
  // Store metadata
  await redis.set('soc:metadata', JSON.stringify({
    totalChunks: chunks.length,
    lastUpdated: new Date().toISOString(),
    version: '4.0',
  }));
}

/**
 * Get ingestion status
 */
export async function getIngestionStatus(): Promise<{
  isIngested: boolean;
  totalChunks: number;
  lastUpdated: string | null;
}> {
  try {
    const redis = getRedisClient();
    const metadata = await redis.get('soc:metadata');
    
    if (!metadata) {
      return { isIngested: false, totalChunks: 0, lastUpdated: null };
    }
    
    const data = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    return {
      isIngested: true,
      totalChunks: data.totalChunks || 0,
      lastUpdated: data.lastUpdated || null,
    };
  } catch {
    return { isIngested: false, totalChunks: 0, lastUpdated: null };
  }
}
