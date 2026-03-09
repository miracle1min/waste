import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  ArrowLeft, TrendingUp, Package, Calendar, BarChart3, 
  Loader2, RefreshCw, ChevronDown, FileText, Download, CheckSquare, Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { useToast } from "@/hooks/use-toast";

interface DashboardData {
  success: boolean;
  availableDates: string[];
  summary: {
    totalDays: number;
    totalItems: number;
    totalQty: number;
    avgItemsPerDay: number;
    avgQtyPerDay: number;
  };
  dailyData: Array<{
    date: string;
    tab: string;
    items: number;
    qty: number;
    stations: Record<string, number>;
    shifts: Record<string, number>;
  }>;
  stationTotals: Record<string, number>;
  shiftTotals: Record<string, number>;
  topProducts: Array<{ name: string; count: number; qty: number }>;
}


// Parse DD/MM/YY tab name to Date  
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

const STATION_COLORS: Record<string, string> = {
  NOODLE: "#06b6d4",
  DIMSUM: "#8b5cf6",
  BAR: "#f59e0b",
  PRODUKSI: "#10b981",
};

const SHIFT_COLORS: Record<string, string> = {
  OPENING: "#06b6d4",
  MIDDLE: "#f59e0b",
  CLOSING: "#8b5cf6",
  MIDNIGHT: "#ef4444",
};

const PIE_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

type RangeOption = "7" | "14" | "30" | "all" | "custom";

// ==================== PDF GENERATION LOGIC ====================
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

