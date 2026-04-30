import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, handleAuthError, getAuthorizedTenantId } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { resolveTenantCredentials } from './_lib/tenant-resolver.js';
import { getGoogleAccessToken } from './_lib/google-sheets.js';
import { getOrderedKeys, getFallbackMessage, ensureGeminiKeysTable } from './_lib/gemini-key-pool.js';

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ==================== REALTIME DATA FETCHER ====================

function formatDateToTab(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear().toString().slice(-2);
  return `${d}/${m}/${y}`;
}

// FIX: Use proper WIB timezone via Intl instead of manual UTC offset
function getWIBDate(): Date {
  const now = new Date();
  const wibStr = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  const wib = new Date(wibStr);
  // Business date cutoff at 05:00 WIB
  if (wib.getHours() < 5) {
    wib.setDate(wib.getDate() - 1);
  }
  return wib;
}

interface WasteEntry {
  shift: string;
  station: string;
  product: string;
  qty: number;
  unit: string;
  method: string;
  reason: string;
  qc: string;
  manager: string;
}

interface DaySummary {
  date: string;
  tab: string;
  entries: WasteEntry[];
  totalItems: number;
  totalQty: number;
  stationTotals: Record<string, number>;
  shiftTotals: Record<string, number>;
}

// FIX #21: Parse tab name "DD/MM/YY" to Date using UTC to avoid timezone issues
function parseTabToDate(tab: string): Date | null {
  const match = tab.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Date.UTC(2000 + parseInt(year), parseInt(month) - 1, parseInt(day)));
}

