import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useMemo } from "react";
import {
  FileDown, Calendar, Download, Loader2, FileText,
  CheckSquare, Square, BarChart3, Store, User, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import wasteLogo from "@assets/waste-logo_1753322218969.webp";

// ==================== PDF GENERATION HELPERS ====================
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

function parseTabDate(tab: string): Date | null {
  const m = tab.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  return new Date(2000 + parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

function formatTabDate(tab: string): { display: string; dayName: string; fullDate: string } {
  const d = parseTabDate(tab);
  if (!d || isNaN(d.getTime())) return { display: tab, dayName: '?', fullDate: tab };
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  return {
    display: `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`,
    dayName: days[d.getDay()],
    fullDate: `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`,
  };
}

async function generatePdfForDate(
  date: string,
  storeName: string,
  onProgress?: (msg: string) => void,
  pelaporName?: string,
  pelaporSigUrl?: string,
  onDetailProgress?: (current: number, total: number, phase: string) => void
): Promise<{ blob: Blob; fileName: string } | null> {
  onProgress?.(`Ngambil data ${date}...`);
  
  const res = await apiFetch(`/api/get-day-data?date=${date}`);
  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`API error ${res.status}: ${errText}`);
  }
  const dayData = await res.json();
  if (!dayData.success || !dayData.grouped) {
    throw new Error(`Data kosong: success=${dayData.success}, error=${dayData.error || 'none'}`);
  }

  onProgress?.(`Bikin PDF ${date}...`);

  let jsPDF: any;
  let autoTable: any;
  try {
    jsPDF = (await import('jspdf')).default;
    autoTable = (await import('jspdf-autotable')).default;
  } catch (e: any) {
    if (e?.message?.includes('dynamically imported module') || e?.message?.includes('Failed to fetch')) {
      window.location.reload();
      return null;
    }
    throw e;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
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

  // Info line
  const dateObj = new Date(date + 'T00:00:00');
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = dayNames[dateObj.getDay()];
  const dateDisplay = `${dateObj.getDate().toString().padStart(2,'0')}/${(dateObj.getMonth()+1).toString().padStart(2,'0')}/${dateObj.getFullYear()}`;
  
  doc.setFontSize(9);
  const infoY = 28;
  doc.text(`Hari: ${dayName}`, margin, infoY);
  doc.text(`Tanggal: ${dateDisplay}`, margin + 50, infoY);
  doc.text(`Store: ${dayData.storeName || storeName}`, margin + 110, infoY);

  // Tables
  const shifts = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT'];
  const stationOrder = ['NOODLE', 'PRODUKSI', 'BAR', 'DIMSUM'];
  let startY = 33;

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

    const headers = [['NO', 'NAMA PRODUK', 'KODE PRODUK', 'JUMLAH', 'SATUAN', 'METODE', 'ALASAN', 'JAM', 'QC', 'MANAJER', 'DOKUMENTASI']];

    const allDocUrlsForShift: string[] = [];
    for (const station of stationOrder) {
      const entry = shiftData.find((e: any) => e.station?.toUpperCase() === station);
      if (entry?.dokumentasi) {
        const urls = entry.dokumentasi.map((d: string) => extractImageUrl(d)).filter((u: string) => u);
        allDocUrlsForShift.push(...urls);
      }
    }
    let fetchedCount = 0;
    const totalPhotos = allDocUrlsForShift.length;

    for (const station of stationOrder) {
      const entry = shiftData.find((e: any) => e.station?.toUpperCase() === station);
      if (entry) {
        const qcUrl = extractImageUrl(entry.parafQC);
        const mgrUrl = extractImageUrl(entry.parafManager);
        if (qcUrl) await fetchSigImage(qcUrl);
        if (mgrUrl) await fetchSigImage(mgrUrl);
        if (entry.dokumentasi) {
          const docUrls = entry.dokumentasi.map((d: string) => extractImageUrl(d)).filter((u: string) => u);
          for (const docUrl of docUrls) {
            await fetchDocPhoto(docUrl);
            fetchedCount++;
            onProgress?.(`📸 ${shift} - Foto ${fetchedCount}/${totalPhotos}`);
            onDetailProgress?.(fetchedCount, totalPhotos, `foto_${shift}`);
          }
        }
      }
    }

    type RowEntry = { entry: any | null; stationIdx: number; docUrls: string[] };
    const rowEntries: RowEntry[] = [];
    const rows: string[][] = [];

    stationOrder.forEach((station, idx) => {
      const entry = shiftData.find((e: any) => e.station?.toUpperCase() === station);
      if (entry) {
        const namaProduk = String(entry.namaProduk || '-').replace(/,\s*/g, '\n');
        const kodeProduk = String(entry.kodeProduk || '-').replace(/,\s*/g, '\n');
        const jumlahProduk = String(entry.jumlahProduk || '-').replace(/,\s*/g, '\n');
        const satuan = String(entry.unit || '-').replace(/,\s*/g, '\n');
        const metode = String(entry.metodePemusnahan || '-').replace(/,\s*/g, '\n');
        const alasan = String(entry.alasanPemusnahan || '-').replace(/,\s*/g, '\n');
        const docUrls = (entry.dokumentasi || []).map((d: string) => extractImageUrl(d)).filter((u: string) => u);
        rowEntries.push({ entry, stationIdx: idx, docUrls });
        rows.push([
          (idx + 1).toString(), namaProduk, kodeProduk, jumlahProduk, satuan,
          metode, alasan, parseJamValue(entry.jamTanggalPemusnahan || '-'),
          '', '', docUrls.length > 0 ? '' : '-',
        ]);
      } else {
        rowEntries.push({ entry: null, stationIdx: idx, docUrls: [] });
        rows.push([(idx + 1).toString(), '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
      }
    });

    const hasAnyDocPhotos = rowEntries.some(re => re.docUrls.length > 0);

    autoTable(doc, {
      head: headers, body: rows, startY,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5, lineWidth: 0.1, minCellHeight: 8, valign: 'middle' },
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center', valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', valign: 'middle' },
        1: { cellWidth: hasAnyDocPhotos ? 44 : 48 }, 2: { cellWidth: 26 },
        3: { cellWidth: 16, halign: 'center' }, 4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 23 }, 6: { cellWidth: hasAnyDocPhotos ? 38 : 40 },
        7: { cellWidth: 20 }, 8: { cellWidth: 26, halign: 'center' },
        9: { cellWidth: 26, halign: 'center' }, 10: { cellWidth: hasAnyDocPhotos ? 30 : 24, halign: 'center' },
      },
      tableWidth: pageWidth - 2 * margin, theme: 'grid',
      didParseCell: (data: any) => {
        if (data.section !== 'body') return;
        const rowIdx = data.row.index;
        const rowEntry = rowEntries[rowIdx];
        if (rowEntry?.docUrls?.length > 0) {
          const photoRows = Math.ceil(rowEntry.docUrls.length / 2);
          const photoHeight = photoRows * 14 + (photoRows - 1) * 1 + 3;
          data.cell.styles.minCellHeight = Math.max(data.cell.styles.minCellHeight, photoHeight);
        }
      },
      didDrawCell: (data: any) => {
        if (data.section !== 'body') return;
        const rowIdx = data.row.index;
        const colIdx = data.column.index;
        const rowEntry = rowEntries[rowIdx];
        if (!rowEntry?.entry) return;
        const cellX = data.cell.x, cellY = data.cell.y, cellW = data.cell.width, cellH = data.cell.height;

        if (colIdx === 8) {
          const qcUrl = extractImageUrl(rowEntry.entry.parafQC);
          if (qcUrl && sigCache[qcUrl]) {
            try {
              const imgH = Math.min(cellH - 2, 14), imgW = Math.min(cellW - 2, imgH * 2);
              doc.addImage(sigCache[qcUrl], 'PNG', cellX + (cellW - imgW) / 2, cellY + (cellH - imgH) / 2, imgW, imgH);
            } catch {}
          }
        }
        if (colIdx === 9) {
          const mgrUrl = extractImageUrl(rowEntry.entry.parafManager);
          if (mgrUrl && sigCache[mgrUrl]) {
            try {
              const imgH = Math.min(cellH - 2, 14), imgW = Math.min(cellW - 2, imgH * 2);
              doc.addImage(sigCache[mgrUrl], 'PNG', cellX + (cellW - imgW) / 2, cellY + (cellH - imgH) / 2, imgW, imgH);
            } catch {}
          }
        }
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

  // Disclaimer
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

  const fileName = `BA_WASTE_${date.replace(/-/g, '')}.pdf`;
  return { blob: doc.output('blob'), fileName };
}

// ==================== PDF PAGE COMPONENT ====================
export default function PdfDownload() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedPdfDates, setSelectedPdfDates] = useState<Set<string>>(new Set());
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [pdfProgressNum, setPdfProgressNum] = useState({ current: 0, total: 0 });
  const [photoProgress, setPhotoProgress] = useState({ current: 0, total: 0, phase: '' });
  const [selectedPelapor, setSelectedPelapor] = useState<string>("");
  const [pelaporSigUrls, setPelaporSigUrls] = useState<Record<string, string>>({});
  const [loadingSignatures, setLoadingSignatures] = useState(true);
  const [range, setRange] = useState<"30" | "60" | "all">("30");

  const tenantName = localStorage.getItem("waste_app_tenant_name") || "";
  const userName = localStorage.getItem("waste_app_qc_name") || "User";

  // Fetch available dates
  useEffect(() => {
    async function fetchDates() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (range !== "all") {
          const end = new Date();
          const start = new Date();
          start.setDate(end.getDate() - parseInt(range));
          params.set("startDate", start.toISOString().split("T")[0]);
          params.set("endDate", end.toISOString().split("T")[0]);
        }
        const res = await apiFetch(`/api/dashboard-data?${params}`);
        const json = await res.json();
        if (json.success) {
          setAvailableDates(json.availableDates || []);
        }
      } catch {
        toast({ title: "Error", description: "Gagal load daftar tanggal", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    fetchDates();
  }, [range]);

  // Fetch signatures
  useEffect(() => {
    async function fetchSigs() {
      try {
        const tenantId = localStorage.getItem("waste_app_tenant_id") || "";
        const res = await apiFetch(`/api/signatures?role=qc&tenant_id=${encodeURIComponent(tenantId)}`);
        const data = await res.json();
        if (data.success && data.signatures) setPelaporSigUrls(data.signatures);
      } catch (e) {
        console.error("Failed to load pelapor signatures:", e);
      } finally {
        setLoadingSignatures(false);
      }
    }
    fetchSigs();
  }, []);

  const togglePdfDate = (date: string) => {
    setSelectedPdfDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const toggleAllPdfDates = () => {
    if (selectedPdfDates.size === availableDates.length) {
      setSelectedPdfDates(new Set());
    } else {
      setSelectedPdfDates(new Set(availableDates));
    }
  };

  const handleBatchPdf = async () => {
    if (selectedPdfDates.size === 0) return;
    if (!selectedPelapor) {
      toast({ title: "👤 Pilih Pelapor", description: "Pilih nama pelapor dulu ya buat TTD di PDF", variant: "destructive" });
      return;
    }
    setPdfGenerating(true);
    const dates = Array.from(selectedPdfDates).sort();
    const storeName = localStorage.getItem('waste_app_store') || 'Store';
    let successCount = 0, failCount = 0, lastError = '';
    setPdfProgressNum({ current: 0, total: dates.length });

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      setPdfProgressNum({ current: i + 1, total: dates.length });
      try {
        const { fullDate } = formatTabDate(date);
        const result = await generatePdfForDate(
          fullDate || date, storeName,
          (msg) => setPdfProgress(msg),
          selectedPelapor, pelaporSigUrls[selectedPelapor],
          (current, total, phase) => setPhotoProgress({ current, total, phase })
        );
        if (result) {
          const url = URL.createObjectURL(result.blob);
          const a = document.createElement('a');
          a.href = url; a.download = result.fileName; a.click();
          URL.revokeObjectURL(url);
          successCount++;
          // Backup to R2
          try {
            setPdfProgress(`☁️ Backup ${result.fileName} ke cloud...`);
            const formData = new FormData();
            formData.append('pdfFile', result.blob, result.fileName);
            formData.append('fileName', result.fileName);
            formData.append('mode', 'upload-pdf');
            await apiFetch('/api/auto-submit', { method: 'POST', body: formData });
          } catch (backupErr) {
            console.warn('PDF backup to R2 failed:', backupErr);
          }
          if (i < dates.length - 1) await new Promise(r => setTimeout(r, 1500));
        } else { failCount++; }
      } catch (err) {
        console.error(`PDF error for ${date}:`, err);
        failCount++;
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    setPdfGenerating(false);
    setPdfProgress("");
    setPdfProgressNum({ current: 0, total: 0 });
    setPhotoProgress({ current: 0, total: 0, phase: '' });
    toast({
      title: `📄 Batch PDF Selesai!`,
      description: failCount > 0
        ? `${successCount} berhasil, ${failCount} gagal — ${lastError || 'unknown'}`
        : `${successCount} berhasil — PDF udah ke-download`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  return (
    <div className="min-h-screen bg-[hsl(220,45%,6%)] text-white flex flex-col">
      {/* Desktop header */}
      <div className="hidden lg:flex items-center gap-3 px-6 py-4 border-b border-cyan-900/30 bg-[hsl(220,45%,8%)]/80 backdrop-blur-sm">
        <FileText className="w-5 h-5 text-cyan-400" />
        <h1 className="text-lg font-bold text-cyan-400">Generate PDF</h1>
        <span className="text-xs text-slate-500">BA Waste Report</span>
        {tenantName && <span className="text-xs text-cyan-500/70 font-mono ml-2">{tenantName}</span>}
      </div>

      {/* Mobile header */}
      <header className="sticky top-0 z-50 border-b border-cyan-900/30 bg-[hsl(220,45%,8%)]/95 backdrop-blur-md lg:hidden">
        <div className="w-full px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={wasteLogo} alt="AWAS" className="w-7 h-7 rounded-md" />
            <div className="leading-tight">
              <h1 className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                Generate PDF
              </h1>
              <p className="text-[10px] text-slate-500">BA Waste Report</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-cyan-500/5 border border-cyan-900/30">
              <User className="w-3 h-3 text-cyan-600" />
              <span className="text-[10px] font-medium text-cyan-400">{userName}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-3 py-4 space-y-4 desktop-container">
        {/* Range selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(["30", "60", "all"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => { setRange(opt); setSelectedPdfDates(new Set()); }}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                range === opt
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              {opt === "30" ? "30 Hari" : opt === "60" ? "60 Hari" : "Semua"}
            </button>
          ))}
          <span className="text-[10px] text-slate-500 ml-auto shrink-0">
            {availableDates.length} tanggal tersedia
          </span>
        </div>

        {/* Main PDF section */}
        <div className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Pilih Tanggal PDF
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">
                {selectedPdfDates.size}/{availableDates.length} dipilih
              </span>
              <Button
                variant="ghost" size="sm"
                onClick={toggleAllPdfDates}
                className="text-[10px] text-cyan-400 hover:bg-cyan-950/50 px-2 h-7"
              >
                {selectedPdfDates.size === availableDates.length ? "Batal Semua" : "Pilih Semua"}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
              <span className="text-slate-400 text-sm">Loading tanggal...</span>
            </div>
          ) : availableDates.length > 0 ? (
            <>
              {/* Date grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 mb-4 max-h-72 overflow-y-auto pr-1">
                {availableDates.map((date) => {
                  const isSelected = selectedPdfDates.has(date);
                  const { display, dayName } = formatTabDate(date);
                  return (
                    <button
                      key={date}
                      onClick={() => togglePdfDate(date)}
                      disabled={pdfGenerating}
                      className={`flex items-center gap-1.5 px-2 py-2 rounded-lg border text-xs transition-all ${
                        isSelected
                          ? "border-cyan-500 bg-cyan-950/60 text-cyan-300"
                          : "border-cyan-900/30 bg-[hsl(220,45%,8%)] text-slate-400 hover:border-cyan-700"
                      } ${pdfGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      )}
                      <div className="text-left">
                        <div className="font-mono font-semibold">{display}</div>
                        <div className="text-[9px] text-slate-500">{dayName}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Progress bar */}
              {pdfGenerating && (
                <div className="mb-4 space-y-3 bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                  <div className="flex items-center gap-2 text-xs text-cyan-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                    <span className="truncate">{pdfProgress || 'Mempersiapkan...'}</span>
                    <span className="ml-auto font-mono font-bold text-cyan-300 flex-shrink-0">
                      {pdfProgressNum.current}/{pdfProgressNum.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transition-all duration-700 ease-out"
                      style={{ width: `${pdfProgressNum.total > 0 ? (pdfProgressNum.current / pdfProgressNum.total) * 100 : 0}%` }}
                    />
                  </div>
                  {photoProgress.total > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>📸 Foto: {photoProgress.current}/{photoProgress.total}</span>
                        <span className="ml-auto font-mono">
                          {Math.round((photoProgress.current / photoProgress.total) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                          style={{ width: `${(photoProgress.current / photoProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 text-center">⏳ Mohon tunggu, sedang memproses foto dokumentasi...</p>
                </div>
              )}

              {/* Pelapor dropdown */}
              <div className="mt-3 mb-2">
                <label className="text-xs font-medium text-slate-400 mb-1 block">
                  👤 Pelapor (TTD di PDF) <span className="text-red-400">*wajib</span>
                </label>
                <select
                  value={selectedPelapor}
                  onChange={(e) => setSelectedPelapor(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                >
                  <option value="">-- Pilih Pelapor --</option>
                  {Object.keys(pelaporSigUrls).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {selectedPelapor && pelaporSigUrls[selectedPelapor] && (
                  <div className="mt-1 flex items-center gap-2">
                    <img
                      src={pelaporSigUrls[selectedPelapor]}
                      alt={`TTD ${selectedPelapor}`}
                      className="h-8 rounded bg-white/10 p-0.5"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="text-[10px] text-green-400">✅ TTD {selectedPelapor} siap</span>
                  </div>
                )}
                {!selectedPelapor && selectedPdfDates.size > 0 && (
                  <p className="text-[10px] text-amber-400 mt-1">⚠️ Pilih pelapor dulu sebelum bikin PDF</p>
                )}
              </div>

              {/* Generate button */}
              <Button
                onClick={handleBatchPdf}
                disabled={selectedPdfDates.size === 0 || pdfGenerating || !selectedPelapor}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold py-2.5 disabled:opacity-50"
              >
                {pdfGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating {pdfProgressNum.current}/{pdfProgressNum.total}...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Generate {selectedPdfDates.size} PDF{selectedPdfDates.size > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </>
          ) : (
            <p className="text-center text-slate-500 py-6">Belum ada data buat generate PDF nih</p>
          )}
        </div>

        {/* Tips */}
        <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            💡 <strong className="text-slate-400">Tips:</strong> Pilih beberapa tanggal sekaligus untuk batch download. 
            PDF akan otomatis di-backup ke cloud setelah generate.
          </p>
        </div>
      </main>
    </div>
  );
}