async function generatePdfForDate(
  date: string,
  storeName: string,
  onProgress?: (msg: string) => void,
  pelaporName?: string,
  pelaporSigUrl?: string
): Promise<{ blob: Blob; fileName: string } | null> {
  onProgress?.(`Mengambil data ${date}...`);
  
  const res = await fetch(`/api/get-day-data?date=${date}`);
  const dayData = await res.json();
  if (!dayData.success || !dayData.grouped) return null;

  onProgress?.(`Membuat PDF ${date}...`);

  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

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
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = days[dateObj.getDay()];
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

  // Signature cache
  const sigCache: Record<string, string> = {};
  const fetchSigImage = async (url: string): Promise<string | null> => {
    if (!url || url === '-' || !url.startsWith('http')) return null;
    if (sigCache[url]) return sigCache[url];
    try {
      const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      if (!proxyRes.ok) return null;
      const data = await proxyRes.json();
      if (data.success && data.dataUrl) {
        sigCache[url] = data.dataUrl;
        return data.dataUrl;
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

    const headers = [['NO', 'NAMA PRODUK', 'KODE PRODUK', 'JUMLAH', 'METODE', 'ALASAN', 'JAM', 'QC', 'MANAJER', 'DOKUMENTASI']];

    // Pre-fetch sigs
    for (const station of stationOrder) {
      const entry = shiftData.find((e: any) => e.station?.toUpperCase() === station);
      if (entry) {
        const qcUrl = extractImageUrl(entry.parafQC);
        const mgrUrl = extractImageUrl(entry.parafManager);
        if (qcUrl) await fetchSigImage(qcUrl);
        if (mgrUrl) await fetchSigImage(mgrUrl);
      }
    }

    type RowEntry = { entry: any | null; stationIdx: number };
    const rowEntries: RowEntry[] = [];
    const rows: string[][] = [];
    const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/12W36gW1ma3Df2-zftIYkX-z6c0m_X1KV8C1ISDw8PtI/edit';

    stationOrder.forEach((station, idx) => {
      const entry = shiftData.find((e: any) => e.station?.toUpperCase() === station);
      if (entry) {
        const namaProduk = String(entry.namaProduk || '-').replace(/,\s*/g, '\n');
        const kodeProduk = String(entry.kodeProduk || '-').replace(/,\s*/g, '\n');
        const jumlahProduk = String(entry.jumlahProduk || '-').replace(/,\s*/g, '\n');
        const metode = String(entry.metodePemusnahan || '-').replace(/,\s*/g, '\n');
        const alasan = String(entry.alasanPemusnahan || '-').replace(/,\s*/g, '\n');
        const hasDocs = entry.dokumentasi?.some((d: string) => {
          if (!d || d === '-') return false;
          return d.includes('http') || d.includes('IMAGE');
        });
        rowEntries.push({ entry, stationIdx: idx });
        rows.push([
          (idx + 1).toString(), namaProduk, kodeProduk, jumlahProduk,
          metode, alasan, parseJamValue(entry.jamTanggalPemusnahan || '-'),
          '', '', hasDocs ? '' : '-',
        ]);
      } else {
        rowEntries.push({ entry: null, stationIdx: idx });
        rows.push([(idx + 1).toString(), '-', '-', '-', '-', '-', '-', '-', '-', '-']);
      }
    });

    autoTable(doc, {
      head: headers, body: rows, startY,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5, lineWidth: 0.1, minCellHeight: 8, valign: 'middle' },
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center', valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center', valign: 'middle' },
        1: { cellWidth: 45 }, 2: { cellWidth: 28 },
        3: { cellWidth: 16, halign: 'center' }, 4: { cellWidth: 25 },
        5: { cellWidth: 35 }, 6: { cellWidth: 35 },
        7: { cellWidth: 25, halign: 'center' }, 8: { cellWidth: 28, halign: 'center' },
        9: { cellWidth: 31, halign: 'center' },
      },
      tableWidth: 'wrap', theme: 'grid',
      didDrawCell: (data: any) => {
        if (data.section !== 'body') return;
        const rowIdx = data.row.index;
        const colIdx = data.column.index;
        const rowEntry = rowEntries[rowIdx];
        if (!rowEntry?.entry) return;
        const cellX = data.cell.x;
        const cellY = data.cell.y;
        const cellW = data.cell.width;
        const cellH = data.cell.height;

        if (colIdx === 7) {
          const qcUrl = extractImageUrl(rowEntry.entry.parafQC);
          if (qcUrl && sigCache[qcUrl]) {
            try {
              const imgH = Math.min(cellH - 2, 14);
              const imgW = Math.min(cellW - 2, imgH * 2);
              doc.addImage(sigCache[qcUrl], 'PNG', cellX + (cellW - imgW) / 2, cellY + (cellH - imgH) / 2, imgW, imgH);
            } catch {}
          }
        }
        if (colIdx === 8) {
          const mgrUrl = extractImageUrl(rowEntry.entry.parafManager);
          if (mgrUrl && sigCache[mgrUrl]) {
            try {
              const imgH = Math.min(cellH - 2, 14);
              const imgW = Math.min(cellW - 2, imgH * 2);
              doc.addImage(sigCache[mgrUrl], 'PNG', cellX + (cellW - imgW) / 2, cellY + (cellH - imgH) / 2, imgW, imgH);
            } catch {}
          }
        }
        if (colIdx === 9) {
          const hasDocs = rowEntry.entry.dokumentasi?.some((d: string) => {
            if (!d || d === '-') return false;
            return d.includes('http') || d.includes('IMAGE');
          });
          if (hasDocs) {
            doc.setTextColor(0, 0, 255);
            doc.setFontSize(7);
            const linkText = 'Lihat Foto';
            const textWidth = doc.getTextWidth(linkText);
            const linkX = cellX + (cellW - textWidth) / 2;
            const linkY = cellY + cellH / 2 + 1;
            doc.text(linkText, linkX, linkY);
            doc.setDrawColor(0, 0, 255);
            doc.setLineWidth(0.2);
            doc.line(linkX, linkY + 0.5, linkX + textWidth, linkY + 0.5);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.1);
            doc.link(linkX, linkY - 3, textWidth, 5, { url: spreadsheetUrl });
            doc.setTextColor(0, 0, 0);
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

  // Footer
  if (startY > pageHeight - 45) {
    doc.addPage();
    startY = 15;
  }
  startY += 8;

  // Pelapor signature from dropdown selection
  const displayPelapor = pelaporName || 'QC';
  let qcSigImg: string | null = null;
  if (pelaporSigUrl) {
    try {
      const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(pelaporSigUrl)}`);
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

  // Disclaimer footer - with page boundary check
  let disclaimerY = startY + 30;
  if (disclaimerY > pageHeight - 10) {
    doc.addPage();
    disclaimerY = 20;
  }
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  const disclaimerText = 'Data waste ini bersifat Internal & Rahasia serta terjaga keamanannya di database QC.';
  doc.text(disclaimerText, pageWidth / 2, disclaimerY, { align: 'center' });
  // Garis tipis di atas disclaimer
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(margin + 20, disclaimerY - 3, pageWidth - margin - 20, disclaimerY - 3);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0); // reset

  const fileName = `BA_WASTE_${date.replace(/-/g, '')}.pdf`;
  return { blob: doc.output('blob'), fileName };
}

// ==================== DASHBOARD COMPONENT ====================
export default function Dashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeOption>("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  
  // Fetch Pelapor signatures on mount
  useEffect(() => {
    async function fetchSigs() {
      try {
        const res = await fetch("/api/signatures");
        const data = await res.json();
        if (data.success) {
          // Only QC signatures for pelapor
          const qcNames = ["PAJAR", "RIZKI", "JOHAN", "LUISA"];
          const qcSigs: Record<string, string> = {};
          for (const name of qcNames) {
            if (data.signatures[name]) qcSigs[name] = data.signatures[name];
          }
          setPelaporSigUrls(qcSigs);
        }
      } catch (e) {
        console.error("Failed to load pelapor signatures:", e);
      } finally {
        setLoadingSignatures(false);
      }
    }
    fetchSigs();
  }, []);

  // Batch PDF states
  const [selectedPdfDates, setSelectedPdfDates] = useState<Set<string>>(new Set());
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [pdfProgressNum, setPdfProgressNum] = useState({ current: 0, total: 0 });

  // Pelapor dropdown state
  const [selectedPelapor, setSelectedPelapor] = useState<string>("");
  const [statPeriod, setStatPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [pelaporSigUrls, setPelaporSigUrls] = useState<Record<string, string>>({});
  const [loadingSignatures, setLoadingSignatures] = useState(true);

  const dateRange = useMemo(() => {
    if (range === "custom" && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    if (range === "all") return {};
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - parseInt(range));
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, [range, customStart, customEnd]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set("startDate", dateRange.startDate);
      if (dateRange.endDate) params.set("endDate", dateRange.endDate);
      const res = await fetch(`/api/dashboard-data?${params}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Gagal memuat data");
      }
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange.startDate, dateRange.endDate]);

  const rangeLabels: Record<RangeOption, string> = {
    "7": "7 Hari Terakhir",
    "14": "14 Hari Terakhir",
    "30": "30 Hari Terakhir",
    all: "Semua Data",
    custom: "Custom Range",
  };

  const lineData = data?.dailyData.map((d) => ({
    date: new Date(d.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    fullDate: d.date,
    items: d.items,
    qty: d.qty,
  })) || [];

  const stationData = Object.entries(data?.stationTotals || {}).map(([name, qty]) => ({
    name, qty, fill: STATION_COLORS[name] || "#64748b",
  }));

  const shiftData = Object.entries(data?.shiftTotals || {}).map(([name, qty]) => ({
    name, value: qty,
  }));

  const stationLineData = data?.dailyData.map((d) => ({
    date: new Date(d.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    ...d.stations,
  })) || [];

  const allStations = [...new Set(data?.dailyData.flatMap((d) => Object.keys(d.stations)) || [])];

  // Batch PDF handlers
  const availableDates = data?.availableDates || [];
  
  const togglePdfDate = (date: string) => {
    setSelectedPdfDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
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
      toast({
        title: "👤 Pilih Pelapor",
        description: "Pilih nama pelapor terlebih dahulu untuk TTD di PDF",
        variant: "destructive",
      });
      return;
    }
    setPdfGenerating(true);
    const dates = Array.from(selectedPdfDates).sort();
    const storeName = localStorage.getItem('waste_app_store') || 'Store';
    let successCount = 0;
    let failCount = 0;

    setPdfProgressNum({ current: 0, total: dates.length });

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      setPdfProgressNum({ current: i + 1, total: dates.length });
      
      try {
        const { fullDate } = formatTabDate(date);
        const result = await generatePdfForDate(fullDate || date, storeName, (msg) => setPdfProgress(msg), selectedPelapor, pelaporSigUrls[selectedPelapor]);
        if (result) {
          // Download individual file
          const url = URL.createObjectURL(result.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.fileName;
          a.click();
          URL.revokeObjectURL(url);
          successCount++;

          // Backup to Google Drive
          try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
              reader.onload = () => {
                const dataUrl = reader.result as string;
                resolve(dataUrl.split(',')[1]);
              };
              reader.readAsDataURL(result.blob);
            });
            await fetch('/api/upload-to-drive', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName: result.fileName, pdfBase64: base64 }),
            });
          } catch {}

          // Delay between downloads so browser doesn't block
          if (i < dates.length - 1) await new Promise(r => setTimeout(r, 1500));
        } else {
          failCount++;
        }
      } catch (err) {
        console.error(`PDF error for ${date}:`, err);
        failCount++;
      }
    }

    setPdfGenerating(false);
    setPdfProgress("");
    setPdfProgressNum({ current: 0, total: 0 });

    toast({
      title: `📄 Batch PDF Selesai!`,
      description: `${successCount} berhasil${failCount > 0 ? `, ${failCount} gagal` : ''} — juga di-backup ke Google Drive`,
    });
  };

  return (
    <div className="min-h-screen bg-[hsl(220,45%,6%)] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-cyan-900/30 bg-[hsl(220,45%,8%)]/95 backdrop-blur-md">
        <div className="w-full px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/50 px-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Kembali
            </Button>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <h1 className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Dashboard Analytics
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRangeMenu(!showRangeMenu)}
                className="text-xs border-cyan-800 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/50"
              >
                <Calendar className="w-3 h-3 mr-1" />
                {rangeLabels[range]}
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
              {showRangeMenu && (
                <div className="absolute right-0 mt-1 w-56 bg-[hsl(220,45%,12%)] border border-cyan-900/50 rounded-lg shadow-xl z-50 py-1">
                  {(["7", "14", "30", "all"] as RangeOption[]).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setRange(opt); setShowRangeMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-cyan-950/50 transition ${range === opt ? "text-cyan-400 font-semibold" : "text-slate-300"}`}
                    >
                      {rangeLabels[opt]}
                    </button>
                  ))}
                  <div className="border-t border-cyan-900/30 mt-1 pt-1 px-3 py-2">
                    <p className="text-[10px] text-slate-500 mb-1">Custom Range</p>
                    <div className="flex gap-1">
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="flex-1 text-[10px] bg-slate-900 border border-cyan-900/50 rounded px-1 py-0.5 text-white"
                      />
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="flex-1 text-[10px] bg-slate-900 border border-cyan-900/50 rounded px-1 py-0.5 text-white"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => { setRange("custom"); setShowRangeMenu(false); }}
                      disabled={!customStart || !customEnd}
                      className="w-full mt-1 h-6 text-[10px] bg-cyan-600 hover:bg-cyan-700"
                    >
                      Terapkan
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="text-cyan-400 hover:bg-cyan-950/50 px-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-3 py-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mr-3" />
            <span className="text-slate-400">Memuat data dashboard...</span>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-20">
            <p className="text-red-400 mb-3">{error}</p>
            <Button onClick={fetchData} variant="outline" className="border-cyan-800 text-cyan-400">
              Coba Lagi
            </Button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* ==================== BATCH PDF SECTION ==================== */}
            <div className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Generate PDF BA WASTE
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">
                    {selectedPdfDates.size}/{availableDates.length} dipilih
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllPdfDates}
                    className="text-[10px] text-cyan-400 hover:bg-cyan-950/50 px-2 h-7"
                  >
                    {selectedPdfDates.size === availableDates.length ? "Batal Semua" : "Pilih Semua"}
                  </Button>
                </div>
              </div>

              {/* Date grid */}
              {availableDates.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 mb-4 max-h-64 overflow-y-auto pr-1">
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
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-cyan-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{pdfProgress}</span>
                        <span className="ml-auto font-mono">
                          {pdfProgressNum.current}/{pdfProgressNum.total}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                          style={{ width: `${pdfProgressNum.total > 0 ? (pdfProgressNum.current / pdfProgressNum.total) * 100 : 0}%` }}
                        />
                      </div>
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
                      <p className="text-[10px] text-amber-400 mt-1">⚠️ Pilih pelapor dulu sebelum generate PDF</p>
                    )}
                  </div>

                  {/* Generate button */}
                  <Button
                    onClick={handleBatchPdf}
                    disabled={selectedPdfDates.size === 0 || pdfGenerating || !selectedPelapor}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold py-2 disabled:opacity-50"
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
                <p className="text-center text-slate-500 py-6">Tidak ada data tersedia untuk generate PDF</p>
              )}
            </div>

            {/* ==================== DATA WASTE TERAKHIR ==================== */}
            {data.lastEntry && (
              <div className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-cyan-300 flex items-center gap-2 mb-3">
                  📋 Data Waste Terakhir
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Tanggal</p>
                    <p className="text-sm font-bold text-white mt-1">{data.lastEntry.date}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">QC / Pelapor</p>
                    <p className="text-sm font-bold text-cyan-300 mt-1">{data.lastEntry.qc || '-'}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Station</p>
                    <p className="text-sm font-bold text-amber-300 mt-1">{data.lastEntry.station}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Shift</p>
                    <p className="text-sm font-bold text-violet-300 mt-1">{data.lastEntry.shift}</p>
                  </div>
                </div>
                {data.qcNames && data.qcNames.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-slate-500 mr-1 self-center">QC Aktif:</span>
                    {data.qcNames.map((qc: string) => (
                      <span key={qc} className="text-[10px] bg-cyan-950/50 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-800/50">{qc}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ==================== WASTE STATION DETAIL (by UNIT) ==================== */}
            {data.periodBreakdown && (
              <div className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h2 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                    🏭 Waste per Station (Detail per Satuan)
                  </h2>
                  <div className="flex bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                    {([["daily", "Hari Ini"], ["weekly", "7 Hari"], ["monthly", "30 Hari"]] as const).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setStatPeriod(key)}
                        className={`px-3 py-1 text-[11px] font-medium transition-all ${
                          statPeriod === key 
                            ? "bg-cyan-600 text-white" 
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const periodData = data.periodBreakdown[statPeriod] || {};
                  const stations = Object.keys(periodData);
                  
                  if (stations.length === 0) {
                    return (
                      <p className="text-center text-slate-500 py-6 text-sm">
                        Tidak ada data waste untuk periode {statPeriod === "daily" ? "hari ini" : statPeriod === "weekly" ? "7 hari terakhir" : "30 hari terakhir"}
                      </p>
                    );
                  }

                  // Sort stations by total qty (sum all units)
                  const sortedStations = stations.sort((a, b) => {
                    const totalA = periodData[a].reduce((s: number, u: any) => s + u.totalQty, 0);
                    const totalB = periodData[b].reduce((s: number, u: any) => s + u.totalQty, 0);
                    return totalB - totalA;
                  });

                  return (
                    <div className="space-y-3">
                      {sortedStations.map((station: string, idx: number) => {
                        const unitGroups = periodData[station] as { unit: string; items: { name: string; qty: number }[]; totalQty: number }[];
                        const stationTotal = unitGroups.reduce((s: number, u) => s + u.totalQty, 0);
                        const maxTotal = periodData[sortedStations[0]].reduce((s: number, u: any) => s + u.totalQty, 0);
                        
                        return (
                          <div key={station} className="bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden">
                            {/* Station header */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white bg-cyan-600/20 px-2 py-0.5 rounded">#{idx + 1}</span>
                                <span className="text-sm font-bold text-white">{station}</span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                Total: <span className="text-cyan-300 font-bold">{stationTotal.toLocaleString()}</span> item
                              </span>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="px-3 pt-1">
                              <div className="w-full bg-slate-800 rounded-full h-1.5">
                                <div 
                                  className="h-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                                  style={{ width: `${maxTotal > 0 ? (stationTotal / maxTotal) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                            
                            {/* Unit groups */}
                            <div className="p-3 space-y-2">
                              {unitGroups.map((ug) => (
                                <div key={ug.unit} className="bg-slate-800/50 rounded-lg p-2">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      ug.unit === 'GRAM' ? 'bg-amber-900/40 text-amber-300' :
                                      ug.unit === 'PCS' ? 'bg-blue-900/40 text-blue-300' :
                                      ug.unit === 'PORSI' ? 'bg-green-900/40 text-green-300' :
                                      'bg-purple-900/40 text-purple-300'
                                    }`}>
                                      {ug.unit}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      Subtotal: <span className="font-bold text-white">{ug.totalQty.toLocaleString()} {ug.unit}</span>
                                    </span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {ug.items.slice(0, 5).map((item, iIdx) => (
                                      <div key={iIdx} className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-300 truncate mr-2">{item.name}</span>
                                        <span className="text-white font-mono font-medium whitespace-nowrap">{item.qty.toLocaleString()} {ug.unit}</span>
                                      </div>
                                    ))}
                                    {ug.items.length > 5 && (
                                      <p className="text-[10px] text-slate-500 mt-1">+{ug.items.length - 5} item lainnya</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Hari", value: data.summary.totalDays, icon: Calendar, color: "cyan" },
                { label: "Total Item", value: data.summary.totalItems, icon: Package, color: "violet" },
                { label: "Total Qty", value: data.summary.totalQty, icon: TrendingUp, color: "amber" },
                { label: "Rata² Qty/Hari", value: data.summary.avgQtyPerDay, icon: BarChart3, color: "emerald" },
              ].map((card) => (
                <div key={card.label} className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <card.icon className={`w-4 h-4 text-${card.color}-400`} />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{card.label}</span>
                  </div>
                  <p className={`text-2xl font-bold text-${card.color}-400`}>
                    {card.value.toLocaleString("id-ID")}
                  </p>
                </div>
              ))}
            </div>

            {/* Trend Chart */}
            <div className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-cyan-300 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Tren Waste Harian
              </h2>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(6,182,212,0.1)" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "hsl(220,45%,12%)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontSize: "12px" }} labelStyle={{ color: "#06b6d4" }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey="qty" name="Quantity" stroke="#06b6d4" strokeWidth={2} dot={{ fill: "#06b6d4", r: 3 }} />
                    <Line type="monotone" dataKey="items" name="Items" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-500 py-10">Tidak ada data untuk periode ini</p>
              )}
            </div>

            {/* Station & Shift Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-cyan-300 mb-3">📊 Waste per Station</h2>
                {stationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={stationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(6,182,212,0.1)" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "hsl(220,45%,12%)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontSize: "12px" }} />
                      <Bar dataKey="qty" name="Quantity" radius={[6, 6, 0, 0]}>
                        {stationData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-slate-500 py-10">Tidak ada data</p>
                )}
              </div>

              <div className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-cyan-300 mb-3">🕐 Waste per Shift</h2>
                {shiftData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={shiftData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ stroke: "#94a3b8", strokeWidth: 0.5 }}
                      >
                        {shiftData.map((entry, i) => (
                          <Cell key={i} fill={SHIFT_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(220,45%,12%)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-slate-500 py-10">Tidak ada data</p>
                )}
              </div>
            </div>

            {/* Station Trend */}
            <div className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-cyan-300 mb-3">📈 Tren per Station</h2>
              {stationLineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stationLineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(6,182,212,0.1)" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "hsl(220,45%,12%)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    {allStations.map((station) => (
                      <Bar key={station} dataKey={station} name={station} stackId="a" fill={STATION_COLORS[station] || "#64748b"} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-500 py-10">Tidak ada data</p>
              )}
            </div>

            {/* Top Products */}
            <div className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-cyan-300 mb-3">🏆 Top 10 Produk Waste</h2>
              {data.topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-cyan-900/30">
                        <th className="text-left py-2 px-2 text-slate-500">#</th>
                        <th className="text-left py-2 px-2 text-slate-500">Nama Produk</th>
                        <th className="text-right py-2 px-2 text-slate-500">Frekuensi</th>
                        <th className="text-right py-2 px-2 text-slate-500">Total Qty</th>
                        <th className="text-left py-2 px-2 text-slate-500">Bar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, i) => {
                        const maxQty = data.topProducts[0]?.qty || 1;
                        const pct = (p.qty / maxQty) * 100;
                        return (
                          <tr key={i} className="border-b border-cyan-900/10 hover:bg-cyan-950/30 transition">
                            <td className="py-2 px-2 text-slate-500 font-mono">{i + 1}</td>
                            <td className="py-2 px-2 text-slate-200 font-medium">{p.name}</td>
                            <td className="py-2 px-2 text-right text-cyan-400">{p.count}x</td>
                            <td className="py-2 px-2 text-right text-amber-400 font-semibold">{p.qty}</td>
                            <td className="py-2 px-2 w-32">
                              <div className="w-full bg-slate-800 rounded-full h-2">
                                <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-slate-500 py-10">Tidak ada data</p>
              )}
            </div>

          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
