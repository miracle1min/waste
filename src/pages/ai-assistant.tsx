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
} from "lucide-react";

// ==================== TYPES ====================

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
  error?: boolean;
  pdfDate?: string; // If set, this message has a PDF to generate
  pdfState?: "idle" | "loading" | "done" | "error";
  pdfBlobUrl?: string;
  pdfFileName?: string;
  pdfError?: string;
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
          const img = new Image();
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const history = messages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const response = await apiFetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
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

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `e_${Date.now()}`,
        role: "model",
        text: err.message || "Terjadi kesalahan. Coba lagi.",
        timestamp: new Date(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
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

  const clearChat = () => {
    // Revoke blob URLs
    messages.forEach((m) => {
      if (m.pdfBlobUrl) URL.revokeObjectURL(m.pdfBlobUrl);
    });
    setMessages([]);
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
    <div className="flex flex-col h-dvh max-w-3xl mx-auto relative bg-black">
      {/* ===== HEADER ===== */}
      <div className="sticky top-0 z-20 bg-black px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1">
            AWAS AI <ChevronDown className="w-3.5 h-3.5 text-white/50" />
          </h1>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-[#888]
                hover:text-red-400 transition-colors duration-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hapus</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== MESSAGES ===== */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-5 scroll-smooth"
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-16">
            <h2 className="text-3xl font-bold text-white mb-10">
              How can I help?
            </h2>

            <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
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
            className={`flex items-start gap-2.5 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {/* AI Avatar */}
            {msg.role === "model" && (
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5
                ${
                  msg.error
                    ? "bg-red-500/10"
                    : "bg-transparent"
                }`}
              >
                {msg.error ? (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#aaa]" />
                )}
              </div>
            )}

            {/* Message bubble */}
            <div
              className={`text-sm leading-relaxed
              ${
                msg.role === "user"
                  ? `max-w-[78%] rounded-3xl px-4 py-2.5
                     bg-gradient-to-r from-[#7C3AED] to-[#6366F1] text-white`
                  : msg.error
                  ? `max-w-[88%] rounded-3xl px-4 py-3
                     bg-transparent text-red-300`
                  : `max-w-[88%] rounded-3xl px-1 py-1
                     bg-transparent text-[#ddd]`
              }`}
            >
              <div className="break-words">
                {msg.role === "model" ? renderMarkdown(msg.text) : (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>

              {/* PDF Card */}
              {msg.pdfDate && renderPdfCard(msg)}

              <div
                className={`text-[10px] mt-1.5 ${
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
          <div className="flex items-start gap-2.5 justify-start">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-full
              flex items-center justify-center mt-0.5"
            >
              <Sparkles className="w-4 h-4 text-[#aaa] animate-pulse" />
            </div>
            <div className="rounded-3xl px-4 py-3">
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
      <div className="flex-shrink-0 px-4 pt-2 pb-24 lg:pb-4">
        <div
          className="relative flex items-end rounded-full bg-[#1A1A1A] border border-[#2A2A2A]
          focus-within:border-[#444] transition-all duration-300"
        >
          <div className="flex-shrink-0 pl-3 pb-2.5">
            <button className="w-8 h-8 rounded-full bg-[#2A2A2A] flex items-center justify-center
              text-[#888] hover:text-white hover:bg-[#333] transition-colors duration-200">
              <Plus className="w-4 h-4 stroke-[2]" />
            </button>
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="How can I help you today?"
            rows={1}
            disabled={isLoading}
            className="w-full bg-transparent text-sm text-white placeholder-[#666]
            resize-none outline-none px-3 py-3.5 max-h-[140px] leading-relaxed
            disabled:opacity-50"
          />
          <div className="flex-shrink-0 pr-2 pb-2.5">
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className={`w-9 h-9 rounded-full flex items-center justify-center
              transition-all duration-200
              ${
                input.trim() && !isLoading
                  ? `bg-gradient-to-br from-[#7C3AED] to-[#6366F1] text-white
                     hover:opacity-90 active:scale-95`
                  : `bg-[#2A2A2A] text-[#555] cursor-not-allowed`
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-[#444] text-center mt-2.5">
          AWAS AI · Selalu verifikasi info penting
        </p>
      </div>
    </div>
  );
}
