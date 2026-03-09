import { useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Zap, CheckCircle, AlertTriangle, Upload, Send, RotateCcw, Loader2, Copy, ClipboardPaste, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/ui/footer";
import { MultiFileUpload } from "@/components/ui/multi-file-upload";
import { getCurrentWIBDateString } from "@shared/timezone";
import wasteLogo from "@assets/waste-logo_1753322218969.webp";

// ========================
// TYPES & CONSTANTS
// ========================

type Station = "NOODLE" | "DIMSUM" | "BAR" | "PRODUKSI";
type Shift = "OPENING" | "MIDDLE" | "CLOSING" | "MIDNIGHT";
type AutoStep = "config" | "station" | "paste" | "preview" | "photos" | "success";

const VALID_SHIFTS: Shift[] = ["OPENING", "MIDDLE", "CLOSING", "MIDNIGHT"];
const VALID_STATIONS: Station[] = ["NOODLE", "DIMSUM", "BAR", "PRODUKSI"];
const VALID_QC = ["PAJAR", "RIZKI", "JOHAN", "LUISA"];
const VALID_MANAGERS = ["GISSEL", "ANISA", "HUTRI", "IMBRON", "AQIL"];

const STORES = ["BEKASI KP. BULU", "BEKASI JATIASIH", "CIKARANG"];

const STATION_STYLES: Record<Station, { active: string; icon: string }> = {
  NOODLE: { active: "border-yellow-500 bg-yellow-950/40 shadow-yellow-500/20", icon: "🍜" },
  DIMSUM: { active: "border-red-500 bg-red-950/40 shadow-red-500/20", icon: "🥟" },
  BAR: { active: "border-blue-500 bg-blue-950/40 shadow-blue-500/20", icon: "🍹" },
  PRODUKSI: { active: "border-green-500 bg-green-950/40 shadow-green-500/20", icon: "🏭" },
};

type ParsedItem = {
  namaProduk: string;
  kodeLot: string;
  qty: number;
  unit: string;
  alasan: string;
};

type ParsedData = {
  shift: Shift;
  qc: string;
  manajer: string;
  station: Station;
  jam: string;
  items: ParsedItem[];
};

type ParseError = {
  line: number;
  message: string;
};

// ========================
// FORMAT PARSER
// ========================

function parseAutoFormat(text: string, selectedStation: Station): { data: ParsedData | null; errors: ParseError[] } {
  const errors: ParseError[] = [];
  const lines = text.trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) {
    return { data: null, errors: [{ line: 0, message: "Format kosong" }] };
  }

  let shift: Shift | null = null;
  let qc: string | null = null;
  let manajer: string | null = null;
  let station: Station | null = null;
  let jam: string | null = null;
  const items: ParsedItem[] = [];
  let inDataSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Parse header fields
    if (line.toUpperCase().startsWith("SHIFT:")) {
      const val = line.substring(6).trim().toUpperCase();
      if (VALID_SHIFTS.includes(val as Shift)) {
        shift = val as Shift;
      } else {
        errors.push({ line: lineNum, message: `Shift "${val}" tidak valid. Gunakan: ${VALID_SHIFTS.join(", ")}` });
      }
      continue;
    }

    if (line.toUpperCase().startsWith("QC:")) {
      const val = line.substring(3).trim().toUpperCase();
      if (VALID_QC.includes(val)) {
        qc = val;
      } else {
        errors.push({ line: lineNum, message: `QC "${val}" tidak valid. Gunakan: ${VALID_QC.join(", ")}` });
      }
      continue;
    }

    if (line.toUpperCase().startsWith("MANAJER:")) {
      const val = line.substring(8).trim().toUpperCase();
      if (VALID_MANAGERS.includes(val)) {
        manajer = val;
      } else {
        errors.push({ line: lineNum, message: `Manajer "${val}" tidak valid. Gunakan: ${VALID_MANAGERS.join(", ")}` });
      }
      continue;
    }

    if (line.toUpperCase().startsWith("STATION:")) {
      const val = line.substring(8).trim().toUpperCase();
      if (VALID_STATIONS.includes(val as Station)) {
        station = val as Station;
        if (station !== selectedStation) {
          errors.push({ line: lineNum, message: `Station "${val}" tidak cocok dengan pilihan "${selectedStation}"` });
        }
      } else {
        errors.push({ line: lineNum, message: `Station "${val}" tidak valid. Gunakan: ${VALID_STATIONS.join(", ")}` });
      }
      continue;
    }

    if (line.toUpperCase().startsWith("JAM PEMUSNAHAN:") || line.toUpperCase().startsWith("JAM:")) {
      const colonIdx = line.indexOf(":");
      const val = line.substring(colonIdx + 1).trim();
      // Extract time - accept formats like "14:30 WIB", "14:30", "2:30 WIB"
      const timeMatch = val.match(/(\d{1,2}[:.]\d{2})/);
      if (timeMatch) {
        jam = timeMatch[1].replace(".", ":") + " WIB";
      } else {
        errors.push({ line: lineNum, message: `Format jam "${val}" tidak valid. Gunakan format HH:MM WIB` });
      }
      continue;
    }

    if (line.toUpperCase().startsWith("DATA ITEM")) {
      inDataSection = true;
      continue;
    }

    // Parse item lines (must start with -)
    if (line.startsWith("-")) {
      inDataSection = true;
      const itemText = line.substring(1).trim();
      
      // Format: NAMA PRODUK (KODE_LOT): QTY UNIT ALASAN
      // Also support: NAMA PRODUK (KODE_LOT): QTY UNIT - ALASAN
      const itemMatch = itemText.match(/^(.+?)\s*\(([^)]+)\)\s*:\s*(\d+)\s+(\S+)\s+(.+)$/);
      
      if (itemMatch) {
        items.push({
          namaProduk: itemMatch[1].trim().toUpperCase(),
          kodeLot: itemMatch[2].trim(),
          qty: parseInt(itemMatch[3]),
          unit: itemMatch[4].trim().toUpperCase(),
          alasan: itemMatch[5].trim(),
        });
      } else {
        // Try simpler format without kode lot: NAMA PRODUK: QTY UNIT ALASAN
        const simpleMatch = itemText.match(/^(.+?):\s*(\d+)\s+(\S+)\s+(.+)$/);
        if (simpleMatch) {
          items.push({
            namaProduk: simpleMatch[1].trim().toUpperCase(),
            kodeLot: "",
            qty: parseInt(simpleMatch[2]),
            unit: simpleMatch[3].trim().toUpperCase(),
            alasan: simpleMatch[4].trim(),
          });
        } else {
          errors.push({ line: lineNum, message: `Format item tidak valid: "${itemText}". Gunakan: NAMA (KODE_LOT): QTY UNIT ALASAN` });
        }
      }
      continue;
    }

    // Unknown line
    if (inDataSection) {
      errors.push({ line: lineNum, message: `Baris tidak dikenali: "${line}"` });
    }
  }

  // Validate required fields
  if (!shift) errors.push({ line: 0, message: 'Field "Shift:" wajib diisi' });
  if (!qc) errors.push({ line: 0, message: 'Field "QC:" wajib diisi' });
  if (!manajer) errors.push({ line: 0, message: 'Field "MANAJER:" wajib diisi' });
  if (!jam) errors.push({ line: 0, message: 'Field "Jam Pemusnahan:" wajib diisi' });
  if (items.length === 0) errors.push({ line: 0, message: "Minimal 1 item data diperlukan" });

  if (errors.length > 0) {
    return { data: null, errors };
  }

  return {
    data: {
      shift: shift!,
      qc: qc!,
      manajer: manajer!,
      station: station || selectedStation,
      jam: jam!,
      items,
    },
    errors: [],
  };
}