async function fetchWasteData(
  tenantId: string,
  daysBack: number = 7
): Promise<{ today: DaySummary | null; recentDays: DaySummary[]; error?: string }> {
  try {
    const tenantCreds = await resolveTenantCredentials(tenantId);
    if (!tenantCreds.googleSheetsCredentials || !tenantCreds.googleSpreadsheetId) {
      return { today: null, recentDays: [], error: 'Google Sheets belum di-setting' };
    }

    const credentials = JSON.parse(tenantCreds.googleSheetsCredentials);
    const accessToken = await getGoogleAccessToken(credentials, 'readonly');
    const SPREADSHEET_ID = tenantCreds.googleSpreadsheetId;

    // Step 1: Fetch actual tab names from spreadsheet (same approach as dashboard-data)
    const metaController = new AbortController();
    const metaTimeout = setTimeout(() => metaController.abort(), 15000);
    const spreadsheet = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: metaController.signal }
    ).then(r => r.json()) as any;
    clearTimeout(metaTimeout);

    const allTabs = (spreadsheet.sheets || [])
      .map((s: any) => s.properties?.title)
      .filter((t: string) => /^\d{2}\/\d{2}\/\d{2}$/.test(t))
      .sort((a: string, b: string) => {
        const da = parseTabToDate(a);
        const db = parseTabToDate(b);
        return (db?.getTime() || 0) - (da?.getTime() || 0); // newest first
      });

    // Step 2: Take only the most recent N tabs
    const tabs = allTabs.slice(0, daysBack);

    if (tabs.length === 0) {
      return { today: null, recentDays: [], error: 'Tidak ada tab data di spreadsheet' };
    }

    // Step 3: Batch fetch only existing tabs
    const ranges = tabs.map((t: string) => `${encodeURIComponent(t)}!A2:V1000`).join('&ranges=');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?ranges=${ranges}&valueRenderOption=UNFORMATTED_VALUE`;
    const batchRes = await fetch(batchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    }).then(r => r.json()) as any;
    clearTimeout(timeout);

    const valueRanges = batchRes.valueRanges || [];
    const daySummaries: DaySummary[] = [];

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const rows = valueRanges[i]?.values || [];
      if (rows.length === 0) continue;

      const entries: WasteEntry[] = [];
      const stationTotals: Record<string, number> = {};
      const shiftTotals: Record<string, number> = {};
      let totalItems = 0;
      let totalQty = 0;

      for (const row of rows) {
        const shift = (row[0] || '').toString().toUpperCase();
        const station = (row[2] || '').toString().toUpperCase();
        const productName = (row[3] || '').toString();
        const qtyStr = (row[5] || '').toString();
        const unitStr = (row[6] || '').toString().toUpperCase();
        const method = (row[7] || '').toString();
        const reason = (row[8] || '').toString();
        const qcName = (row[10] || '').toString().trim();
        const mgrName = (row[11] || '').toString().trim();

        if (!productName || !station) continue;

        const products = productName.split('\n').filter((p: string) => p.trim());
        const quantities = qtyStr.split('\n').filter((q: string) => q.trim());
        const units = unitStr.split('\n').filter((u: string) => u.trim());

        for (let k = 0; k < products.length; k++) {
          const pName = products[k].trim();
          const qty = parseFloat(quantities[k]) || 1;
          const unit = (units[k] || units[0] || 'PCS').trim();

          totalItems++;
          totalQty += qty;
          stationTotals[station] = (stationTotals[station] || 0) + qty;
          shiftTotals[shift] = (shiftTotals[shift] || 0) + qty;

          entries.push({
            shift, station, product: pName, qty, unit,
            method, reason, qc: qcName, manager: mgrName,
          });
        }
      }

      // Convert tab DD/MM/YY to YYYY-MM-DD
      const tabDate = parseTabToDate(tab);
      const isoDate = tabDate ? tabDate.toISOString().split('T')[0] : tab;

      daySummaries.push({ date: isoDate, tab, entries, totalItems, totalQty, stationTotals, shiftTotals });
    }

    const today = daySummaries.length > 0 ? daySummaries[0] : null;
    return { today, recentDays: daySummaries };
  } catch (err: any) {
    console.error('[AI Chat] fetchWasteData error:', err.message);
    return { today: null, recentDays: [], error: err.message };
  }
}

function formatDataContext(today: DaySummary | null, recentDays: DaySummary[]): string {
  if (!today && recentDays.length === 0) {
    return '\n\n[DATA REALTIME] Tidak ada data waste yang tersedia saat ini.';
  }

  let ctx = '\n\n=== DATA WASTE REALTIME (dari Google Sheets) ===\n';

  if (today && today.entries.length > 0) {
    ctx += `\n📅 HARI INI (${today.date}):\n`;
    ctx += `- Total item: ${today.totalItems}\n`;
    ctx += `- Total qty: ${today.totalQty}\n`;

    if (Object.keys(today.stationTotals).length > 0) {
      ctx += `- Per station:\n`;
      for (const [station, qty] of Object.entries(today.stationTotals).sort((a, b) => b[1] - a[1])) {
        ctx += `  • ${station}: ${qty}\n`;
      }
    }

    if (Object.keys(today.shiftTotals).length > 0) {
      ctx += `- Per shift:\n`;
      for (const [shift, qty] of Object.entries(today.shiftTotals).sort((a, b) => b[1] - a[1])) {
        ctx += `  • ${shift}: ${qty}\n`;
      }
    }

    // Top products today
    const productTotals: Record<string, { qty: number; unit: string }> = {};
    for (const e of today.entries) {
      const key = `${e.product}|${e.unit}`;
      if (!productTotals[key]) productTotals[key] = { qty: 0, unit: e.unit };
      productTotals[key].qty += e.qty;
    }
    const topProducts = Object.entries(productTotals)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 10);
    if (topProducts.length > 0) {
      ctx += `- Top produk waste hari ini:\n`;
      for (const [key, data] of topProducts) {
        const name = key.split('|')[0];
        ctx += `  • ${name}: ${data.qty} ${data.unit}\n`;
      }
    }

    // Detail per shift & station
    ctx += `\n📋 DETAIL HARI INI:\n`;
    const byShift: Record<string, WasteEntry[]> = {};
    for (const e of today.entries) {
      if (!byShift[e.shift]) byShift[e.shift] = [];
      byShift[e.shift].push(e);
    }
    for (const [shift, entries] of Object.entries(byShift)) {
      ctx += `\n  [${shift}]\n`;
      const byStation: Record<string, WasteEntry[]> = {};
      for (const e of entries) {
        if (!byStation[e.station]) byStation[e.station] = [];
        byStation[e.station].push(e);
      }
      for (const [station, items] of Object.entries(byStation)) {
        ctx += `    ${station}:\n`;
        for (const item of items) {
          ctx += `      - ${item.product}: ${item.qty} ${item.unit}`;
          if (item.reason) ctx += ` (${item.reason})`;
          ctx += `\n`;
        }
      }
    }
  } else {
    ctx += `\n📅 HARI INI: Belum ada data waste tercatat.\n`;
  }

  // Weekly summary
  if (recentDays.length > 1) {
    ctx += `\n📊 RINGKASAN 7 HARI TERAKHIR:\n`;
    let weekItems = 0, weekQty = 0;
    const weekStations: Record<string, number> = {};
    const weekProducts: Record<string, { qty: number; unit: string }> = {};

    for (const day of recentDays) {
      weekItems += day.totalItems;
      weekQty += day.totalQty;
      for (const [s, q] of Object.entries(day.stationTotals)) {
        weekStations[s] = (weekStations[s] || 0) + q;
      }
      for (const e of day.entries) {
        const key = `${e.product}|${e.unit}`;
        if (!weekProducts[key]) weekProducts[key] = { qty: 0, unit: e.unit };
        weekProducts[key].qty += e.qty;
      }
    }

    ctx += `- Total hari ada data: ${recentDays.length}\n`;
    ctx += `- Total item: ${weekItems}\n`;
    ctx += `- Total qty: ${weekQty}\n`;
    ctx += `- Rata-rata per hari: ${Math.round(weekItems / recentDays.length)} item, ${Math.round(weekQty / recentDays.length)} qty\n`;

    ctx += `- Per station (7 hari):\n`;
    for (const [station, qty] of Object.entries(weekStations).sort((a, b) => b[1] - a[1])) {
      ctx += `  • ${station}: ${qty}\n`;
    }

    const topWeek = Object.entries(weekProducts).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
    if (topWeek.length > 0) {
      ctx += `- Top 10 produk waste (7 hari):\n`;
      for (const [key, data] of topWeek) {
        const name = key.split('|')[0];
        ctx += `  • ${name}: ${data.qty} ${data.unit}\n`;
      }
    }

    // Daily trend
    ctx += `\n📈 TREN HARIAN:\n`;
    for (const day of recentDays.slice().reverse()) {
      ctx += `  ${day.date}: ${day.totalItems} item, ${day.totalQty} qty\n`;
    }
  }

  ctx += '\n=== END DATA ===\n';
  return ctx;
}

// ==================== SYSTEM PROMPT ====================

function buildSystemPrompt(dataContext: string): string {
  const today = new Date().toISOString().split('T')[0];

  return `Kamu adalah AWAS AI — asisten cerdas untuk aplikasi "AWAS" (Aplikasi Waste Always Simple).
