import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  Bot,
  Trash2,
  Sparkles,
  Loader2,
  AlertCircle,
  ChevronDown,
  ArrowUp,
  Plus,
  FileDown,
  Download,
  CheckCircle,
  User,
  Clock,
  MessageSquare,
  X,
  Image,
  Mic,
  FileText,
  Paperclip,
} from "lucide-react";

// ==================== TYPES ====================

interface Attachment {
  type: 'image' | 'audio' | 'text' | 'document';
  mimeType: string;
  data: string; // base64 for image/audio, raw text for text files
  name: string;
  previewUrl?: string; // blob URL for image preview
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
  error?: boolean;
  attachments?: Attachment[];
  pdfDate?: string; // If set, this message has a PDF to generate
  pdfState?: "idle" | "loading" | "done" | "error";
  pdfBlobUrl?: string;
  pdfFileName?: string;
  pdfError?: string;
}

// ==================== CHAT HISTORY HELPERS ====================

const HISTORY_KEY = 'waste_ai_chat_history';
const MAX_SESSIONS = 50;

interface ChatSession {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: string;
    error?: boolean;
    pdfDate?: string;
    attachmentMeta?: Array<{ type: string; name: string }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {}
}

function serializeMessages(messages: ChatMessage[]): ChatSession['messages'] {
  return messages.map(m => ({
    id: m.id,
    role: m.role,
    text: m.text,
    timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp as any,
    error: m.error,
    pdfDate: m.pdfDate,
    attachmentMeta: m.attachments?.map(a => ({ type: a.type, name: a.name })),
  }));
}

function deserializeMessages(msgs: ChatSession['messages']): ChatMessage[] {
  return msgs.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp),
    pdfState: m.pdfDate ? 'idle' as const : undefined,
    attachments: m.attachmentMeta?.map(meta => ({
      type: meta.type as Attachment['type'],
      mimeType: '',
      data: '',
      name: meta.name,
    })),
  }));
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay === 1) return 'Kemarin';
  if (diffDay < 7) return `${diffDay} hari lalu`;

  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ==================== PDF HELPERS ====================