// ========================
// FORMAT TEMPLATE
// ========================

const FORMAT_TEMPLATE = `Shift: OPENING
QC: PAJAR
MANAJER: GISSEL
Station: NOODLE
Jam Pemusnahan: 14:30 WIB
Data Item:
- Mie Goreng (2025-03-09): 5 PCS Expired
- Dimsum Ayam (2025-03-09): 3 PACK Rusak`;

// ========================
// MAIN COMPONENT
// ========================

export default function AutoWaste() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // State
  const [step, setStep] = useState<AutoStep>("config");
  const [selectedDate, setSelectedDate] = useState(getCurrentWIBDateString());
  const [storeName, setStoreName] = useState("BEKASI KP. BULU");
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [rawText, setRawText] = useState("");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dokumentasiFiles, setDokumentasiFiles] = useState<File[]>([]);
  const [signatureUrls, setSignatureUrls] = useState<Record<string, string>>({});
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  // Fetch all signature URLs on mount
  useEffect(() => {
    async function fetchSignatures() {
      setIsLoadingSignatures(true);
      try {
        const res = await fetch("/api/signatures");
        const data = await res.json();
        if (data.success) {
          setSignatureUrls(data.signatures);
        }
      } catch (e) {
        console.error("Failed to load signatures:", e);
      } finally {
        setIsLoadingSignatures(false);
      }
    }
    fetchSignatures();
  }, []);

  // Parse text when moving to preview
  const handleParse = useCallback(() => {
    if (!selectedStation) return;
    const { data, errors } = parseAutoFormat(rawText, selectedStation);
    setParsedData(data);
    setParseErrors(errors);
    if (data && errors.length === 0) {
      setStep("preview");
    }
  }, [rawText, selectedStation]);

  // Submit data
  const handleSubmit = useCallback(async () => {
    if (!parsedData) return;
    setIsSubmitting(true);

    try {
      const qcUrl = signatureUrls[parsedData.qc] || "";
      const mgrUrl = signatureUrls[parsedData.manajer] || "";

      if (!qcUrl) {
        throw new Error(`TTD untuk QC "${parsedData.qc}" tidak ditemukan`);
      }
      if (!mgrUrl) {
        throw new Error(`TTD untuk Manajer "${parsedData.manajer}" tidak ditemukan`);
      }

      // Build per-item jam list (same time for all items in auto mode)
      const jamList = parsedData.items.map(() => parsedData.jam);

      const formData = new FormData();
      formData.append("tanggal", selectedDate);
      formData.append("kategoriInduk", parsedData.station);
      formData.append("shift", parsedData.shift);
      formData.append("storeName", storeName);
      formData.append("parafQCUrl", qcUrl);
      formData.append("parafManagerUrl", mgrUrl);
      formData.append("productList", JSON.stringify(parsedData.items.map(i => i.namaProduk)));
      formData.append("kodeProdukList", JSON.stringify(parsedData.items.map(i => i.kodeLot)));
      formData.append("jumlahProdukList", JSON.stringify(parsedData.items.map(i => i.qty)));
      formData.append("unitList", JSON.stringify(parsedData.items.map(i => i.unit)));
      formData.append("metodePemusnahanList", JSON.stringify(parsedData.items.map(() => "DIBUANG")));
      formData.append("alasanPemusnahanList", JSON.stringify(parsedData.items.map(i => i.alasan)));
      formData.append("jamTanggalPemusnahan", parsedData.jam);
      formData.append("jamTanggalPemusnahanList", JSON.stringify(jamList));

      // Append documentation photos
      dokumentasiFiles.forEach((file, idx) => {
        formData.append(`dokumentasi_${idx}`, file);
      });

      const res = await fetch("/api/auto-submit", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Gagal menyimpan data");
      }

      setSubmitResult(result);
      setStep("success");
      toast({
        title: "✅ Berhasil!",
        description: `Data ${parsedData.station} - ${parsedData.shift} berhasil disimpan`,
      });
    } catch (error) {
      toast({
        title: "❌ Gagal",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [parsedData, signatureUrls, selectedDate, storeName, dokumentasiFiles, toast]);

  // Copy template to clipboard
  const copyTemplate = useCallback(() => {
    const template = FORMAT_TEMPLATE.replace("NOODLE", selectedStation || "NOODLE");
    navigator.clipboard.writeText(template);
    toast({ title: "📋 Copied!", description: "Template format sudah di-copy" });
  }, [selectedStation, toast]);

  // Reset for new entry
  const handleNewEntry = useCallback(() => {
    setRawText("");
    setParsedData(null);
    setParseErrors([]);
    setDokumentasiFiles([]);
    setSubmitResult(null);
    setStep("station");
  }, []);

  // ========================
  // RENDER
  // ========================

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/95 flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-cyan-900/30 bg-background/80 backdrop-blur-sm">
        <div className="w-full px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => step === "config" ? setLocation("/") : setStep(
                step === "station" ? "config" :
                step === "paste" ? "station" :
                step === "preview" ? "paste" :
                step === "photos" ? "preview" :
                "config"
              )}
              className="p-2 text-slate-400 hover:text-cyan-400"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Zap className="w-5 h-5 text-cyan-400" />
            <div>
              <h1 className="text-sm font-bold text-cyan-400">Waste Otomatis</h1>
              <p className="text-[10px] text-slate-500">Fast Mode • Paste & Go</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-4 space-y-4">
        {/* ========== STEP: CONFIG (Date & Store) ========== */}
        {step === "config" && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="text-center">
              <h2 className="text-lg font-bold text-cyan-400 mb-1">⚡ Konfigurasi Awal</h2>
              <p className="text-xs text-slate-400">Pilih tanggal dan store</p>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">📅 Tanggal</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
              />
            </div>

            {/* Store */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">🏪 Store</label>
              <div className="grid grid-cols-1 gap-2">
                {STORES.map(store => (
                  <button
                    key={store}
                    onClick={() => setStoreName(store)}
                    className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      storeName === store
                        ? "border-cyan-500 bg-cyan-950/40 text-cyan-400 shadow-lg shadow-cyan-500/10"
                        : "border-slate-700/50 bg-slate-900/30 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {store}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setStep("station")}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-6 text-base font-bold"
            >
              Lanjut Pilih Station →
            </Button>
          </div>
        )}

        {/* ========== STEP: STATION ========== */}
        {step === "station" && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="text-center">
              <h2 className="text-lg font-bold text-cyan-400 mb-1">🏭 Pilih Station</h2>
              <p className="text-xs text-slate-400">{selectedDate} • {storeName}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {VALID_STATIONS.map(st => (
                <button
                  key={st}
                  onClick={() => {
                    setSelectedStation(st);
                    setStep("paste");
                  }}
                  className={`p-6 rounded-xl border-2 border-slate-700/50 bg-slate-900/30 hover:${STATION_STYLES[st].active} hover:shadow-lg transition-all duration-300 text-center`}
                >
                  <div className="text-4xl mb-2">{STATION_STYLES[st].icon}</div>
                  <h3 className="text-base font-bold text-white">{st}</h3>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ========== STEP: PASTE ========== */}
        {step === "paste" && selectedStation && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-lg font-bold text-cyan-400 mb-1">📋 Paste Format</h2>
              <p className="text-xs text-slate-400">
                Station: <span className="text-white font-bold">{selectedStation}</span> • {selectedDate}
              </p>
            </div>

            {/* Template reference */}
            <div className="p-3 rounded-lg border border-cyan-800/30 bg-cyan-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-cyan-400">📝 Format Template</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyTemplate}
                  className="text-xs text-cyan-400 hover:text-cyan-300 h-6 px-2"
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
              <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
{`Shift: (OPENING/MIDDLE/CLOSING/MIDNIGHT)
QC: (PAJAR/RIZKI/JOHAN/LUISA)
MANAJER: (GISSEL/ANISA/HUTRI/IMBRON/AQIL)
Station: ${selectedStation}
Jam Pemusnahan: (HH:MM WIB)
Data Item:
- NAMA PRODUK (KODE LOT): QTY SATUAN ALASAN`}
              </pre>
            </div>

            {/* Text input */}
            <div className="relative">
              <textarea
                value={rawText}
                onChange={e => {
                  setRawText(e.target.value);
                  setParseErrors([]);
                }}
                placeholder={`Paste format waste di sini...\n\nContoh:\nShift: OPENING\nQC: PAJAR\nMANAJER: GISSEL\nStation: ${selectedStation}\nJam Pemusnahan: 14:30 WIB\nData Item:\n- Mie Goreng (2025-03-09): 5 PCS Expired`}
                className="w-full h-64 px-4 py-3 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white font-mono text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none placeholder:text-slate-600"
              />
              {rawText && (
                <button
                  onClick={() => { setRawText(""); setParseErrors([]); }}
                  className="absolute top-2 right-2 p-1 text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="p-3 rounded-lg border border-red-800/50 bg-red-950/20 space-y-1">
                <div className="flex items-center gap-2 text-red-400 text-sm font-bold mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Format Error ({parseErrors.length})</span>
                </div>
                {parseErrors.map((err, i) => (
                  <p key={i} className="text-xs text-red-300">
                    {err.line > 0 && <span className="text-red-500">Baris {err.line}: </span>}
                    {err.message}
                  </p>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    setRawText(text);
                    toast({ title: "📋 Pasted!", description: "Teks dari clipboard berhasil di-paste" });
                  } catch {
                    toast({ title: "⚠️ Gagal", description: "Tidak bisa akses clipboard. Paste manual ya.", variant: "destructive" });
                  }
                }}
                className="flex-1 border-cyan-800/50 text-cyan-400 hover:bg-cyan-950/30"
              >
                <ClipboardPaste className="w-4 h-4 mr-2" /> Paste
              </Button>
              <Button
                onClick={handleParse}
                disabled={!rawText.trim()}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold"
              >
                <Zap className="w-4 h-4 mr-2" /> Parse & Preview
              </Button>
            </div>
          </div>
        )}

        {/* ========== STEP: PREVIEW ========== */}
        {step === "preview" && parsedData && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-lg font-bold text-green-400 mb-1">✅ Data Ter-parse</h2>
              <p className="text-xs text-slate-400">Periksa data sebelum submit</p>
            </div>

            {/* Parsed info cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg border border-slate-700/50 bg-slate-900/30">
                <p className="text-[10px] text-slate-500 uppercase">Shift</p>
                <p className="text-sm font-bold text-white">{parsedData.shift}</p>
              </div>
              <div className="p-3 rounded-lg border border-slate-700/50 bg-slate-900/30">
                <p className="text-[10px] text-slate-500 uppercase">Station</p>
                <p className="text-sm font-bold text-white">{parsedData.station}</p>
              </div>
              <div className="p-3 rounded-lg border border-slate-700/50 bg-slate-900/30">
                <p className="text-[10px] text-slate-500 uppercase">QC</p>
                <p className="text-sm font-bold text-cyan-400">{parsedData.qc}</p>
                {signatureUrls[parsedData.qc] && (
                  <img src={signatureUrls[parsedData.qc]} alt="TTD QC" className="h-8 mt-1 rounded bg-white/10 p-0.5" />
                )}
              </div>
              <div className="p-3 rounded-lg border border-slate-700/50 bg-slate-900/30">
                <p className="text-[10px] text-slate-500 uppercase">Manajer</p>
                <p className="text-sm font-bold text-purple-400">{parsedData.manajer}</p>
                {signatureUrls[parsedData.manajer] && (
                  <img src={signatureUrls[parsedData.manajer]} alt="TTD Manajer" className="h-8 mt-1 rounded bg-white/10 p-0.5" />
                )}
              </div>
              <div className="p-3 rounded-lg border border-slate-700/50 bg-slate-900/30 col-span-2">
                <p className="text-[10px] text-slate-500 uppercase">Jam Pemusnahan</p>
                <p className="text-sm font-bold text-yellow-400">{parsedData.jam}</p>
              </div>
            </div>

            {/* Items table */}
            <div className="rounded-lg border border-slate-700/50 overflow-hidden">
              <div className="bg-slate-800/50 px-3 py-2 text-xs font-bold text-cyan-400">
                📦 Data Item ({parsedData.items.length} produk)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800/30 text-slate-400">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Nama Produk</th>
                      <th className="px-3 py-2 text-left">Kode Lot</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-left">Satuan</th>
                      <th className="px-3 py-2 text-left">Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.items.map((item, i) => (
                      <tr key={i} className="border-t border-slate-800/30 hover:bg-slate-800/20">
                        <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                        <td className="px-3 py-2 text-white font-medium">{item.namaProduk}</td>
                        <td className="px-3 py-2 text-slate-300">{item.kodeLot || "-"}</td>
                        <td className="px-3 py-2 text-center text-yellow-400 font-bold">{item.qty}</td>
                        <td className="px-3 py-2 text-slate-300">{item.unit}</td>
                        <td className="px-3 py-2 text-slate-300">{item.alasan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Documentation photos */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">📸 Foto Dokumentasi (opsional)</label>
              <MultiFileUpload
                onFilesSelect={setDokumentasiFiles}
                maxFiles={10}
                accept="image/*"
                label="Foto Dokumentasi"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("paste")}
                className="flex-1 border-slate-700/50 text-slate-400"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" /> Submit ke Spreadsheet
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ========== STEP: SUCCESS ========== */}
        {step === "success" && (
          <div className="space-y-6 max-w-xl mx-auto text-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">Data Tersimpan! 🎉</h2>
              <p className="text-sm text-slate-400">
                {parsedData?.station} - {parsedData?.shift} berhasil direcord ke Google Sheets
              </p>
            </div>

            <div className="p-4 rounded-lg border border-green-800/30 bg-green-950/20 text-left space-y-1 text-sm">
              <p><span className="text-slate-400">Tanggal:</span> <span className="text-white">{selectedDate}</span></p>
              <p><span className="text-slate-400">Store:</span> <span className="text-white">{storeName}</span></p>
              <p><span className="text-slate-400">Station:</span> <span className="text-white">{parsedData?.station}</span></p>
              <p><span className="text-slate-400">Shift:</span> <span className="text-white">{parsedData?.shift}</span></p>
              <p><span className="text-slate-400">Items:</span> <span className="text-white">{parsedData?.items.length} produk</span></p>
              <p><span className="text-slate-400">QC:</span> <span className="text-cyan-400">{parsedData?.qc}</span></p>
              <p><span className="text-slate-400">Manajer:</span> <span className="text-purple-400">{parsedData?.manajer}</span></p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleNewEntry}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-5 text-base font-bold"
              >
                <Zap className="w-5 h-5 mr-2" /> Input Station Lain
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="w-full border-slate-700/50 text-slate-400"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Menu
              </Button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