Kamu punya akses ke DATA REALTIME waste dari Dashboard (Google Sheets). Gunakan data ini untuk menjawab pertanyaan user.

=== TENTANG APLIKASI AWAS ===

AWAS adalah sistem manajemen pencatatan & pemusnahan produk (product destruction/waste) digital untuk PT. Pesta Pora Abadi, perusahaan F&B dengan banyak outlet restoran.

TUJUAN UTAMA:
1. Menggantikan form kertas untuk pencatatan waste produk
2. Dashboard & analitik waste harian/bulanan per outlet
3. Audit trail — setiap pemusnahan tercatat dengan paraf QC & Manager
4. Dokumentasi foto bukti pemusnahan (upload ke Cloudflare R2)
5. Export otomatis ke Google Sheets per outlet
6. Multi-outlet dengan isolasi data per tenant

ARSITEKTUR:
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui (PWA)
- Backend: Vercel Serverless Functions
- Database: Neon PostgreSQL (multi-tenant — master DB + per-tenant DB)
- Storage: Cloudflare R2 (foto dokumentasi)
- Export: Google Sheets (1 spreadsheet per tenant, 1 tab per hari)
- Auth: JWT (scrypt password hash), 8 jam session

FITUR-FITUR UTAMA:

1. 📝 MANUAL WASTE ENTRY (Pencatatan Manual)
   - Wizard step-by-step: pilih shift → station → isi produk → upload foto → pilih paraf QC & Manager
   - Kategori station: 🍜 NOODLE, 🥟 DIMSUM, 🍹 BAR, 🏭 PRODUKSI
   - Input: nama produk, kode lot, jumlah (qty), unit (PCS, KG, PACK, PORSI, LITER, dll), metode & alasan pemusnahan
   - Upload multi-file dokumentasi foto
   - Deteksi duplikasi entry otomatis

2. ⚡ AUTO WASTE (Paste & Submit)
   - Paste data langsung dari clipboard (format terstruktur)
   - Auto-parse nama produk, kode lot, quantity
   - Preview sebelum submit, bulk submission

3. 📊 DASHBOARD & REPORTING
   - Chart harian: Bar, Line, Pie (Recharts)
   - Filter by date range, station, shift
   - Summary: total items, total qty, rata-rata harian
   - Breakdown per station, per shift, per produk
   - Tren harian, mingguan, bulanan

