import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, handleAuthError } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `Kamu adalah AWAS AI — asisten cerdas untuk aplikasi "AWAS" (Aplikasi Waste Always Simple).
AWAS adalah sistem manajemen limbah produk (product destruction/waste) untuk industri F&B (restoran).

Konteks aplikasi:
- User adalah QC Staff yang mencatat limbah harian dari berbagai station (NOODLE, DIMSUM, BAR, PRODUKSI, dll)
- Data waste dicatat per shift (Pagi, Siang, Malam) dan per station
- Setiap entry berisi: nama produk, jumlah (qty), unit (PCS, KG, PACK, dll)
- Data dikirim ke Google Sheets dan ada backup PDF

Kamu bisa membantu:
1. Menjawab pertanyaan seputar waste management & food safety
2. Memberikan tips mengurangi waste
3. Analisis tren waste (jika user kasih data)
4. Menjelaskan prosedur QC dan food safety
5. Membantu troubleshoot masalah di aplikasi AWAS
6. Percakapan umum dengan ramah
7. GENERATE PDF laporan waste harian

FITUR PDF:
Jika user minta generate/buat/download PDF waste untuk tanggal tertentu, kamu HARUS:
1. Parsing tanggal dari pesan user. Tanggal hari ini: ${new Date().toISOString().split('T')[0]}
2. Convert ke format YYYY-MM-DD
3. Sertakan tag khusus di AKHIR response: <<PDF:YYYY-MM-DD>>
4. Contoh: user bilang "buatkan pdf waste tanggal 15 maret 2026" → respond dengan penjelasan singkat lalu akhiri dengan <<PDF:2026-03-15>>
5. Contoh: "pdf waste kemarin" → hitung tanggal kemarin dari hari ini, lalu <<PDF:YYYY-MM-DD>>
6. Contoh: "download pdf hari ini" → <<PDF:${new Date().toISOString().split('T')[0]}>>
7. JANGAN ubah format tag. HARUS persis <<PDF:YYYY-MM-DD>> di akhir pesan.
8. Berikan respons singkat sebelum tag, misal "Siap! Gw buatin PDF waste untuk tanggal XX. Klik tombol download di bawah ya 👇"

Gaya bahasa:
- Casual tapi profesional, bahasa Indonesia
- Boleh pakai emoji sesekali
- Jawab singkat dan to the point
- Kalau ditanya di luar konteks waste/F&B, tetap jawab dengan baik`;

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit: 20 requests per minute
  if (checkRateLimit(req, res, { name: 'ai-chat', maxRequests: 20, windowSeconds: 60 })) return;

  // Auth
  let jwtPayload;
  try {
    jwtPayload = requireAuth(req);
  } catch (err) {
    return handleAuthError(err, res);
  }

  // Validate API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum di-set di server.' });
  }

  // Parse body
  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  }

  if (message.length > 4000) {
    return res.status(400).json({ error: 'Pesan terlalu panjang (max 4000 karakter).' });
  }

  try {
    // Build conversation history for Gemini
    const contents: GeminiMessage[] = [];

    // Add previous messages if any (max last 20 messages)
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-20);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'model') {
          contents.push({
            role: msg.role,
            parts: [{ text: msg.text || '' }],
          });
        }
      }
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }],
    });

    // Call Gemini API
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      console.error(`[AI Chat] Gemini error ${geminiResponse.status}:`, errBody);

      if (geminiResponse.status === 429) {
        return res.status(429).json({ error: 'AI lagi sibuk, coba lagi dalam beberapa detik.' });
      }
      if (geminiResponse.status === 400) {
        return res.status(400).json({ error: 'Request ke AI gagal. Coba kirim ulang pesan.' });
      }
      return res.status(502).json({ error: 'Gagal terhubung ke AI. Coba lagi nanti.' });
    }

    const data = await geminiResponse.json();

    // Extract response text
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error('[AI Chat] Empty response from Gemini:', JSON.stringify(data));
      return res.status(502).json({ error: 'AI tidak memberikan respons. Coba lagi.' });
    }

    return res.json({
      success: true,
      reply: responseText,
      model: GEMINI_MODEL,
    });
  } catch (err: any) {
    console.error('[AI Chat] Error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server. Coba lagi.' });
  }
}
