import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, handleAuthError } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { searchSocChunks } from './_lib/rag.js';

const GEMINI_MODEL = 'gemini-1.5-flash-latest';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ==================== SYSTEM PROMPT ====================

function buildSystemPrompt(socContext: string): string {
  return `Kamu adalah QC Helper AI — asisten khusus untuk Quality Control di Mie Gacoan.
Kamu memiliki pengetahuan lengkap tentang SOC (Station Observation Checklist) V.4.0 dan membantu crew, supervisor, dan manajemen dalam memahami SOP, prosedur operasional, standar kualitas produk.

=== KEMAMPUAN KAMU ===

1. ✅ JAWAB pertanyaan seputar SOP & prosedur operasional di semua station (NOODLE, DIMSUM, BAR, PRODUKSI)
2. ✅ JELASKAN standar kualitas produk (visual, aroma, rasa, tekstur, berat, dll)
3. ✅ BERIKAN panduan cooking time, gramasi, parameter produk
4. ✅ TROUBLESHOOT masalah kualitas produk
5. ✅ JELASKAN prosedur QC dan food safety
6. ✅ BANTU crew level, supervisor, manager dengan referensi SOC

=== PENGETAHUAN SOC (STATION OBSERVATION CHECKLIST) ===

Berikut adalah bagian relevan dari dokumen SOC untuk menjawab pertanyaan user:

${socContext}

=== END SOC ===

=== CARA MENJAWAB ===

- Jawab berdasarkan dokumen SOC di atas
- Jika informasi tidak ada di dokumen, katakan dengan jujur "Informasi ini tidak ada di SOC V.4.0"
- Gunakan bahasa yang sama dengan pertanyaan user (Indonesia atau Inggris)
- Berikan jawaban yang spesifik dengan referensi ke section SOC jika relevan
- Jika user tanya tentang parameter/standar, sebutkan angka/nilai spesifik dari SOC
- Boleh pakai emoji sesekali untuk friendly tone
- Jawab singkat dan to the point, tapi lengkap

=== CONTOH PERTANYAAN ===

User: "Berapa cooking time mie Vinna?"
Kamu: "Cooking time mie Vinna adalah 2'10" - 2'15" (2 menit 10 detik sampai 2 menit 15 detik). Pastikan suhu air minimal 98°C atau sudah mendidih sebelum mie dimasukkan. 🍜"

User: "Apa parameter visual mie yang benar setelah direbus?"
Kamu: "Parameter visual mie yang benar setelah direbus:
- Bentuk mie lurus, tidak gepeng
- Untaian mie utuh, tidak banyak patah/putus
- Permukaan terlihat transparan
- Bagian tengah matang sempurna (tidak ada bagian bertepung/warna putih)
- Warna kuning muda
✅ Pastikan tidak ada bagian yang undercooked atau overcooked!"

User: "Gimana cara bikin mie gacoan level 3?"
Kamu: "Cara bikin Mie Gacoan Level 3:
1. Cabai: 15 gr
2. Minyak mie: 1 TBS (13-14 gr)
3. Bumbu basic: 1 TSP (11-12 gr)
4. Kecap: 1 TSP (12 gr)
5. Rebus mie sesuai cooking time supplier
6. Aduk semua bumbu dengan mie
7. Tambah topping (ayam cincang, bawang goreng, dry leaf, pangsit)
🌶️ Level 3 = 15 gram cabai!"`;
}

// ==================== HANDLER ====================

interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const allowedOrigin = process.env.CORS_ORIGIN || 'https://gacoanku.my.id';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit: 20 requests per minute
  if (checkRateLimit(req, res, { name: 'qc-chat', maxRequests: 20, windowSeconds: 60 })) return;

  // Auth
  let jwtPayload;
  try {
    jwtPayload = await requireAuth(req);
  } catch (err) {
    return handleAuthError(err, res);
  }

  try {
    const body = req.body;
    const { message, history, attachments } = body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid message' });
    }

    // Step 1: RAG Retrieval - search for relevant SOC chunks
    console.log('[QC Chat] Searching SOC for:', message.substring(0, 100));
    
    let socContext = '';
    try {
      const searchResults = await searchSocChunks(message, 3); // Top 3 most relevant chunks
      
      if (searchResults.length > 0) {
        socContext = searchResults
          .map((result, idx) => {
            return `[Chunk ${idx + 1} - Relevance: ${(result.score * 100).toFixed(1)}%]\n${result.chunk.content}`;
          })
          .join('\n\n---\n\n');
        
        console.log(`[QC Chat] Found ${searchResults.length} relevant chunks`);
      } else {
        socContext = '(Tidak ada konteks SOC yang relevan ditemukan untuk pertanyaan ini)';
        console.log('[QC Chat] No relevant chunks found');
      }
    } catch (ragError: any) {
      console.error('[QC Chat] RAG error:', ragError);
      // If RAG fails, continue without context
      socContext = '(RAG system error - answering without SOC context)';
    }

    // Step 2: Build Gemini messages
    const geminiMessages: GeminiMessage[] = [];

    // Add history (limit to last 20 messages to save tokens)
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-20);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'model') {
          const parts: GeminiMessage['parts'] = [];
          
          if (msg.text) {
            parts.push({ text: msg.text });
          }
          
          // Add attachments from history metadata (no actual data)
          if (msg.attachments && Array.isArray(msg.attachments)) {
            for (const att of msg.attachments) {
              parts.push({ text: `[User uploaded: ${att.name} (${att.type})]` });
            }
          }
          
          if (parts.length > 0) {
            geminiMessages.push({ role: msg.role, parts });
          }
        }
      }
    }

    // Add current user message
    const userParts: GeminiMessage['parts'] = [{ text: message }];

    // Add attachments (images, audio, documents)
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.type === 'image' || att.type === 'audio' || att.type === 'document') {
          userParts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data, // base64
            },
          });
        } else if (att.type === 'text') {
          userParts.push({ text: `\n\n[File: ${att.name}]\n${att.data}` });
        }
      }
    }

    geminiMessages.push({ role: 'user', parts: userParts });

    // Step 3: Call Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    }

    const systemPrompt = buildSystemPrompt(socContext);

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    };

    console.log('[QC Chat] Calling Gemini API...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const geminiRes = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(geminiPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error('[QC Chat] Gemini error:', errorText);
      return res.status(geminiRes.status).json({
        success: false,
        error: `Gemini API error: ${geminiRes.status}`,
      });
    }

    const geminiData = await geminiRes.json();
    console.log('[QC Chat] Gemini response received');

    // Extract reply
    const candidate = geminiData.candidates?.[0];
    if (!candidate || !candidate.content?.parts?.[0]?.text) {
      return res.status(500).json({
        success: false,
        error: 'No response from Gemini',
      });
    }

    const reply = candidate.content.parts[0].text;

    return res.status(200).json({
      success: true,
      reply,
    });
  } catch (error: any) {
    console.error('[QC Chat] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
