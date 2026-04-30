import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, handleAuthError } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getSocContent, searchSocChunks } from './_lib/rag.js';
import { getOrderedKeys, getFallbackMessage, ensureGeminiKeysTable } from './_lib/gemini-key-pool.js';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ==================== SYSTEM PROMPT ====================

function buildSystemPrompt(socContext: string): string {
  return `Kamu adalah QC Helper AI — asisten khusus untuk Quality Control di Mie Gacoan.
Kamu memiliki pengetahuan lengkap tentang SOC (Station Observation Checklist) V.4.0 dan membantu crew, supervisor, dan manajemen dalam memahami SOP, prosedur operasional, standar kualitas produk.

=== PENGETAHUAN SOC (STATION OBSERVATION CHECKLIST) ===
${socContext}
=== END SOC ===

=== CARA MENJAWAB ===
1. Jawab pertanyaan berdasarkan SOC di atas
2. Kalau informasi tidak ada di SOC, katakan dengan jujur
3. Gunakan bahasa yang sama dengan pertanyaan user (Indonesia atau Inggris)
4. Berikan contoh konkret dari SOC kalau relevan
5. Kalau ditanya tentang parameter/standar, sebutkan angka spesifik dari SOC

=== GAYA BAHASA ===
- Casual tapi profesional, bahasa Indonesia
- Boleh pakai emoji sesekali
- Jawab singkat dan to the point
- Kalau user tanya di luar konteks SOC/QC, tetap jawab dengan baik tapi ingatkan fokus ke SOC`;
}

// ==================== GEMINI CALL WITH KEY ROTATION ====================

async function callGeminiWithPool(
  userId: string | number,
  tenantId: string,
  payload: object
): Promise<{ success: true; data: any } | { success: false; fallback: string }> {
  const apiKeys = await getOrderedKeys(userId, tenantId);

  if (apiKeys.length === 0) {
    // Fallback ke env var kalau pool kosong
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey) {
      apiKeys.push(envKey);
    } else {
      return { success: false, fallback: getFallbackMessage() };
    }
  }

  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }

      const errorText = await response.text();
      console.warn(`[QC Chat] Key ${i + 1}/${apiKeys.length} failed (${response.status}):`, errorText.slice(0, 100));

      // Kalau 429 (quota) atau 403 (invalid), coba key berikutnya
      if (response.status === 429 || response.status === 403 || response.status === 400) {
        continue;
      }

      // Error lain (500, dll) — stop, jangan coba key lain
      break;
    } catch (err) {
      console.warn(`[QC Chat] Key ${i + 1}/${apiKeys.length} network error:`, err);
      continue;
    }
  }

  return { success: false, fallback: getFallbackMessage() };
}

// ==================== HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env.CORS_ORIGIN || 'https://gacoanku.my.id';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req, res, { name: 'qc-chat', maxRequests: 20, windowSeconds: 60 })) return;

  let jwtPayload: any;
  try {
    jwtPayload = requireAuth(req);
  } catch (error) {
    return handleAuthError(error, res);
  }

  // Ensure table exists (auto-migrate)
  await ensureGeminiKeysTable();

  try {
    const { message, history, attachments } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // RAG: retrieve relevant SOC chunks
    let socContext = '';
    try {
      const relevantChunks = await searchSocChunks(message, 3);
      if (relevantChunks.length > 0) {
        socContext = relevantChunks.map((result, i) =>
          `[Referensi ${i + 1} - Score: ${(result.score * 100).toFixed(1)}%]\n${result.chunk.content}`
        ).join('\n\n');
        console.log(`[QC Chat] Retrieved ${relevantChunks.length} relevant chunks`);
      } else {
        console.log('[QC Chat] No chunks found, loading full SOC');
        socContext = await getSocContent();
      }
    } catch (error) {
      console.error('[QC Chat] RAG retrieval failed:', error);
      socContext = await getSocContent();
    }

    const systemPrompt = buildSystemPrompt(socContext);

    // Build Gemini messages
    const geminiMessages: any[] = [];
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        geminiMessages.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      }
    }

    const userParts: any[] = [{ text: message }];
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.type === 'image' && att.data && att.mimeType) {
          userParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
        } else if (att.type === 'text' && att.data) {
          userParts.push({ text: `\n\n[File: ${att.name}]\n${att.data}` });
        }
      }
    }
    geminiMessages.push({ role: 'user', parts: userParts });

    const payload = {
      contents: geminiMessages,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    // Call Gemini with sticky pool rotation
    const result = await callGeminiWithPool(
      jwtPayload.userId,
      jwtPayload.tenantId || '',
      payload
    );

    if (!result.success) {
      return res.status(200).json({ success: true, reply: (result as { success: false; fallback: string }).fallback });
    }

    const reply = (result as { success: true; data: any }).data.candidates?.[0]?.content?.parts?.[0]?.text || getFallbackMessage();
    return res.status(200).json({ success: true, reply });

  } catch (error: any) {
    console.error('[QC Chat] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}