const parseJamValue = (raw: string): string => {
  if (!raw || raw === '-') return '-';
  if (raw.includes('WIB')) return raw;
  if (raw.includes('\n')) {
    return raw.split('\n').map(line => parseJamValue(line.trim())).join('\n');
  }
  const num = parseFloat(raw);
  if (!isNaN(num) && num > 40000) {
    const timeFraction = num % 1;
    const totalMinutes = Math.round(timeFraction * 24 * 60);
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const minutes = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hours}:${minutes} WIB`;
  }
  const dtMatch = raw.match(/T(\d{2}:\d{2})/);
  if (dtMatch) return `${dtMatch[1]} WIB`;
  const timeMatch = raw.match(/^(\d{2}:\d{2})/);
  if (timeMatch) return `${timeMatch[1]} WIB`;
  return raw;
};

const extractImageUrl = (val: string): string => {
  if (!val) return '';
  const match = val.match(/=IMAGE\(["']([^"']+)["']/i);
  return match ? match[1] : (val.startsWith('http') ? val : '');
};

async function generateWastePdf(
  date: string,
  pelaporName?: string,
  pelaporSigUrl?: string
): Promise<{ blob: Blob; fileName: string }> {
  // Fetch data
  const res = await apiFetch(`/api/get-day-data?date=${date}`);
  if (!res.ok) throw new Error(`Gagal ambil data: ${res.status}`);
  const dayData = await res.json();
  if (!dayData.success || !dayData.grouped) throw new Error(dayData.error || 'Data kosong untuk tanggal ini');

  // Dynamic import jsPDF
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const storeName = localStorage.getItem('waste_app_store') || dayData.storeName || '-';

  // Logo
  let logoImg: string | null = null;
  try {
    const logoRes = await fetch('/logo-ppa.png');
    if (logoRes.ok) {
      const blob = await logoRes.blob();
      logoImg = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch {}

  // Header
  if (logoImg) doc.addImage(logoImg, 'PNG', margin, 7, 18, 18);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PT. PESTA PORA ABADI', pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(12);
  doc.text('FORM PEMUSNAHAN PRODUK', pageWidth / 2, 19, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Dok.No. PPA/FORM/OPS-STORE/016', pageWidth - margin, 10, { align: 'right' });

  // Info
  const dateObj = new Date(date + 'T00:00:00');
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = dayNames[dateObj.getDay()];
  const dateDisplay = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

  doc.setFontSize(9);
  const infoY = 28;
  doc.text(`Hari: ${dayName}`, margin, infoY);
  doc.text(`Tanggal: ${dateDisplay}`, margin + 50, infoY);
  doc.text(`Store: ${dayData.storeName || storeName}`, margin + 110, infoY);

  // Tables per shift
  const shifts = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT'];
  const stationOrder = ['NOODLE', 'PRODUKSI', 'BAR', 'DIMSUM'];
  let startY = 33;

  // Image caches - pre-fetch everything BEFORE drawing
  const sigCache: Record<string, string> = {};
  const docPhotoCache: Record<string, string> = {};

  const fetchSigImage = async (url: string): Promise<string | null> => {
    if (!url || url === '-' || !url.startsWith('http')) return null;
    if (sigCache[url]) return sigCache[url];
    try {
      const proxyRes = await apiFetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      if (!proxyRes.ok) return null;
      const data = await proxyRes.json();
      if (data.success && data.dataUrl) { sigCache[url] = data.dataUrl; return data.dataUrl; }
      return null;
    } catch { return null; }
  };

  const fetchDocPhoto = async (url: string): Promise<string | null> => {
    if (!url || url === '-' || !url.startsWith('http')) return null;
    if (docPhotoCache[url]) return docPhotoCache[url];
    try {
      const proxyRes = await apiFetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      if (!proxyRes.ok) return null;
      const data = await proxyRes.json();
      if (data.success && data.dataUrl) {
        const resized = await new Promise<string>((resolve) => {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 236; canvas.height = 236;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 236, 236);
            const scale = Math.max(236 / img.width, 236 / img.height);
            const sw = 236 / scale, sh = 236 / scale;
            const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 236, 236);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = () => resolve(data.dataUrl);
          img.src = data.dataUrl;
        });
        docPhotoCache[url] = resized;
        return resized;
      }
      return null;
    } catch { return null; }
  };

  for (let shiftIdx = 0; shiftIdx < shifts.length; shiftIdx++) {
    const shift = shifts[shiftIdx];
    const shiftData = dayData.grouped[shift] || [];

    doc.setFillColor(200, 200, 200);
    doc.rect(margin, startY, pageWidth - 2 * margin, 6, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`WASTE ${shift}`, margin + 2, startY + 4);
    startY += 7;

    // 11 columns including DOKUMENTASI
    const headers = [['NO', 'NAMA PRODUK', 'KODE PRODUK', 'JUMLAH', 'SATUAN', 'METODE', 'ALASAN', 'JAM', 'QC', 'MANAJER', 'DOKUMENTASI']];

    type RowEntry = { entry: any | null; docUrls: string[]; isTester?: boolean };
    const rowEntries: RowEntry[] = [];
    const rows: string[][] = [];

    // Pre-fetch ALL images for this shift BEFORE drawing table
    const testerEntry = shiftData.find((e: any) => e.station?.toUpperCase() === 'TESTER');
    if (testerEntry) {
      const tQcUrl = extractImageUrl(testerEntry.parafQC);
      const tMgrUrl = extractImageUrl(testerEntry.parafManager);
      if (tQcUrl) await fetchSigImage(tQcUrl);
      if (tMgrUrl) await fetchSigImage(tMgrUrl);
      if (testerEntry.dokumentasi) {
        const tDocUrls = testerEntry.dokumentasi.map((d: string) => extractImageUrl(d)).filter((u: string) => u);
        for (const docUrl of tDocUrls) await fetchDocPhoto(docUrl);
      }
    }
    for (const station of stationOrder) {
      const entry = shiftData.find((e: any) => e.station?.toUpperCase() === station);
      if (entry) {
        const qcUrl = extractImageUrl(entry.parafQC);
        const mgrUrl = extractImageUrl(entry.parafManager);
        if (qcUrl) await fetchSigImage(qcUrl);
        if (mgrUrl) await fetchSigImage(mgrUrl);
        if (entry.dokumentasi) {
          const docUrls = entry.dokumentasi.map((d: string) => extractImageUrl(d)).filter((u: string) => u);
          for (const docUrl of docUrls) await fetchDocPhoto(docUrl);
        }
      }
    }

    // Build rows - Tester first
    if (testerEntry) {
      const testerDocUrls = (testerEntry.dokumentasi || []).map((d: string) => extractImageUrl(d)).filter((u: string) => u);
      rows.push([
        'T',
        String(testerEntry.namaProduk || '-').replace(/,\s*/g, '\n'),
        String(testerEntry.kodeProduk || '-').replace(/,\s*/g, '\n'),
        String(testerEntry.jumlahProduk || '-').replace(/,\s*/g, '\n'),
        String(testerEntry.unit || '-').replace(/,\s*/g, '\n'),
        String(testerEntry.metodePemusnahan || '-').replace(/,\s*/g, '\n'),
        String(testerEntry.alasanPemusnahan || '-').replace(/,\s*/g, '\n'),
        parseJamValue(testerEntry.jamTanggalPemusnahan || '-'),
        '', '', testerDocUrls.length > 0 ? '' : '-'
      ]);
      rowEntries.push({ entry: testerEntry, docUrls: testerDocUrls, isTester: true });
    }

    // Station entries
    stationOrder.forEach((station, idx) => {
      const entry = shiftData.find((e: any) => e.station?.toUpperCase() === station);
      if (entry) {
        const docUrls = (entry.dokumentasi || []).map((d: string) => extractImageUrl(d)).filter((u: string) => u);
        rowEntries.push({ entry, docUrls });
        rows.push([
          (idx + 1).toString(),
          String(entry.namaProduk || '-').replace(/,\s*/g, '\n'),
          String(entry.kodeProduk || '-').replace(/,\s*/g, '\n'),
          String(entry.jumlahProduk || '-').replace(/,\s*/g, '\n'),
          String(entry.unit || '-').replace(/,\s*/g, '\n'),
          String(entry.metodePemusnahan || '-').replace(/,\s*/g, '\n'),
          String(entry.alasanPemusnahan || '-').replace(/,\s*/g, '\n'),
          parseJamValue(entry.jamTanggalPemusnahan || '-'),
          '', '', docUrls.length > 0 ? '' : '-'
        ]);
      } else {
        rowEntries.push({ entry: null, docUrls: [] });
        rows.push([(idx + 1).toString(), '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
      }
    });

    const hasAnyDocPhotos = rowEntries.some(re => re.docUrls.length > 0);

    autoTable(doc, {
      head: headers, body: rows, startY,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5, lineWidth: 0.1, minCellHeight: 8, valign: 'middle' as const },
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' as const, valign: 'middle' as const },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' as const, valign: 'middle' as const },
        1: { cellWidth: hasAnyDocPhotos ? 44 : 48 }, 2: { cellWidth: 26 },
        3: { cellWidth: 16, halign: 'center' as const }, 4: { cellWidth: 18, halign: 'center' as const },
        5: { cellWidth: 23 }, 6: { cellWidth: hasAnyDocPhotos ? 38 : 40 },
        7: { cellWidth: 20 }, 8: { cellWidth: 26, halign: 'center' as const },
        9: { cellWidth: 26, halign: 'center' as const }, 10: { cellWidth: hasAnyDocPhotos ? 30 : 24, halign: 'center' as const },
      },
      tableWidth: pageWidth - 2 * margin, theme: 'grid' as const,
      didParseCell: (data: any) => {
        if (data.section !== 'body') return;
        const rowIdx = data.row.index;
        const rowEntry = rowEntries[rowIdx];
        if (rowEntry?.docUrls?.length > 0) {
          const photoRows = Math.ceil(rowEntry.docUrls.length / 2);
          const photoHeight = photoRows * 14 + (photoRows - 1) * 1 + 3;
          data.cell.styles.minCellHeight = Math.max(data.cell.styles.minCellHeight, photoHeight);
        }
        if (rowEntry?.isTester) {
          const kodeProduk = String(rowEntry.entry?.kodeProduk || '');
          if (kodeProduk.includes('AMAN')) {
            data.cell.styles.fillColor = [220, 240, 220];
          } else {
            data.cell.styles.fillColor = [255, 237, 204];
          }
          data.cell.styles.fontStyle = 'bold';
        }
      },
      // SYNCHRONOUS didDrawCell — images already pre-fetched into cache
      didDrawCell: (data: any) => {
        if (data.section !== 'body') return;
        const rowIdx = data.row.index;
        const colIdx = data.column.index;
        const rowEntry = rowEntries[rowIdx];
        if (!rowEntry?.entry) return;
        const cellX = data.cell.x, cellY = data.cell.y, cellW = data.cell.width, cellH = data.cell.height;

        // QC signature (col 8)
        if (colIdx === 8) {
          const qcUrl = extractImageUrl(rowEntry.entry.parafQC);
          if (qcUrl && sigCache[qcUrl]) {
            try {
              const imgH = Math.min(cellH - 2, 14), imgW = Math.min(cellW - 2, imgH * 2);
              doc.addImage(sigCache[qcUrl], 'PNG', cellX + (cellW - imgW) / 2, cellY + (cellH - imgH) / 2, imgW, imgH);
            } catch {}
          }
        }
        // Manager signature (col 9)
        if (colIdx === 9) {
          const mgrUrl = extractImageUrl(rowEntry.entry.parafManager);
          if (mgrUrl && sigCache[mgrUrl]) {
            try {
              const imgH = Math.min(cellH - 2, 14), imgW = Math.min(cellW - 2, imgH * 2);
              doc.addImage(sigCache[mgrUrl], 'PNG', cellX + (cellW - imgW) / 2, cellY + (cellH - imgH) / 2, imgW, imgH);
            } catch {}
          }
        }
        // Documentation photos (col 10)
        if (colIdx === 10) {
          const docUrls = rowEntry.docUrls || [];
          if (docUrls.length > 0) {
            const padding = 1.5, availW = cellW - (padding * 2), gap = 1, photosPerRow = 2;
            const imgSize = Math.min(13, (availW - gap) / photosPerRow);
            const pRows = Math.ceil(docUrls.length / photosPerRow);
            const totalH = pRows * imgSize + (pRows - 1) * gap;
            let startDrawY = cellY + (cellH - totalH) / 2;
            for (let row = 0; row < pRows; row++) {
              const startIdx = row * photosPerRow;
              const rowPhotos = docUrls.slice(startIdx, startIdx + photosPerRow);
              const rowTotalW = rowPhotos.length * imgSize + (rowPhotos.length - 1) * gap;
              let drawX = cellX + (cellW - rowTotalW) / 2;
              const drawY = startDrawY + row * (imgSize + gap);
              for (const docUrl of rowPhotos) {
                if (docUrl && docPhotoCache[docUrl]) {
                  try { doc.addImage(docPhotoCache[docUrl], 'JPEG', drawX, drawY, imgSize, imgSize); } catch {}
                }
                drawX += imgSize + gap;
              }
            }
          }
        }
      },
    });

    startY = (doc as any).lastAutoTable.finalY + 3;
    if (startY > pageHeight - 30 && shiftIdx < shifts.length - 1) {
      doc.addPage();
      startY = 15;
    }
  }

  // Footer signatures
  if (startY > pageHeight - 45) { doc.addPage(); startY = 15; }
  startY += 8;

  const displayPelapor = pelaporName || 'QC';
  let qcSigImg: string | null = null;
  if (pelaporSigUrl) {
    try {
      const proxyRes = await apiFetch(`/api/proxy-image?url=${encodeURIComponent(pelaporSigUrl)}`);
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data.success && data.dataUrl) qcSigImg = data.dataUrl;
      }
    } catch {}
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Diketahui Oleh :', margin, startY);
  doc.line(margin, startY + 15, margin + 50, startY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text('AM/RM', margin + 12, startY + 20);

  const rightX = pageWidth - margin - 60;
  doc.setFont('helvetica', 'bold');
  doc.text('Dilaporkan oleh : QC', rightX, startY);
  if (qcSigImg) doc.addImage(qcSigImg, 'JPEG', rightX + 10, startY + 2, 30, 10);
  doc.line(rightX, startY + 15, rightX + 55, startY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(displayPelapor, rightX + 5, startY + 20);

  // Disclaimer footer
  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);
  const bottomY = pageHeight - 5;
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(130, 130, 130);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(margin + 30, bottomY - 3.5, pageWidth - margin - 30, bottomY - 3.5);
  doc.text("Data waste ini bersifat Internal & Rahasia serta terjaga keamanannya di database QC.", pageWidth / 2, bottomY, { align: "center" });
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  const blob = doc.output('blob');
  const fileName = `BA_WASTE_${date.replace(/-/g, '')}.pdf`;
  return { blob, fileName };
}

// ==================== COMPONENT ====================

export default function AiAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [pelaporSigUrls, setPelaporSigUrls] = useState<Record<string, string>>({});
  const [selectedPelapor, setSelectedPelapor] = useState<Record<string, string>>({});

  // Chat history state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyPanelRef = useRef<HTMLDivElement>(null);

  // ==================== CHAT HISTORY ====================

  // Load sessions on mount
  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
    // Load most recent session if exists
    if (loaded.length > 0) {
      const latest = loaded[0];
      setCurrentSessionId(latest.id);
      setMessages(deserializeMessages(latest.messages));
    }
  }, []);

  const saveCurrentSession = useCallback((msgs: ChatMessage[]) => {
    if (msgs.length === 0) return;

    const firstUserMsg = msgs.find(m => m.role === 'user');
    const title = firstUserMsg
      ? (firstUserMsg.text.length > 40 ? firstUserMsg.text.slice(0, 40) + '...' : firstUserMsg.text)
      : 'Chat baru';

    setSessions(prev => {
      const sessionId = currentSessionId || `chat_${Date.now()}`;
      if (!currentSessionId) setCurrentSessionId(sessionId);

      const session: ChatSession = {
        id: sessionId,
        title,
        messages: serializeMessages(msgs),
        createdAt: prev.find(s => s.id === sessionId)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const filtered = prev.filter(s => s.id !== sessionId);
      const updated = [session, ...filtered].slice(0, MAX_SESSIONS);
      saveSessions(updated);
      return updated;
    });
  }, [currentSessionId]);

  const startNewChat = useCallback(() => {
    // Save current if has messages
    if (messages.length > 0) {
      saveCurrentSession(messages);
    }
    // Revoke blob URLs
    messages.forEach(m => { if (m.pdfBlobUrl) URL.revokeObjectURL(m.pdfBlobUrl); });
    setMessages([]);
    setCurrentSessionId(null);
    setShowHistory(false);
    inputRef.current?.focus();
  }, [messages, saveCurrentSession]);

  const loadSession = useCallback((session: ChatSession) => {
    // Save current first
    if (messages.length > 0 && currentSessionId) {
      saveCurrentSession(messages);
    }
    messages.forEach(m => { if (m.pdfBlobUrl) URL.revokeObjectURL(m.pdfBlobUrl); });
    setMessages(deserializeMessages(session.messages));
    setCurrentSessionId(session.id);
    setShowHistory(false);
  }, [messages, currentSessionId, saveCurrentSession]);

  const deleteSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      saveSessions(updated);
      return updated;
    });
    if (currentSessionId === sessionId) {
      messages.forEach(m => { if (m.pdfBlobUrl) URL.revokeObjectURL(m.pdfBlobUrl); });
      setMessages([]);
      setCurrentSessionId(null);
    }
  }, [currentSessionId, messages]);

  // Close history panel when clicking outside
  useEffect(() => {
    if (!showHistory) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (historyPanelRef.current && !historyPanelRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory]);

  // Close attach menu when clicking outside
  useEffect(() => {
    if (!showAttachMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAttachMenu]);

  // ==================== FETCH SIGNATURES ====================

  useEffect(() => {
    async function fetchSigs() {
      try {
        const tenantId = localStorage.getItem("waste_app_tenant_id") || "";
        const res = await apiFetch(`/api/signatures?role=qc&tenant_id=${encodeURIComponent(tenantId)}`);
        const data = await res.json();
        if (data.success && data.signatures) setPelaporSigUrls(data.signatures);
      } catch (e) {
        console.error("Failed to load pelapor signatures:", e);
      }
    }
    fetchSigs();
  }, []);

  // ==================== SCROLL ====================

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  // ==================== FILE UPLOAD HANDLERS ====================

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      // Max 3MB per file (Vercel serverless body limit is 4.5MB, base64 adds ~33%)
      if (file.size > 3 * 1024 * 1024) {
        alert(`File "${file.name}" terlalu besar (maks 3MB)`);
        continue;
      }

      if (file.type.startsWith('image/')) {
        const base64 = await fileToBase64(file);
        const previewUrl = URL.createObjectURL(file);
        newAttachments.push({
          type: 'image',
          mimeType: file.type,
          data: base64,
          name: file.name,
          previewUrl,
        });
      } else if (file.type.startsWith('audio/')) {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          type: 'audio',
          mimeType: file.type,
          data: base64,
          name: file.name,
        });
      } else if (
        file.type === 'application/pdf' ||
        file.type === 'application/msword' ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/vnd.ms-excel' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.name.match(/\.(pdf|doc|docx|xls|xlsx)$/i)
      ) {
        // Binary documents - send as base64 inline data
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        newAttachments.push({
          type: 'document',
          mimeType: file.type || 'application/octet-stream',
          data: base64,
          name: file.name,
        });
      } else if (
        file.type.startsWith('text/') ||
        file.name.match(/\.(txt|csv|json|md|log)$/i)
      ) {
        const text = await file.text();
        newAttachments.push({
          type: 'text',
          mimeType: file.type || 'text/plain',
          data: text,
          name: file.name,
        });
      } else {
        alert(`Format file "${file.name}" tidak didukung. Gunakan gambar, audio, dokumen, atau teks.`);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);

    // Reset inputs so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (audioInputRef.current) audioInputRef.current.value = '';
    if (docInputRef.current) docInputRef.current.value = '';
    setShowAttachMenu(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const att = prev[index];
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:xxx;base64, prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ==================== PDF GENERATION ====================

  const handlePdfGenerate = async (msgId: string, date: string) => {
    const pelapor = selectedPelapor[msgId];
    if (!pelapor) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, pdfState: "loading" as const } : m
      )
    );

    try {
      const sigUrl = pelaporSigUrls[pelapor] || undefined;
      const { blob, fileName } = await generateWastePdf(date, pelapor, sigUrl);
      const blobUrl = URL.createObjectURL(blob);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, pdfState: "done" as const, pdfBlobUrl: blobUrl, pdfFileName: fileName }
            : m
        )
      );

      // Also backup to R2
      try {
        const formData = new FormData();
        formData.append('pdfFile', blob, fileName);
        formData.append('fileName', fileName);
        formData.append('mode', 'upload-pdf');
        await apiFetch('/api/auto-submit', { method: 'POST', body: formData });
      } catch {}
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, pdfState: "error" as const, pdfError: err.message || "Gagal generate PDF" }
            : m
        )
      );
    }
  };

  const handlePdfDownload = (blobUrl: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.click();
  };

  // ==================== SEND ====================

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isLoading) return;

    const currentAttachments = [...attachments];
    setAttachments([]);

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      text,
      timestamp: new Date(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      // Strip base64 data from history to avoid huge payloads
      // Only send metadata so AI knows what was shared before
      const history = messages.map((m) => ({
        role: m.role,
        text: m.text,
        attachments: m.attachments?.map(a => ({
          type: a.type,
          name: a.name,
          // Don't send data/mimeType in history - saves bandwidth
        })),
      }));

      const response = await apiFetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history,
          attachments: currentAttachments.length > 0 ? currentAttachments.map(a => ({
            type: a.type,
            mimeType: a.mimeType,
            data: a.data,
            name: a.name,
          })) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Gagal mendapat respons dari AI.");
      }

      // Check for PDF tag
      let replyText = data.reply;
      let pdfDate: string | undefined;
      const pdfMatch = replyText.match(/<<PDF:(\d{4}-\d{2}-\d{2})>>/);
      if (pdfMatch) {
        pdfDate = pdfMatch[1];
        replyText = replyText.replace(/<<PDF:\d{4}-\d{2}-\d{2}>>/g, "").trim();
      }

      const aiMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: "model",
        text: replyText,
        timestamp: new Date(),
        pdfDate,
        pdfState: pdfDate ? "idle" : undefined,
      };

      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);

      // Auto-save to history after AI responds
      saveCurrentSession(finalMessages);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `e_${Date.now()}`,
        role: "model",
        text: err.message || "Terjadi kesalahan. Coba lagi.",
        timestamp: new Date(),
        error: true,
      };
      const finalMessages = [...newMessages, errorMsg];
      setMessages(finalMessages);
      saveCurrentSession(finalMessages);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + "px";
  };

  // ==================== FORMAT ====================

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  // Full markdown renderer
  const renderMarkdown = (text: string) => {
    const blocks = text.split(/(```[\s\S]*?```)/g);
    return blocks.map((block, i) => {
      if (block.startsWith("```") && block.endsWith("```")) {
        const match = block.match(/^```(\w*)\n?([\s\S]*?)```$/);
        const lang = match?.[1] || "";
        const code = match?.[2] || block.slice(3, -3);
        return (
          <div key={i} className="my-3 rounded-xl overflow-hidden border border-[rgba(79,209,255,0.06)]">
            {lang && (
              <div className="px-3.5 py-1.5 bg-[#0D0F13] text-[10px] text-[#9CA3AF]/60 font-mono uppercase tracking-wider border-b border-[rgba(79,209,255,0.06)]">
                {lang}
              </div>
            )}
            <pre className="p-3.5 bg-[#13151A] text-xs font-mono overflow-x-auto text-[#C9CBCF] leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      const lines = block.split("\n");
      const elements: JSX.Element[] = [];
      let listBuffer: { type: "ul" | "ol"; items: string[] } | null = null;

      const flushList = () => {
        if (!listBuffer) return;
        const ListTag = listBuffer.type === "ul" ? "ul" : "ol";
        const listClass = listBuffer.type === "ul"
          ? "list-disc pl-5 my-2 space-y-1"
          : "list-decimal pl-5 my-2 space-y-1";
        elements.push(
          <ListTag key={`list-${elements.length}`} className={listClass}>
            {listBuffer.items.map((item, j) => (
              <li key={j} className="text-sm text-[#D1D5DB] leading-relaxed">
                {renderInline(item)}
              </li>
            ))}
          </ListTag>
        );
        listBuffer = null;
      };

      lines.forEach((line, j) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("### ")) {
          flushList();
          elements.push(<h4 key={`h3-${j}`} className="text-sm font-bold text-[#E5E7EB] mt-3 mb-1.5">{renderInline(trimmed.slice(4))}</h4>);
          return;
        }
        if (trimmed.startsWith("## ")) {
          flushList();
          elements.push(<h3 key={`h2-${j}`} className="text-[15px] font-bold text-[#E5E7EB] mt-3 mb-1.5">{renderInline(trimmed.slice(3))}</h3>);
          return;
        }
        if (trimmed.startsWith("# ")) {
          flushList();
          elements.push(<h2 key={`h1-${j}`} className="text-base font-bold text-[#E5E7EB] mt-3 mb-1.5">{renderInline(trimmed.slice(2))}</h2>);
          return;
        }
        if (/^[-*_]{3,}$/.test(trimmed)) {
          flushList();
          elements.push(<hr key={`hr-${j}`} className="my-3 border-[#222]" />);
          return;
        }
        if (/^[-*•]\s/.test(trimmed)) {
          const item = trimmed.replace(/^[-*•]\s+/, "");
          if (listBuffer && listBuffer.type === "ul") { listBuffer.items.push(item); }
          else { flushList(); listBuffer = { type: "ul", items: [item] }; }
          return;
        }
        if (/^\d+[.)]\s/.test(trimmed)) {
          const item = trimmed.replace(/^\d+[.)]\s+/, "");
          if (listBuffer && listBuffer.type === "ol") { listBuffer.items.push(item); }
          else { flushList(); listBuffer = { type: "ol", items: [item] }; }
          return;
        }
        if (trimmed.startsWith("> ")) {
          flushList();
          elements.push(
            <blockquote key={`bq-${j}`} className="my-2 pl-3.5 border-l-2 border-[#4FD1FF]/25 text-sm text-[#9CA3AF] italic">
              {renderInline(trimmed.slice(2))}
            </blockquote>
          );
          return;
        }
        if (trimmed === "") { flushList(); return; }

        flushList();
        elements.push(<p key={`p-${j}`} className="text-sm text-[#D1D5DB] leading-relaxed my-1">{renderInline(trimmed)}</p>);
      });

      flushList();
      return <div key={i}>{elements}</div>;
    });
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|_.*?_|\*.*?\*|`[^`]+`|\[.*?\]\(.*?\))/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-[#E5E7EB]">{part.slice(2, -2)}</strong>;
      }
      if ((part.startsWith("_") && part.endsWith("_") && part.length > 2) ||
          (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**") && part.length > 2)) {
        return <em key={i} className="italic text-[#D1D5DB]">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="px-1.5 py-0.5 rounded-md bg-[#111] text-[#a78bfa] text-xs font-mono border border-[#222]">{part.slice(1, -1)}</code>;
      }
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-[#4FD1FF] underline underline-offset-2 decoration-[#4FD1FF]/30 hover:decoration-[#4FD1FF]/60 transition-colors">{linkMatch[1]}</a>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // ==================== PDF CARD RENDERER ====================

  const renderPdfCard = (msg: ChatMessage) => {
    if (!msg.pdfDate) return null;

    return (
      <div className="mt-3 rounded-2xl overflow-hidden border border-[#222] bg-[#111]">
        {/* Card header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#1a1a1a]">
          <div className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center border border-[#222]">
            <FileDown className="w-4 h-4 text-[#a78bfa]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#E5E7EB] truncate">
              Laporan Waste
            </p>
            <p className="text-[10px] text-[#9CA3AF]">
              {formatDateDisplay(msg.pdfDate)}
            </p>
          </div>
        </div>

        {/* Card body */}
        <div className="px-4 py-3">
          {msg.pdfState === "idle" && (
            <div className="space-y-3">
              {/* Pelapor selector */}
              <div>
                <p className="text-[10px] text-[#9CA3AF] mb-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> Pilih pelapor (TTD)
                </p>
                {Object.keys(pelaporSigUrls).length === 0 ? (
                  <p className="text-[10px] text-amber-300/70 bg-amber-500/[0.06] border border-[#333] rounded-lg px-3 py-2">
                    Belum ada data QC. Tambah di Settings → QC & Manajer
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(pelaporSigUrls).map(([name, sigUrl]) => {
                      const isActive = selectedPelapor[msg.id] === name;
                      return (
                        <button
                          key={name}
                          onClick={() => setSelectedPelapor(prev => ({ ...prev, [msg.id]: name }))}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-all duration-200 ${
                            isActive
                              ? "border-[#7C3AED]/40 bg-[#7C3AED]/10"
                              : "border-[#222] bg-[#0a0a0a] hover:border-[#333]"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                            isActive ? "bg-[#7C3AED]/15 border border-[#7C3AED]/25" : "bg-[#1a1a1a] border border-[#222]"
                          }`}>
                            <span className={`text-[10px] font-bold ${isActive ? "text-[#a78bfa]" : "text-[#666]"}`}>
                              {name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[10px] font-semibold truncate ${isActive ? "text-[#a78bfa]" : "text-[#ccc]"}`}>{name}</p>
                            {sigUrl && (
                              <p className="text-[8px] text-emerald-400/70 flex items-center gap-0.5">
                                <CheckCircle className="w-2 h-2" /> TTD ✓
                              </p>
                            )}
                          </div>
                          {isActive && <CheckCircle className="w-3 h-3 text-[#a78bfa] flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Signature preview */}
              {selectedPelapor[msg.id] && pelaporSigUrls[selectedPelapor[msg.id]] && (
                <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-lg px-3 py-2 border border-[#222]">
                  <img
                    src={pelaporSigUrls[selectedPelapor[msg.id]]}
                    alt={`TTD ${selectedPelapor[msg.id]}`}
                    className="h-8 rounded bg-white/5 p-0.5"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <p className="text-[10px] text-emerald-400 font-medium">{selectedPelapor[msg.id]}</p>
                </div>
              )}

              <button
                onClick={() => handlePdfGenerate(msg.id, msg.pdfDate!)}
                disabled={!selectedPelapor[msg.id]}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all duration-200
                ${selectedPelapor[msg.id]
                  ? `bg-gradient-to-r from-[#7C3AED] to-[#6366F1]
                     border border-transparent text-white
                     hover:opacity-90
                     active:scale-[0.98]`
                  : `bg-[#1a1a1a] border border-[#222] text-[#555] cursor-not-allowed`
                }`}
              >
                <FileDown className="w-3.5 h-3.5" />
                {selectedPelapor[msg.id] ? "Generate PDF" : "Pilih pelapor dulu ↑"}
              </button>
            </div>
          )}

          {msg.pdfState === "loading" && (
            <div className="flex items-center justify-center gap-2.5 py-2.5">
              <Loader2 className="w-4 h-4 text-[#a78bfa] animate-spin" />
              <span className="text-xs text-[#888]">Generating PDF...</span>
            </div>
          )}

          {msg.pdfState === "done" && msg.pdfBlobUrl && (
            <button
              onClick={() => handlePdfDownload(msg.pdfBlobUrl!, msg.pdfFileName!)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
              bg-emerald-500/15 border border-emerald-500/25 text-xs font-medium text-emerald-400
              hover:bg-emerald-500/20 active:scale-[0.98] transition-all duration-200"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
              <CheckCircle className="w-3 h-3 ml-0.5" />
            </button>
          )}

          {msg.pdfState === "error" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 py-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-300">{msg.pdfError}</span>
              </div>
              <button
                onClick={() => handlePdfGenerate(msg.id, msg.pdfDate!)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl
                bg-[#111] border border-[#222] text-xs text-[#888]
                hover:text-white hover:border-[#333]
                active:scale-[0.98] transition-all duration-200"
              >
                <FileDown className="w-3.5 h-3.5" />
                Coba Lagi
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==================== RENDER ====================

  return (
    <div className="fixed inset-0 lg:left-[240px] z-30 flex flex-col bg-black">
      {/* ===== HEADER ===== */}
      <div className="flex-shrink-0 z-20 bg-black px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] relative">
        <div className="flex items-center justify-between max-w-3xl mx-auto w-full">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-base font-bold text-white tracking-tight flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            AWAS AI <ChevronDown className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`} />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={startNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-[#888]
              hover:text-white transition-colors duration-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chat Baru</span>
            </button>
          </div>
        </div>

        {/* ===== HISTORY PANEL ===== */}
        {showHistory && (
          <div
            ref={historyPanelRef}
            className="absolute top-full left-0 right-0 z-50 mx-4 max-w-3xl lg:mx-auto bg-[#111] border border-[#222] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* History header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#666]" />
                <span className="text-xs font-semibold text-[#999]">Riwayat Chat</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={startNewChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                  bg-[#7C3AED]/10 text-[#a78bfa] border border-[#7C3AED]/20
                  hover:bg-[#7C3AED]/20 transition-all duration-200"
                >
                  <Plus className="w-3 h-3" />
                  Chat Baru
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 rounded-lg text-[#666] hover:text-white hover:bg-[#222] transition-all duration-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* History list */}
            <div className="max-h-[60vh] overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <MessageSquare className="w-8 h-8 text-[#333] mb-3" />
                  <p className="text-xs text-[#555]">Belum ada riwayat chat</p>
                </div>
              ) : (
                <div className="py-1">
                  {sessions.map((session) => {
                    const isActive = session.id === currentSessionId;
                    return (
                      <button
                        key={session.id}
                        onClick={() => loadSession(session)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 group
                        ${isActive
                          ? 'bg-[#7C3AED]/8 border-l-2 border-[#7C3AED]'
                          : 'hover:bg-[#1a1a1a] border-l-2 border-transparent'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium truncate ${isActive ? 'text-[#a78bfa]' : 'text-[#ccc]'}`}>
                            {session.title}
                          </p>
                          <p className="text-[10px] text-[#555] mt-0.5 flex items-center gap-1">
                            <span>{session.messages.length} pesan</span>
                            <span>·</span>
                            <span>{formatRelativeTime(session.updatedAt)}</span>
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteSession(e, session.id)}
                          className="flex-shrink-0 p-1.5 rounded-lg text-[#444] opacity-0 group-hover:opacity-100
                          hover:text-red-400 hover:bg-red-400/10 transition-all duration-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== MESSAGES ===== */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 scroll-smooth"
      >
        <div className="max-w-3xl mx-auto w-full space-y-5 min-h-full">
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-16">
            <h2 className="text-3xl font-bold text-white mb-10">
              Halo, {localStorage.getItem('waste_app_qc_name') || 'there'} 👋
            </h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 w-full max-w-sm lg:max-w-2xl">
              {[
                "💡 Tips mengurangi waste di kitchen",
                "📊 Cara analisis data waste harian",
                "🔒 Standar food safety yang harus dipenuhi",
                "📄 Buatkan PDF waste hari ini",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInput(prompt.replace(/^[^\s]+\s/, ""));
                    inputRef.current?.focus();
                  }}
                  className="text-left text-xs text-[#999] px-3.5 py-3 rounded-2xl
                  bg-[#111] border border-[#222]
                  hover:border-[#444] hover:text-white
                  transition-all duration-200 leading-relaxed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {/* AI Avatar */}
            {msg.role === "model" && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1">
                {msg.error ? (
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#888]" />
                )}
              </div>
            )}

            {/* Message bubble */}
            <div
              className={`text-[14px] leading-[1.6]
              ${
                msg.role === "user"
                  ? `max-w-[75%] lg:max-w-[60%] rounded-2xl rounded-br-sm px-3.5 py-2
                     bg-gradient-to-r from-[#7C3AED] to-[#6366F1] text-white`
                  : msg.error
                  ? `max-w-[85%] lg:max-w-[75%] text-red-300`
                  : `max-w-[85%] lg:max-w-[75%] text-[#ddd]`
              }`}
            >
              <div className="break-words">
                {/* Attachment previews in message */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className={`flex flex-wrap gap-1.5 ${msg.text ? 'mb-2' : ''}`}>
                    {msg.attachments.map((att, i) => (
                      <div key={i}>
                        {att.type === 'image' && att.previewUrl ? (
                          <img src={att.previewUrl} alt={att.name} className="max-w-[200px] max-h-[200px] rounded-lg object-cover" />
                        ) : att.type === 'image' && !att.previewUrl ? (
                          <div className="flex items-center gap-1.5 text-xs opacity-70">
                            <Image className="w-3.5 h-3.5" />
                            <span>{att.name}</span>
                          </div>
                        ) : att.type === 'audio' ? (
                          <div className="flex items-center gap-1.5 text-xs opacity-70">
                            <Mic className="w-3.5 h-3.5" />
                            <span>{att.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs opacity-70">
                            <FileText className="w-3.5 h-3.5" />
                            <span>{att.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {msg.role === "model" ? renderMarkdown(msg.text) : (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>

              {/* PDF Card */}
              {msg.pdfDate && renderPdfCard(msg)}

              <div
                className={`text-[10px] mt-1 ${
                  msg.role === "user"
                    ? "text-white/30 text-right"
                    : "text-[#555]"
                }`}
              >
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1">
              <Sparkles className="w-3.5 h-3.5 text-[#888] animate-pulse" />
            </div>
            <div className="py-2">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#555] animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#555] animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#555] animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => scrollToBottom()}
            className="p-2 rounded-full bg-[#1A1A1A] border border-[#333]
            hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
          >
            <ChevronDown className="w-4 h-4 text-[#888]" />
          </button>
        </div>
      )}

      {/* ===== INPUT AREA ===== */}
      <div className="flex-shrink-0 px-4 pt-2 pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-4">
        <div className="max-w-3xl mx-auto w-full">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {attachments.map((att, i) => (
              <div key={i} className="relative group flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-3 py-2">
                {att.type === 'image' && att.previewUrl ? (
                  <img src={att.previewUrl} alt={att.name} className="w-10 h-10 rounded-lg object-cover" />
                ) : att.type === 'audio' ? (
                  <div className="w-10 h-10 rounded-lg bg-[#7C3AED]/20 flex items-center justify-center">
                    <Mic className="w-4 h-4 text-[#a78bfa]" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#6366F1]/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-[#818cf8]" />
                  </div>
                )}
                <span className="text-xs text-[#999] max-w-[100px] truncate">{att.name}</span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#333] border border-[#444]
                  flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          className="relative flex items-end rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A]
          focus-within:border-[#444] transition-all duration-300 min-h-[48px]"
        >
          {/* Hidden file inputs per category */}
          <input ref={imageInputRef} type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
          <input ref={audioInputRef} type="file" multiple accept="audio/*" onChange={handleFileSelect} className="hidden" />
          <input ref={docInputRef} type="file" multiple accept=".txt,.csv,.json,.md,.log,.pdf,.doc,.docx,.xls,.xlsx,text/*,application/pdf" onChange={handleFileSelect} className="hidden" />

          {/* Plus button with category menu */}
          <div className="relative flex-shrink-0" ref={attachMenuRef}>
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className={`w-9 h-9 m-1 mb-[5px] flex items-center justify-center
              transition-all duration-200 ${showAttachMenu ? 'text-white rotate-45' : 'text-[#666] hover:text-white'}`}
              title="Lampirkan file"
            >
              <Plus className="w-4 h-4 stroke-[2.5] transition-transform duration-200" />
            </button>

            {/* Category popup menu */}
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1A1A1A] border border-[#333] rounded-xl
                shadow-xl shadow-black/40 overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50">
                <button
                  onClick={() => { imageInputRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-[#252525] hover:text-white transition-colors"
                >
                  <Image className="w-4 h-4 text-purple-400" />
                  <span>Gambar</span>
                </button>
                <button
                  onClick={() => { audioInputRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-[#252525] hover:text-white transition-colors"
                >
                  <Mic className="w-4 h-4 text-green-400" />
                  <span>Audio</span>
                </button>
                <div className="border-t border-[#2A2A2A]" />
                <button
                  onClick={() => { docInputRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-[#252525] hover:text-white transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>File / Dokumen</span>
                </button>
              </div>
            )}
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan..."
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent text-[14px] text-white placeholder-[#555]
            resize-none outline-none py-3 pr-1 max-h-[120px] leading-[1.5]
            disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={(!input.trim() && attachments.length === 0) || isLoading}
            className={`flex-shrink-0 w-9 h-9 m-1 mb-[5px] rounded-xl flex items-center justify-center
            transition-all duration-200
            ${
              (input.trim() || attachments.length > 0) && !isLoading
                ? `bg-gradient-to-br from-[#7C3AED] to-[#6366F1] text-white
                   hover:opacity-90 active:scale-95`
                : `text-[#555] cursor-not-allowed`
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[#444] text-center mt-2.5">
          AWAS AI · Selalu verifikasi info penting
        </p>
        </div>
      </div>
    </div>
  );
}