4. ⚙️ ADMIN PANEL (Super Admin)
   - Tenant Management: CRUD outlet/store
   - User Management: CRUD users per tenant
   - Config Management: Google Sheets & R2 credentials per tenant
   - Personnel Management: CRUD QC & Manager + upload tanda tangan
   - Database Operations: init/migrate schema

5. 📄 PDF GENERATION
   - Generate Berita Acara Pemusnahan Produk
   - Include: tabel waste per shift, paraf QC, paraf Manager, foto dokumentasi
   - Footer: tanda tangan pelapor
   - Format: BA_WASTE_YYYYMMDD.pdf
   - Auto backup ke R2 cloud

6. 🤖 AI ASSISTANT (ini kamu!)
   - Chat AI untuk tanya-tanya soal waste, food safety, tips
   - Akses data realtime dari Dashboard
   - Generate PDF waste

ROLES & USER:
- super_admin: bisa manage semua tenant, users, configs, personnel
- admin_store: bisa submit waste, lihat dashboard, manage settings store sendiri
- User saat ini adalah QC Staff yang login ke salah satu outlet

SHIFT & WAKTU (WIB / GMT+7):
- 🌅 OPENING: 05:00 – 11:59 (persiapan pagi)
- ☀️ MIDDLE: 12:00 – 16:59 (lunch rush)
- 🌆 CLOSING: 17:00 – 23:59 (dinner & tutup)
- 🌙 MIDNIGHT: 00:00 – 04:59 (late night, masuk tanggal bisnis SEBELUMNYA)
- Business day cutoff: jam 05:00 WIB

DATA FLOW:
1. QC Staff isi form waste → submit
2. Data masuk ke Google Sheets (1 tab per hari, format DD/MM/YY)
3. Foto upload ke Cloudflare R2
4. Dashboard baca dari Google Sheets untuk analitik
5. PDF bisa di-generate kapan saja dari data di Sheets

KOLOM DI GOOGLE SHEETS:
A: Shift | B: Store | C: Station | D: Nama Produk | E: Kode Produk | F: Jumlah | G: Unit | H: Metode Pemusnahan | I: Alasan | J: Jam/Tanggal | K: Paraf QC | L: Paraf Manager | M-V: Dokumentasi foto

=== KEMAMPUAN KAMU ===

1. ✅ JAWAB pertanyaan seputar waste management & food safety
2. ✅ AKSES DATA REALTIME — kamu punya data waste terkini dari Dashboard (lihat di bawah)
3. ✅ ANALISIS tren waste — bandingkan hari ini vs kemarin, minggu ini, identifikasi pola
4. ✅ BERIKAN TIPS mengurangi waste berdasarkan data aktual
5. ✅ JELASKAN prosedur QC dan food safety
6. ✅ TROUBLESHOOT masalah di aplikasi AWAS
7. ✅ GENERATE PDF laporan waste harian
8. ✅ PERCAKAPAN UMUM dengan ramah

CARA MENJAWAB PERTANYAAN DATA:
- Kalau user tanya "berapa waste hari ini?" → jawab dari data realtime di bawah
- Kalau user tanya "station mana paling banyak?" → lihat stationTotals
- Kalau user tanya "tren minggu ini?" → lihat data 7 hari terakhir
- Kalau user tanya "produk apa yang paling sering di-waste?" → lihat top produk
- Selalu sertakan angka spesifik dari data, jangan mengarang
- Kalau data tidak tersedia, bilang jujur "belum ada data untuk itu"
- Berikan insight & saran berdasarkan data (misal: "DIMSUM waste-nya tinggi hari ini, mungkin produksi perlu dikurangi")

FITUR PDF:
Jika user minta generate/buat/download PDF waste untuk tanggal tertentu:
1. PERTAMA, tanya dulu mau pakai TTD (tanda tangan) siapa buat pelapornya. Contoh: "Oke, mau pakai TTD siapa nih buat pelapornya? 📝"
2. JANGAN langsung generate PDF tanpa tahu nama pelapor!
3. Kalau user sudah kasih nama pelapor DAN tanggal, baru generate PDF.
4. Parsing tanggal dari pesan user. Tanggal hari ini: ${today}
5. Convert ke format YYYY-MM-DD
6. Sertakan tag khusus di AKHIR response: <<PDF:YYYY-MM-DD>>
7. Contoh: user bilang "buatkan pdf waste tanggal 15 maret 2026" → TANYA DULU pelapornya siapa
8. Setelah user jawab pelapornya, baru respond + akhiri dengan <<PDF:YYYY-MM-DD>>
9. JANGAN ubah format tag. HARUS persis <<PDF:YYYY-MM-DD>> di akhir pesan.
10. Kalau user sudah pernah sebut nama pelapor di chat sebelumnya, ga perlu tanya lagi — langsung generate.

