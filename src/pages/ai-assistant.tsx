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
  FileDown,
  Download,
  CheckCircle,
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

async function generateWastePdf(date: string): Promise<{ blob: Blob; fileName: string }> {
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
  const margin = 10;

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
  doc.text(`Store: ${dayData.storeName || '-'}`, margin + 110, infoY);

  // Tables per shift
  const shifts = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT'];
  const stationOrder = ['NOODLE', 'PRODUKSI', 'BAR', 'DIMSUM'];
  let startY = 33;

  // Sig image cache
  const sigCache: Record<string, string> = {};
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

  for (const shift of shifts) {
    const shiftData = dayData.grouped[shift] || [];
    const pageHeight = doc.internal.pageSize.getHeight();

    if (startY > pageHeight - 30) {
      doc.addPage();
      startY = 15;
    }

    // Shift header
    doc.setFillColor(200, 200, 200);
    doc.rect(margin, startY, pageWidth - 2 * margin, 6, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`WASTE ${shift}`, margin + 2, startY + 4);
    startY += 7;

    const headers = [['NO', 'NAMA PRODUK', 'KODE PRODUK', 'JUMLAH', 'SATUAN', 'METODE', 'ALASAN', 'JAM', 'QC', 'MANAJER']];
    const rows: string[][] = [];

    type RowEntry = { entry: any | null; isTester?: boolean };
    const rowEntries: RowEntry[] = [];

    // Tester entry first
    const testerEntry = shiftData.find((e: any) => e.station?.toUpperCase() === 'TESTER');
    if (testerEntry) {
      rows.push([
        'T',
        String(testerEntry.namaProduk || '-').replace(/,\s*/g, '\n'),
        String(testerEntry.kodeProduk || '-').replace(/,\s*/g, '\n'),
        String(testerEntry.jumlahProduk || '-').replace(/,\s*/g, '\n'),
        String(testerEntry.unit || '-').replace(/,\s*/g, '\n'),
        String(testerEntry.metodePemusnahan || '-').replace(/,\s*/g, '\n'),
        String(testerEntry.alasanPemusnahan || '-').replace(/,\s*/g, '\n'),
        parseJamValue(testerEntry.jamTanggalPemusnahan || '-'),
        '', ''
      ]);
      rowEntries.push({ entry: testerEntry, isTester: true });
    }

    // Station entries
    stationOrder.forEach((station, idx) => {
      const entry = shiftData.find((e: any) => e.station?.toUpperCase() === station);
      if (entry) {
        rowEntries.push({ entry });
        rows.push([
          (idx + 1).toString(),
          String(entry.namaProduk || '-').replace(/,\s*/g, '\n'),
          String(entry.kodeProduk || '-').replace(/,\s*/g, '\n'),
          String(entry.jumlahProduk || '-').replace(/,\s*/g, '\n'),
          String(entry.unit || '-').replace(/,\s*/g, '\n'),
          String(entry.metodePemusnahan || '-').replace(/,\s*/g, '\n'),
          String(entry.alasanPemusnahan || '-').replace(/,\s*/g, '\n'),
          parseJamValue(entry.jamTanggalPemusnahan || '-'),
          '', ''
        ]);
      } else {
        rowEntries.push({ entry: null });
        rows.push([(idx + 1).toString(), '-', '-', '-', '-', '-', '-', '-', '-', '-']);
      }
    });

    autoTable(doc, {
      head: headers, body: rows, startY,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5, lineWidth: 0.1, minCellHeight: 8, valign: 'middle' as const },
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' as const, valign: 'middle' as const },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' as const },
        1: { cellWidth: 50 }, 2: { cellWidth: 30 },
        3: { cellWidth: 18, halign: 'center' as const }, 4: { cellWidth: 20, halign: 'center' as const },
        5: { cellWidth: 28 }, 6: { cellWidth: 42 },
        7: { cellWidth: 22 }, 8: { cellWidth: 28, halign: 'center' as const },
        9: { cellWidth: 28, halign: 'center' as const },
      },
      tableWidth: pageWidth - 2 * margin, theme: 'grid' as const,
      didDrawCell: async (data: any) => {
        if (data.section !== 'body') return;
        const rowIdx = data.row.index;
        const colIdx = data.column.index;
        const rowEntry = rowEntries[rowIdx];
        if (!rowEntry?.entry) return;

        // QC signature (col 8) and Manager signature (col 9)
        if (colIdx === 8 || colIdx === 9) {
          const url = colIdx === 8
            ? extractImageUrl(rowEntry.entry.parafQC)
            : extractImageUrl(rowEntry.entry.parafManager);
          if (url) {
            const sigImg = await fetchSigImage(url);
            if (sigImg) {
              try {
                const imgSize = Math.min(data.cell.width - 2, data.cell.height - 2, 12);
                const x = data.cell.x + (data.cell.width - imgSize) / 2;
                const y = data.cell.y + (data.cell.height - imgSize) / 2;
                doc.addImage(sigImg, 'PNG', x, y, imgSize, imgSize);
              } catch {}
            }
          }
        }
      },
    });

    startY = (doc as any).lastAutoTable?.finalY + 5 || startY + 40;
  }

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generated by AWAS AI · ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });

  const blob = doc.output('blob');
  const fileName = `waste-report-${date}.pdf`;
  return { blob, fileName };
}

