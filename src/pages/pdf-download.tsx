import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useMemo } from "react";
import {
 FileDown, Calendar, Download, Loader2, FileText,
 CheckSquare, Square, User, ChevronDown, ChevronUp,
 CloudUpload, Clock, CheckCircle, XCircle, Image as ImageIcon,
 Printer, FolderOpen, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/ui/footer";
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

// ==================== COLLAPSIBLE SECTION ====================
function CollapsibleSection({ title, icon, defaultOpen = true, badge, children }: {
 title: string; icon: React.ReactNode; defaultOpen?: boolean; badge?: string | number; children: React.ReactNode;
}) {
 const [open, setOpen] = useState(defaultOpen);
 return (
   <div className="bg-[#1E2028] rounded-2xl border border-[rgba(79,209,255,0.06)] shadow-[4px_4px_12px_rgba(0,0,0,0.35),-2px_-2px_8px_rgba(255,255,255,0.02)] overflow-hidden transition-all duration-300">
     <button
       onClick={() => setOpen(!open)}
       className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[rgba(79,209,255,0.03)] transition-colors"
     >
       <div className="flex items-center gap-2.5">
         <div className="w-8 h-8 rounded-lg bg-[#4FD1FF]/[0.08] border border-[#4FD1FF]/10 flex items-center justify-center">
           {icon}
         </div>
         <span className="text-sm font-bold text-[#E5E7EB]">{title}</span>
         {badge !== undefined && (
           <span className="text-[10px] bg-[#4FD1FF]/10 text-[#4FD1FF] px-2 py-0.5 rounded-full border border-[#4FD1FF]/15 font-semibold">
             {badge}
           </span>
         )}
       </div>
       <div className={`transform transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
         <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
       </div>
     </button>
     <div className={`transition-all duration-300 ease-in-out ${open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}>
       <div className="px-4 pb-4">{children}</div>
     </div>
   </div>
 );
}

// ==================== SKELETON LOADER ====================
function SkeletonLoader() {
 return (
   <div className="space-y-4 animate-pulse">
     <div className="h-12 bg-[#23262F] rounded-xl" />
     <div className="grid grid-cols-3 gap-3">
       {[1,2,3].map(i => <div key={i} className="h-20 bg-[#23262F] rounded-xl" />)}
     </div>
     <div className="space-y-2">
       {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-[#23262F] rounded-xl" />)}
     </div>
   </div>
 );
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
 const [selectedMonth, setSelectedMonth] = useState<string>("");

 const tenantName = localStorage.getItem("waste_app_tenant_name") || "";
 const userName = localStorage.getItem("waste_app_qc_name") || "User";

 // Fetch ALL available dates once
 useEffect(() => {
   async function fetchDates() {
     setLoading(true);
     try {
       const res = await apiFetch(`/api/dashboard-data`);
       const json = await res.json();
       if (json.success) {
         const dates = json.availableDates || [];
         setAvailableDates(dates);
         if (dates.length > 0) {
           const now = new Date();
           const currentKey = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}`;
           const months = [...new Set(dates.map((d: string) => {
             const parsed = parseTabDate(d);
             if (!parsed) return '';
             return `${parsed.getFullYear()}-${(parsed.getMonth()+1).toString().padStart(2,'0')}`;
           }).filter(Boolean))]  as string[];
           setSelectedMonth(months.includes(currentKey) ? currentKey : (months[months.length - 1] || ''));
         }
       }
     } catch {
       toast({ title: "Error", description: "Gagal load daftar tanggal", variant: "destructive" });
     } finally {
       setLoading(false);
     }
   }
   fetchDates();
 }, []);

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

 // Group dates by month
 const monthOptions = useMemo(() => {
   const monthMap = new Map<string, { label: string; count: number }>();
   const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
     'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
   for (const d of availableDates) {
     const parsed = parseTabDate(d);
     if (!parsed) continue;
     const key = `${parsed.getFullYear()}-${(parsed.getMonth()+1).toString().padStart(2,'0')}`;
     if (!monthMap.has(key)) {
       monthMap.set(key, { label: `${monthNames[parsed.getMonth()]} ${parsed.getFullYear()}`, count: 0 });
     }
     monthMap.get(key)!.count++;
   }
   return Array.from(monthMap.entries())
     .sort((a, b) => b[0].localeCompare(a[0]))
     .map(([key, val]) => ({ key, ...val }));
 }, [availableDates]);

 // Filter dates by selected month
 const filteredDates = useMemo(() => {
   if (!selectedMonth) return [];
   return availableDates.filter(d => {
     const parsed = parseTabDate(d);
     if (!parsed) return false;
     const key = `${parsed.getFullYear()}-${(parsed.getMonth()+1).toString().padStart(2,'0')}`;
     return key === selectedMonth;
   });
 }, [availableDates, selectedMonth]);

 const togglePdfDate = (date: string) => {
   setSelectedPdfDates(prev => {
     const next = new Set(prev);
     if (next.has(date)) next.delete(date); else next.add(date);
     return next;
   });
 };

 const toggleAllPdfDates = () => {
   const allSelected = filteredDates.every(d => selectedPdfDates.has(d));
   if (allSelected) {
     setSelectedPdfDates(prev => {
       const next = new Set(prev);
       filteredDates.forEach(d => next.delete(d));
       return next;
     });
   } else {
     setSelectedPdfDates(prev => new Set([...prev, ...filteredDates]));
   }
 };

 const allMonthSelected = filteredDates.length > 0 && filteredDates.every(d => selectedPdfDates.has(d));
 const selectedInMonth = filteredDates.filter(d => selectedPdfDates.has(d)).length;

 const handleBatchPdf = async () => {
   if (selectedPdfDates.size === 0) return;
   if (!selectedPelapor) {
     toast({ title: "👤 Pilih Pelapor", description: "Pilih nama pelapor dulu ya buat TTD di PDF", variant: "warning" as any });
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

 // Current selected month label
 const selectedMonthLabel = monthOptions.find(m => m.key === selectedMonth)?.label || "";

 return (
   <div className="min-h-screen bg-[#14161A] text-white flex flex-col">
     {/* ═══════ DESKTOP HEADER ═══════ */}
     <div className="hidden lg:flex items-center gap-4 px-6 py-4 border-b border-[rgba(79,209,255,0.08)] bg-[#1A1C22]/80 backdrop-blur-sm">
       <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4FD1FF]/20 to-[#9F7AEA]/20 border border-[#4FD1FF]/15 flex items-center justify-center">
         <Printer className="w-5 h-5 text-[#4FD1FF]" />
       </div>
       <div>
         <h1 className="text-lg font-bold bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] bg-clip-text text-transparent">Generate PDF</h1>
         <p className="text-[11px] text-[#9CA3AF]">BA Waste Report — Cetak & Arsipkan</p>
       </div>
       <div className="ml-auto flex items-center gap-3">
         {tenantName && (
           <span className="text-xs text-[#4FD1FF]/70 bg-[#4FD1FF]/[0.06] px-3 py-1.5 rounded-lg border border-[#4FD1FF]/10">{tenantName}</span>
         )}
         <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#23262F] border border-[rgba(79,209,255,0.08)]">
           <User className="w-3.5 h-3.5 text-[#4FD1FF]/60" />
           <span className="text-xs font-medium text-[#E5E7EB]">{userName}</span>
         </div>
       </div>
     </div>

     {/* ═══════ MOBILE HEADER ═══════ */}
     <header className="sticky top-0 z-50 border-b border-[rgba(79,209,255,0.08)] bg-[#1A1C22]/95 backdrop-blur-md lg:hidden">
       <div className="w-full px-3 py-2.5 flex items-center justify-between">
         <div className="flex items-center gap-2.5">
           <img src={wasteLogo} alt="AWAS" className="w-7 h-7 rounded-md" />
           <div className="leading-tight">
             <h1 className="text-sm font-bold bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] bg-clip-text text-transparent flex items-center gap-1.5">
               <Printer className="w-3.5 h-3.5 text-[#4FD1FF] flex-shrink-0" />
               Generate PDF
             </h1>
             <p className="text-[10px] text-[#9CA3AF]">BA Waste Report</p>
           </div>
         </div>
         <div className="flex items-center gap-1.5">
           <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#4FD1FF]/[0.06] border border-[#4FD1FF]/10">
             <User className="w-3 h-3 text-[#4FD1FF]/60" />
             <span className="text-[10px] font-medium text-[#4FD1FF]">{userName}</span>
           </div>
         </div>
       </div>
     </header>

     <main className="flex-1 w-full max-w-3xl mx-auto px-3 lg:px-6 py-4 lg:py-6 space-y-4">

       {/* ═══════ HERO SUMMARY STRIP ═══════ */}
       <div className="bg-gradient-to-r from-[#1E2028] to-[#1A1C22] rounded-2xl border border-[rgba(79,209,255,0.08)] p-4 shadow-[4px_4px_12px_rgba(0,0,0,0.35),-2px_-2px_8px_rgba(255,255,255,0.02)]">
         <div className="flex items-center gap-3 mb-3">
           <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4FD1FF]/15 to-[#9F7AEA]/15 border border-[#4FD1FF]/10 flex items-center justify-center">
             <FileDown className="w-5 h-5 text-[#4FD1FF]" />
           </div>
           <div className="flex-1 min-w-0">
             <h2 className="text-sm font-bold text-[#E5E7EB]">PDF Generator</h2>
             <p className="text-[10px] text-[#9CA3AF]">Cetak Berita Acara Pemusnahan Produk</p>
           </div>
         </div>
         {/* Quick stats */}
         <div className="grid grid-cols-3 gap-2">
           <div className="bg-[#14161A]/60 rounded-xl px-3 py-2.5 border border-[rgba(79,209,255,0.05)] text-center">
             <p className="text-lg font-bold text-[#4FD1FF] tabular-nums">{availableDates.length}</p>
             <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wider mt-0.5">Total Hari</p>
           </div>
           <div className="bg-[#14161A]/60 rounded-xl px-3 py-2.5 border border-[rgba(79,209,255,0.05)] text-center">
             <p className="text-lg font-bold text-[#9F7AEA] tabular-nums">{monthOptions.length}</p>
             <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wider mt-0.5">Bulan</p>
           </div>
           <div className="bg-[#14161A]/60 rounded-xl px-3 py-2.5 border border-[rgba(79,209,255,0.05)] text-center">
             <p className="text-lg font-bold text-emerald-400 tabular-nums">{selectedPdfDates.size}</p>
             <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wider mt-0.5">Dipilih</p>
           </div>
         </div>
       </div>

       {loading ? (
         <SkeletonLoader />
       ) : availableDates.length === 0 ? (
         <div className="bg-[#1E2028] rounded-2xl border border-[rgba(79,209,255,0.06)] p-8 text-center shadow-[4px_4px_12px_rgba(0,0,0,0.35)]">
           <FolderOpen className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
           <p className="text-sm text-[#9CA3AF]">Belum ada data buat generate PDF nih</p>
           <p className="text-[10px] text-[#9CA3AF] mt-1">Input waste dulu ya di menu lain</p>
         </div>
       ) : (
         <>
           {/* ═══════ MONTH SELECTOR ═══════ */}
           <CollapsibleSection
             title="Pilih Bulan"
             icon={<Filter className="w-4 h-4 text-[#4FD1FF]" />}
             badge={selectedMonthLabel || undefined}
             defaultOpen={true}
           >
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
               {monthOptions.map((m) => {
                 const isActive = selectedMonth === m.key;
                 return (
                   <button
                     key={m.key}
                     onClick={() => setSelectedMonth(m.key)}
                     className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all duration-200 ${
                       isActive
                         ? "border-[#4FD1FF]/40 bg-[#4FD1FF]/[0.08] shadow-[0_0_12px_rgba(79,209,255,0.08)]"
                         : "border-[rgba(79,209,255,0.06)] bg-[#14161A]/40 hover:border-[#4FD1FF]/15 hover:bg-[#14161A]/70"
                     }`}
                   >
                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                       isActive ? "bg-[#4FD1FF]/15 border border-[#4FD1FF]/20" : "bg-[#23262F] border border-[rgba(79,209,255,0.06)]"
                     }`}>
                       <Calendar className={`w-4 h-4 ${isActive ? "text-[#4FD1FF]" : "text-[#9CA3AF]"}`} />
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className={`text-xs font-semibold ${isActive ? "text-[#4FD1FF]" : "text-[#E5E7EB]"}`}>{m.label}</p>
                       <p className="text-[10px] text-[#9CA3AF]">{m.count} hari tersedia</p>
                     </div>
                     {isActive && <CheckCircle className="w-4 h-4 text-[#4FD1FF] flex-shrink-0" />}
                   </button>
                 );
               })}
             </div>
           </CollapsibleSection>

           {/* ═══════ DATE LIST ═══════ */}
           <CollapsibleSection
             title="Pilih Tanggal"
             icon={<Calendar className="w-4 h-4 text-[#4FD1FF]" />}
             badge={selectedInMonth > 0 ? `${selectedInMonth}/${filteredDates.length}` : `${filteredDates.length}`}
             defaultOpen={true}
           >
             {!selectedMonth ? (
               <div className="text-center py-6">
                 <Calendar className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
                 <p className="text-xs text-[#9CA3AF]">Pilih bulan dulu di atas 👆</p>
               </div>
             ) : filteredDates.length === 0 ? (
               <p className="text-center text-[#9CA3AF] text-xs py-6">Tidak ada data di bulan ini</p>
             ) : (
               <>
                 {/* Select all toggle */}
                 <div className="flex items-center justify-between mb-3 pb-2 border-b border-[rgba(79,209,255,0.06)]">
                   <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-medium">
                     {selectedMonthLabel}
                   </span>
                   <button
                     onClick={toggleAllPdfDates}
                     disabled={pdfGenerating}
                     className="text-[10px] font-semibold text-[#4FD1FF] hover:text-[#4FD1FF]/80 transition-colors disabled:opacity-50 flex items-center gap-1"
                   >
                     {allMonthSelected ? (
                       <><XCircle className="w-3 h-3" /> Batal Semua</>
                     ) : (
                       <><CheckSquare className="w-3 h-3" /> Pilih Semua ({filteredDates.length})</>
                     )}
                   </button>
                 </div>

                 {/* Date grid */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                   {filteredDates.map((date) => {
                     const isSelected = selectedPdfDates.has(date);
                     const { display, dayName } = formatTabDate(date);
                     const dateObj = parseTabDate(date);
                     const dayNum = dateObj ? dateObj.getDate() : '';
                     const isWeekend = dateObj ? (dateObj.getDay() === 0 || dateObj.getDay() === 6) : false;
                     return (
                       <button
                         key={date}
                         onClick={() => togglePdfDate(date)}
                         disabled={pdfGenerating}
                         className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition-all duration-200 ${
                           isSelected
                             ? "border-[#4FD1FF]/40 bg-[#4FD1FF]/[0.08] shadow-[0_0_8px_rgba(79,209,255,0.06)]"
                             : "border-[rgba(79,209,255,0.05)] bg-[#14161A]/40 hover:border-[#4FD1FF]/12 hover:bg-[#14161A]/60"
                         } ${pdfGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                       >
                         {isSelected ? (
                           <CheckSquare className="w-4 h-4 text-[#4FD1FF] flex-shrink-0" />
                         ) : (
                           <Square className="w-4 h-4 text-[#9CA3AF]/50 flex-shrink-0" />
                         )}
                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                           isSelected ? "bg-[#4FD1FF]/15 border border-[#4FD1FF]/20" : "bg-[#23262F] border border-[rgba(79,209,255,0.06)]"
                         }`}>
                           <span className={`text-sm font-bold tabular-nums ${isSelected ? "text-[#4FD1FF]" : "text-[#E5E7EB]"}`}>{dayNum}</span>
                         </div>
                         <div className="text-left flex-1 min-w-0">
                           <span className={`font-medium text-xs ${isSelected ? "text-[#E5E7EB]" : "text-[#E5E7EB]/80"}`}>{dayName}</span>
                           <span className="text-[#9CA3AF] ml-1.5 text-[10px] tabular-nums">{display}</span>
                           {isWeekend && <span className="ml-1.5 text-[9px] text-amber-400/60">●</span>}
                         </div>
                         <FileText className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-[#4FD1FF]/60' : 'text-[#9CA3AF]/30'}`} />
                       </button>
                     );
                   })}
                 </div>
               </>
             )}
           </CollapsibleSection>

           {/* ═══════ PELAPOR SELECTOR ═══════ */}
           <CollapsibleSection
             title="Pelapor (TTD)"
             icon={<User className="w-4 h-4 text-[#9F7AEA]" />}
             badge={selectedPelapor || "Wajib"}
             defaultOpen={true}
           >
             <div className="space-y-3">
               <p className="text-[10px] text-[#9CA3AF]">
                 Pilih nama QC yang akan tercantum sebagai pelapor di PDF <span className="text-red-400">*wajib</span>
               </p>

               {loadingSignatures ? (
                 <div className="flex items-center gap-2 py-3">
                   <Loader2 className="w-4 h-4 animate-spin text-[#4FD1FF]" />
                   <span className="text-xs text-[#9CA3AF]">Loading signatures...</span>
                 </div>
               ) : Object.keys(pelaporSigUrls).length === 0 ? (
                 <div className="bg-amber-500/[0.06] border border-amber-500/15 rounded-xl px-3 py-3 text-center">
                   <p className="text-xs text-amber-300">Belum ada data QC personnel</p>
                   <p className="text-[10px] text-amber-300/60 mt-0.5">Tambah di Settings → QC & Manajer</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                   {Object.entries(pelaporSigUrls).map(([name, sigUrl]) => {
                     const isActive = selectedPelapor === name;
                     return (
                       <button
                         key={name}
                         onClick={() => setSelectedPelapor(name)}
                         className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all duration-200 ${
                           isActive
                             ? "border-[#9F7AEA]/40 bg-[#9F7AEA]/[0.08] shadow-[0_0_12px_rgba(159,122,234,0.08)]"
                             : "border-[rgba(79,209,255,0.06)] bg-[#14161A]/40 hover:border-[#9F7AEA]/15 hover:bg-[#14161A]/70"
                         }`}
                       >
                         <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                           isActive ? "bg-[#9F7AEA]/15 border border-[#9F7AEA]/20" : "bg-[#23262F] border border-[rgba(79,209,255,0.06)]"
                         }`}>
                           <span className={`text-sm font-bold ${isActive ? "text-[#9F7AEA]" : "text-[#9CA3AF]"}`}>
                             {name.charAt(0).toUpperCase()}
                           </span>
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className={`text-xs font-semibold truncate ${isActive ? "text-[#9F7AEA]" : "text-[#E5E7EB]"}`}>{name}</p>
                           {sigUrl && (
                             <p className="text-[9px] text-emerald-400/70 flex items-center gap-0.5 mt-0.5">
                               <CheckCircle className="w-2.5 h-2.5" /> TTD tersedia
                             </p>
                           )}
                         </div>
                         {isActive && <CheckCircle className="w-4 h-4 text-[#9F7AEA] flex-shrink-0" />}
                       </button>
                     );
                   })}
                 </div>
               )}

               {/* Signature preview */}
               {selectedPelapor && pelaporSigUrls[selectedPelapor] && (
                 <div className="flex items-center gap-3 bg-[#14161A]/60 rounded-xl px-3.5 py-2.5 border border-[rgba(79,209,255,0.05)]">
                   <img
                     src={pelaporSigUrls[selectedPelapor]}
                     alt={`TTD ${selectedPelapor}`}
                     className="h-10 rounded-lg bg-white/5 p-1"
                     onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                   />
                   <div className="min-w-0">
                     <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">Preview TTD</p>
                     <p className="text-xs font-semibold text-emerald-400">{selectedPelapor}</p>
                   </div>
                 </div>
               )}

               {!selectedPelapor && selectedPdfDates.size > 0 && (
                 <div className="bg-amber-500/[0.06] border border-amber-500/15 rounded-xl px-3 py-2 flex items-center gap-2">
                   <span className="text-amber-400 text-sm">⚠️</span>
                   <p className="text-[10px] text-amber-300">Pilih pelapor dulu sebelum generate PDF</p>
                 </div>
               )}
             </div>
           </CollapsibleSection>

           {/* ═══════ PROGRESS SECTION ═══════ */}
           {pdfGenerating && (
             <div className="bg-[#1E2028] rounded-2xl border border-[#4FD1FF]/15 p-4 shadow-[0_0_20px_rgba(79,209,255,0.06)] space-y-3">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-[#4FD1FF]/[0.08] border border-[#4FD1FF]/15 flex items-center justify-center animate-pulse">
                   <Loader2 className="w-5 h-5 text-[#4FD1FF] animate-spin" />
                 </div>
                 <div className="flex-1 min-w-0">
                   <p className="text-xs font-semibold text-[#E5E7EB] truncate">{pdfProgress || 'Mempersiapkan...'}</p>
                   <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                     PDF {pdfProgressNum.current} dari {pdfProgressNum.total}
                   </p>
                 </div>
                 <span className="text-lg font-bold text-[#4FD1FF] tabular-nums flex-shrink-0">
                   {pdfProgressNum.total > 0 ? Math.round((pdfProgressNum.current / pdfProgressNum.total) * 100) : 0}%
                 </span>
               </div>

               {/* Main progress bar */}
               <div className="w-full bg-[#14161A] rounded-full h-2.5 overflow-hidden">
                 <div
                   className="h-full rounded-full bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] transition-all duration-700 ease-out"
                   style={{ width: `${pdfProgressNum.total > 0 ? (pdfProgressNum.current / pdfProgressNum.total) * 100 : 0}%` }}
                 />
               </div>

               {/* Photo sub-progress */}
               {photoProgress.total > 0 && (
                 <div className="bg-[#14161A]/60 rounded-xl px-3 py-2 border border-[rgba(79,209,255,0.05)]">
                   <div className="flex items-center justify-between mb-1.5">
                     <span className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
                       <ImageIcon className="w-3 h-3" /> Foto dokumentasi
                     </span>
                     <span className="text-[10px] text-emerald-400 tabular-nums font-medium">
                       {photoProgress.current}/{photoProgress.total}
                     </span>
                   </div>
                   <div className="w-full bg-[#14161A] rounded-full h-1.5 overflow-hidden">
                     <div
                       className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                       style={{ width: `${(photoProgress.current / photoProgress.total) * 100}%` }}
                     />
                   </div>
                 </div>
               )}

               <p className="text-[9px] text-[#9CA3AF] text-center">⏳ Mohon tunggu, sedang memproses...</p>
             </div>
           )}

           {/* ═══════ GENERATE BUTTON ═══════ */}
           <div className="bg-[#1E2028] rounded-2xl border border-[rgba(79,209,255,0.06)] p-4 shadow-[4px_4px_12px_rgba(0,0,0,0.35),-2px_-2px_8px_rgba(255,255,255,0.02)]">
             {/* Summary before generate */}
             {selectedPdfDates.size > 0 && !pdfGenerating && (
               <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[rgba(79,209,255,0.06)]">
                 <div className="flex-1 flex flex-wrap gap-1.5">
                   {Array.from(selectedPdfDates).sort().slice(0, 8).map(d => {
                     const { display, dayName } = formatTabDate(d);
                     return (
                       <span key={d} className="text-[9px] bg-[#4FD1FF]/[0.08] text-[#4FD1FF] px-2 py-0.5 rounded-full border border-[#4FD1FF]/12">
                         {dayName} {display}
                       </span>
                     );
                   })}
                   {selectedPdfDates.size > 8 && (
                     <span className="text-[9px] text-[#9CA3AF]">+{selectedPdfDates.size - 8} lagi</span>
                   )}
                 </div>
               </div>
             )}

             <Button
               onClick={handleBatchPdf}
               disabled={selectedPdfDates.size === 0 || pdfGenerating || !selectedPelapor}
               className="w-full bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] hover:from-[#4FD1FF]/90 hover:to-[#9F7AEA]/90 text-white font-bold py-3 text-sm rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(79,209,255,0.15)] hover:shadow-[0_4px_24px_rgba(79,209,255,0.25)] transition-all duration-300"
             >
               {pdfGenerating ? (
                 <>
                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                   Generating {pdfProgressNum.current}/{pdfProgressNum.total}...
                 </>
               ) : (
                 <>
                   <Download className="w-4 h-4 mr-2" />
                   Generate {selectedPdfDates.size > 0 ? `${selectedPdfDates.size} PDF${selectedPdfDates.size > 1 ? "s" : ""}` : "PDF"}
                 </>
               )}
             </Button>

             {selectedPdfDates.size === 0 && !pdfGenerating && (
               <p className="text-[10px] text-[#9CA3AF] text-center mt-2">Pilih tanggal dan pelapor untuk mulai generate</p>
             )}
           </div>

           {/* ═══════ TIPS ═══════ */}
           <div className="bg-[#1E2028]/60 rounded-2xl p-4 border border-[rgba(79,209,255,0.04)]">
             <div className="flex gap-3">
               <div className="w-8 h-8 rounded-lg bg-amber-500/[0.08] border border-amber-500/10 flex items-center justify-center flex-shrink-0">
                 <span className="text-sm">💡</span>
               </div>
               <div className="text-[11px] text-[#9CA3AF] leading-relaxed space-y-1">
                 <p><strong className="text-[#E5E7EB]/80">Batch Download:</strong> Pilih beberapa tanggal sekaligus untuk download semua PDF sekaligus.</p>
                 <p><strong className="text-[#E5E7EB]/80">Cloud Backup:</strong> Setiap PDF otomatis di-backup ke cloud setelah generate.</p>
                 <p><strong className="text-[#E5E7EB]/80">Format:</strong> PDF landscape A4 dengan tanda tangan QC & Manajer.</p>
               </div>
             </div>
           </div>
         </>
       )}
     </main>

     <Footer />
   </div>
 );
}