GAYA BAHASA:
- Casual tapi profesional, bahasa Indonesia
- Boleh pakai emoji sesekali
- Jawab singkat dan to the point, tapi kalau data banyak — tampilkan dengan rapi
- Kalau ditanya di luar konteks waste/F&B, tetap jawab dengan baik
- Kalau user tanya data → SELALU gunakan data realtime, jangan mengarang angka
${dataContext}`;
}

// ==================== HANDLER ====================

interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // SEC-FIX: Restrict CORS to known origin instead of wildcard
  const allowedOrigin = process.env.CORS_ORIGIN || 'https://gacoanku.my.id';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
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

  // Ensure gemini_api_keys table exists
  await ensureGeminiKeysTable();

  // Parse body
  const { message, history, attachments } = req.body || {};
  if ((!message || typeof message !== 'string' || message.trim().length === 0) && (!Array.isArray(attachments) || attachments.length === 0)) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  }

  if (message && message.length > 4000) {
    return res.status(400).json({ error: 'Pesan terlalu panjang (max 4000 karakter).' });
  }

  try {
    // Fetch realtime waste data for context
    const tenantId = getAuthorizedTenantId(req, jwtPayload);
    const { today, recentDays } = await fetchWasteData(tenantId, 7);
    const dataContext = formatDataContext(today, recentDays);
    const SYSTEM_INSTRUCTION = buildSystemPrompt(dataContext);

    // Build conversation history for Gemini
    const contents: GeminiMessage[] = [];

    // Add previous messages if any (max last 20 messages)
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-20);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'model') {
          const parts: GeminiMessage['parts'] = [];
          if (msg.text) parts.push({ text: msg.text });
          // History attachments - only metadata (no base64 to save bandwidth)
          if (Array.isArray(msg.attachments)) {
            for (const att of msg.attachments) {
              if (att.data && att.mimeType) {
                // Has actual data (shouldn't happen with new frontend, but handle gracefully)
                if (att.type === 'text') {
                  parts.push({ text: `[File: ${att.name}]\n${att.data}` });
                } else {
                  parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
                }
              } else {
                // Metadata only - just mention the file was shared
                parts.push({ text: `[User shared ${att.type || 'file'}: ${att.name}]` });
              }
            }
          }
          if (parts.length === 0) parts.push({ text: '' });
          contents.push({ role: msg.role, parts });
        }
      }
    }

    // Add current user message
    const userParts: GeminiMessage['parts'] = [];

    // Add attachments first
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === 'text') {
          // Text files: add as text part
          userParts.push({ text: `[File: ${att.name}]\n${att.data}` });
        } else {
          // Images and audio: add as inlineData
          userParts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data, // base64
            },
          });
        }
      }
    }

    // Add user text message
    if (message && message.trim()) {
      userParts.push({ text: message.trim() });
    }

    if (userParts.length === 0) {
      return res.status(400).json({ error: 'No message or attachments provided' });
    }

    contents.push({ role: 'user', parts: userParts });

    // Build payload
    const geminiPayload = {
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
      generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 4096 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    };

    // Call Gemini with sticky pool rotation
    const apiKeys = await getOrderedKeys(jwtPayload.userId, tenantId);
    if (apiKeys.length === 0) {
      const envKey = process.env.GEMINI_API_KEY;
      if (envKey) apiKeys.push(envKey);
    }

    let responseText: string | null = null;
    for (let i = 0; i < apiKeys.length; i++) {
      const apiKey = apiKeys[i];
      const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      });

      if (geminiResponse.ok) {
        const data = await geminiResponse.json();
        responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        break;
      }

      const errBody = await geminiResponse.text();
      console.warn(`[AI Chat] Key ${i + 1}/${apiKeys.length} failed (${geminiResponse.status}):`, errBody.slice(0, 100));
      if (geminiResponse.status !== 429 && geminiResponse.status !== 403) break;
    }

    if (!responseText) {
      return res.status(200).json({ success: true, reply: getFallbackMessage() });
    }

    return res.json({ success: true, reply: responseText, model: GEMINI_MODEL });
  } catch (err: any) {
    console.error('[AI Chat] Error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server. Coba lagi.' });
  }
}