// ==================== COMPONENT ====================

export default function AiAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, pdfState: "loading" as const } : m
      )
    );

    try {
      const { blob, fileName } = await generateWastePdf(date);
      const blobUrl = URL.createObjectURL(blob);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, pdfState: "done" as const, pdfBlobUrl: blobUrl, pdfFileName: fileName }
            : m
        )
      );
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

      // Auto-start PDF generation
      if (pdfDate) {
        setTimeout(() => handlePdfGenerate(aiMsg.id, pdfDate!), 300);
      }
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
          elements.push(<hr key={`hr-${j}`} className="my-3 border-[rgba(79,209,255,0.08)]" />);
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
        return <code key={i} className="px-1.5 py-0.5 rounded-md bg-[#13151A] text-[#4FD1FF] text-xs font-mono border border-[rgba(79,209,255,0.08)]">{part.slice(1, -1)}</code>;
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
      <div className="mt-3 rounded-2xl overflow-hidden border border-[rgba(79,209,255,0.12)] bg-[#1A1C22]/80">
        {/* Card header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[rgba(79,209,255,0.06)]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4FD1FF]/15 to-[#9F7AEA]/15 flex items-center justify-center border border-[rgba(79,209,255,0.1)]">
            <FileDown className="w-4 h-4 text-[#4FD1FF]" />
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
            <button
              onClick={() => handlePdfGenerate(msg.id, msg.pdfDate!)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
              bg-gradient-to-r from-[#4FD1FF]/15 to-[#9F7AEA]/10
              border border-[rgba(79,209,255,0.15)] text-xs font-medium text-[#4FD1FF]
              shadow-[3px_3px_8px_rgba(0,0,0,0.3),-1px_-1px_4px_rgba(255,255,255,0.02)]
              hover:-translate-y-0.5 hover:shadow-[3px_3px_8px_rgba(0,0,0,0.3),0_0_12px_rgba(79,209,255,0.1)]
              active:translate-y-0 active:scale-[0.98] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]
              transition-all duration-200"
            >
              <FileDown className="w-3.5 h-3.5" />
              Generate PDF
            </button>
          )}

          {msg.pdfState === "loading" && (
            <div className="flex items-center justify-center gap-2.5 py-2.5">
              <Loader2 className="w-4 h-4 text-[#4FD1FF] animate-spin" />
              <span className="text-xs text-[#9CA3AF]">Generating PDF...</span>
            </div>
          )}

          {msg.pdfState === "done" && msg.pdfBlobUrl && (
            <button
              onClick={() => handlePdfDownload(msg.pdfBlobUrl!, msg.pdfFileName!)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
              bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400
              shadow-[3px_3px_8px_rgba(0,0,0,0.3),-1px_-1px_4px_rgba(255,255,255,0.02)]
              hover:-translate-y-0.5 hover:shadow-[3px_3px_8px_rgba(0,0,0,0.3),0_0_12px_rgba(16,185,129,0.1)]
              active:translate-y-0 active:scale-[0.98] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]
              transition-all duration-200"
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
                bg-[#23262F] border border-[rgba(255,255,255,0.06)] text-xs text-[#9CA3AF]
                hover:text-[#E5E7EB] hover:border-[rgba(79,209,255,0.12)]
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
    <div className="flex flex-col h-[calc(100dvh-64px)] lg:h-screen max-w-3xl mx-auto relative">
      {/* ===== STICKY HEADER ===== */}
      <div className="sticky top-0 z-20 bg-[#1A1C22]/95 backdrop-blur-md px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#4FD1FF]/20 to-[#9F7AEA]/20
              flex items-center justify-center border border-[rgba(79,209,255,0.15)]
              shadow-[4px_4px_10px_rgba(0,0,0,0.35),-2px_-2px_6px_rgba(255,255,255,0.02)]"
            >
              <Sparkles className="w-5 h-5 text-[#4FD1FF]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#E5E7EB] tracking-tight">
                AWAS AI
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[11px] text-[#9CA3AF]">
                  Online · Siap membantu
                </p>
              </div>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[#9CA3AF]
              bg-[#23262F] border border-[rgba(255,255,255,0.04)]
              shadow-[3px_3px_8px_rgba(0,0,0,0.3),-1px_-1px_4px_rgba(255,255,255,0.02)]
              hover:text-red-400 hover:border-red-500/15 hover:bg-red-500/5
              active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)] active:scale-[0.97]
              transition-all duration-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hapus</span>
            </button>
          )}
        </div>
        <div className="mt-3 h-px bg-gradient-to-r from-transparent via-[rgba(79,209,255,0.12)] to-transparent" />
      </div>

      {/* ===== MESSAGES ===== */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scroll-smooth"
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-8">
            <div
              className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-[#4FD1FF]/10 to-[#9F7AEA]/10
              flex items-center justify-center mb-5 border border-[rgba(79,209,255,0.1)]
              shadow-[8px_8px_16px_rgba(0,0,0,0.4),-4px_-4px_10px_rgba(255,255,255,0.02)]"
            >
              <Bot className="w-8 h-8 text-[#4FD1FF]" />
            </div>
            <h2 className="text-lg font-bold text-[#E5E7EB] mb-1.5">
              Hai! Gw AWAS AI 👋
            </h2>
            <p className="text-sm text-[#9CA3AF] max-w-sm mb-8 leading-relaxed">
              Asisten cerdas buat bantu kamu soal waste management, food safety,
              dan penggunaan aplikasi AWAS.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md">
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
                  className="text-left text-xs text-[#9CA3AF] px-4 py-3 rounded-2xl
                  bg-[#23262F] border border-[rgba(255,255,255,0.04)]
                  shadow-[4px_4px_10px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(255,255,255,0.02)]
                  hover:border-[rgba(79,209,255,0.15)] hover:text-[#E5E7EB] hover:bg-[#272A33]
                  hover:-translate-y-0.5 active:translate-y-0 active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]
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
            className={`flex items-end gap-2.5 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {/* AI Avatar */}
            {msg.role === "model" && (
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
                ${
                  msg.error
                    ? "bg-red-500/10 border border-red-500/15"
                    : "bg-gradient-to-br from-[#4FD1FF]/12 to-[#9F7AEA]/12 border border-[rgba(79,209,255,0.1)]"
                }
                shadow-[3px_3px_6px_rgba(0,0,0,0.25)]`}
              >
                {msg.error ? (
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#4FD1FF]" />
                )}
              </div>
            )}

            {/* Message bubble */}
            <div
              className={`text-sm leading-relaxed
              ${
                msg.role === "user"
                  ? `max-w-[78%] rounded-[20px] rounded-br-md px-4 py-3
                     bg-gradient-to-br from-[#4FD1FF]/18 to-[#4FD1FF]/8
                     border border-[rgba(79,209,255,0.18)] text-[#E5E7EB]
                     shadow-[5px_5px_12px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(79,209,255,0.03)]`
                  : msg.error
                  ? `max-w-[88%] rounded-[20px] rounded-bl-md px-4 py-3
                     bg-red-500/5 border border-red-500/15 text-red-300`
                  : `max-w-[88%] rounded-[20px] rounded-bl-md px-4 py-3.5
                     bg-[#23262F] border border-[rgba(255,255,255,0.04)] text-[#D1D5DB]
                     shadow-[5px_5px_12px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(255,255,255,0.015)]`
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
                className={`text-[10px] mt-2 ${
                  msg.role === "user"
                    ? "text-[#4FD1FF]/35 text-right"
                    : "text-[#9CA3AF]/40"
                }`}
              >
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-end gap-2.5 justify-start">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-[#4FD1FF]/12 to-[#9F7AEA]/12
              flex items-center justify-center border border-[rgba(79,209,255,0.1)]
              shadow-[3px_3px_6px_rgba(0,0,0,0.25)]"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#4FD1FF] animate-pulse" />
            </div>
            <div
              className="rounded-[20px] rounded-bl-md px-5 py-3.5 bg-[#23262F] border border-[rgba(255,255,255,0.04)]
              shadow-[5px_5px_12px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(255,255,255,0.015)]"
            >
              <div className="flex items-center gap-1.5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#4FD1FF]/40 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-[#4FD1FF]/40 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-[#4FD1FF]/40 animate-bounce [animation-delay:300ms]" />
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
            className="p-2.5 rounded-full bg-[#23262F]/90 backdrop-blur-sm border border-[rgba(79,209,255,0.12)]
            shadow-[4px_4px_10px_rgba(0,0,0,0.4)]
            hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
          >
            <ChevronDown className="w-4 h-4 text-[#4FD1FF]" />
          </button>
        </div>
      )}

      {/* ===== MODERN INPUT AREA ===== */}
      <div className="flex-shrink-0 px-4 pt-2 pb-4">
        <div
          className="relative rounded-[20px] bg-[#23262F] border border-[rgba(255,255,255,0.05)]
          shadow-[6px_6px_14px_rgba(0,0,0,0.4),-3px_-3px_8px_rgba(255,255,255,0.02)]
          focus-within:border-[rgba(79,209,255,0.2)] focus-within:shadow-[6px_6px_14px_rgba(0,0,0,0.4),-3px_-3px_8px_rgba(255,255,255,0.02),0_0_0_1px_rgba(79,209,255,0.08)]
          transition-all duration-300"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan..."
            rows={1}
            disabled={isLoading}
            className="w-full bg-transparent text-sm text-[#E5E7EB] placeholder-[#9CA3AF]/40
            resize-none outline-none pl-5 pr-14 py-4 max-h-[140px] leading-relaxed
            disabled:opacity-50"
          />
          <div className="absolute right-2.5 bottom-2.5">
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className={`w-9 h-9 rounded-xl flex items-center justify-center
              transition-all duration-200
              ${
                input.trim() && !isLoading
                  ? `bg-[#4FD1FF] text-[#1A1C22]
                     shadow-[3px_3px_8px_rgba(0,0,0,0.3),0_0_12px_rgba(79,209,255,0.15)]
                     hover:shadow-[3px_3px_8px_rgba(0,0,0,0.3),0_0_20px_rgba(79,209,255,0.25)]
                     hover:scale-105 active:scale-95 active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.25)]`
                  : `bg-[#2A2D37] text-[#9CA3AF]/30 cursor-not-allowed`
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
        <p className="text-[10px] text-[#9CA3AF]/30 text-center mt-2.5">
          AWAS AI · Selalu verifikasi info penting
        </p>
      </div>
    </div>
  );
}
