import { useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Zap, CheckCircle, AlertTriangle, Send, Loader2, ClipboardPaste, X, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/ui/footer";
import { MultiFileUpload } from "@/components/ui/multi-file-upload";
import { getCurrentWIBDateString } from "@shared/timezone";

// ========================
// TYPES & CONSTANTS
// ========================

type Station = "NOODLE" | "DIMSUM" | "BAR" | "PRODUKSI";
type Shift = "OPENING" | "MIDDLE" | "CLOSING" | "MIDNIGHT";
type AutoStep = "config" | "paste" | "preview" | "success";

const VALID_SHIFTS: Shift[] = ["OPENING", "MIDDLE", "CLOSING", "MIDNIGHT"];
const VALID_STATIONS: Station[] = ["NOODLE", "DIMSUM", "BAR", "PRODUKSI"];
const VALID_QC = ["PAJAR", "RIZKI", "JOHAN", "LUISA"];
const VALID_MANAGERS = ["GISSEL", "ANISA", "HUTRI", "IMBRON", "AQIL"];
const STORES = ["BEKASI KP. BULU", "BEKASI JATIASIH", "CIKARANG"];

const STATION_ICONS: Record<Station, string> = {
  NOODLE: "🍜", DIMSUM: "🥟", BAR: "🍹", PRODUKSI: "🏭",
};

type ParsedItem = {
  namaProduk: string;
  kodeLot: string;
  qty: number;
  unit: string;
  alasan: string;
};

type ParseError = {
  line: number;
  message: string;
};

// ========================
// ITEM-ONLY PARSER
// ========================

function parseItems(text: string): { items: ParsedItem[]; errors: ParseError[] } {
  const errors: ParseError[] = [];
  const items: ParsedItem[] = [];
  const lines = text.trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) {
    return { items: [], errors: [{ line: 0, message: "Data kosong. Paste minimal 1 item." }] };
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lineNum = i + 1;

    // Skip "Data Item:" header if user accidentally pastes it
    if (/^data\s*item/i.test(line)) continue;

    // Remove leading "- " or "• " or number prefix like "1. "
    line = line.replace(/^[-•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
    if (!line) continue;

    // Format: NAMA PRODUK (KODE_LOT): QTY UNIT ALASAN
    const withLot = line.match(/^(.+?)\s*\(([^)]+)\)\s*:\s*(\d+)\s+(\S+)\s+(.+)$/);
    if (withLot) {
      items.push({
        namaProduk: withLot[1].trim().toUpperCase(),
        kodeLot: withLot[2].trim(),
        qty: parseInt(withLot[3]),
        unit: withLot[4].trim().toUpperCase(),
        alasan: withLot[5].trim(),
      });
      continue;
    }

    // Format without kode lot: NAMA PRODUK: QTY UNIT ALASAN
    const noLot = line.match(/^(.+?):\s*(\d+)\s+(\S+)\s+(.+)$/);
    if (noLot) {
      items.push({
        namaProduk: noLot[1].trim().toUpperCase(),
        kodeLot: "",
        qty: parseInt(noLot[2]),
        unit: noLot[3].trim().toUpperCase(),
        alasan: noLot[4].trim(),
      });
      continue;
    }

    errors.push({ line: lineNum, message: `Format salah: "${line}". Gunakan: NAMA (KODE LOT): QTY SATUAN ALASAN` });
  }

  if (items.length === 0 && errors.length === 0) {
    errors.push({ line: 0, message: "Tidak ada item yang berhasil di-parse" });
  }

  return { items, errors };
}

// ========================
// MAIN COMPONENT
// ========================

export default function AutoWaste() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Step
  const [step, setStep] = useState<AutoStep>("config");

  // Config state
  const [selectedDate, setSelectedDate] = useState(getCurrentWIBDateString());
  const [storeName, setStoreName] = useState("BEKASI KP. BULU");
  const [selectedShift, setSelectedShift] = useState<Shift | "">("");
  const [selectedQC, setSelectedQC] = useState<string>("");
  const [selectedManajer, setSelectedManajer] = useState<string>("");
  const [selectedStation, setSelectedStation] = useState<Station | "">("");
  const [jam, setJam] = useState("");

  // Paste state
  const [rawText, setRawText] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dokumentasiFiles, setDokumentasiFiles] = useState<File[]>([]);
  const [signatureUrls, setSignatureUrls] = useState<Record<string, string>>({});
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);

  // Config validation
  const configReady = selectedShift && selectedQC && selectedManajer && selectedStation && jam;

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

  // Parse items
  const handleParse = useCallback(() => {
    const { items, errors } = parseItems(rawText);
    setParsedItems(items);
    setParseErrors(errors);
    if (items.length > 0 && errors.length === 0) {
      setStep("preview");
    }
  }, [rawText]);

  // Submit data
  const handleSubmit = useCallback(async () => {
    if (!parsedItems.length || !selectedStation || !selectedShift || !selectedQC || !selectedManajer) return;
    setIsSubmitting(true);

    try {
      const qcUrl = signatureUrls[selectedQC] || "";
      const mgrUrl = signatureUrls[selectedManajer] || "";

      if (!qcUrl) throw new Error(`TTD untuk QC "${selectedQC}" tidak ditemukan`);
      if (!mgrUrl) throw new Error(`TTD untuk Manajer "${selectedManajer}" tidak ditemukan`);

      const jamFormatted = jam.includes("WIB") ? jam : `${jam} WIB`;
      const jamList = parsedItems.map(() => jamFormatted);

      const formData = new FormData();
      formData.append("tanggal", selectedDate);
      formData.append("kategoriInduk", selectedStation);
      formData.append("shift", selectedShift);
      formData.append("storeName", storeName);
      formData.append("parafQCUrl", qcUrl);
      formData.append("parafManagerUrl", mgrUrl);
      formData.append("productList", JSON.stringify(parsedItems.map(i => i.namaProduk)));
      formData.append("kodeProdukList", JSON.stringify(parsedItems.map(i => i.kodeLot)));
      formData.append("jumlahProdukList", JSON.stringify(parsedItems.map(i => i.qty)));
      formData.append("unitList", JSON.stringify(parsedItems.map(i => i.unit)));
      formData.append("metodePemusnahanList", JSON.stringify(parsedItems.map(() => "DIBUANG")));
      formData.append("alasanPemusnahanList", JSON.stringify(parsedItems.map(i => i.alasan)));
      formData.append("jamTanggalPemusnahan", jamFormatted);
      formData.append("jamTanggalPemusnahanList", JSON.stringify(jamList));

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

      setStep("success");
      toast({
        title: "✅ Berhasil!",
        description: `Data ${selectedStation} - ${selectedShift} berhasil disimpan`,
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
  }, [parsedItems, signatureUrls, selectedDate, storeName, selectedStation, selectedShift, selectedQC, selectedManajer, jam, dokumentasiFiles, toast]);

  // Copy format template
  const copyTemplate = useCallback(() => {
    navigator.clipboard.writeText(
      "- Mie Goreng (2025-03-09): 5 PCS Expired\n- Dimsum Ayam (2025-03-09): 3 PACK Rusak"
    );
    toast({ title: "📋 Copied!", description: "Contoh format sudah di-copy" });
  }, [toast]);

  // Reset for new entry
  const handleNewEntry = useCallback(() => {
    setRawText("");
    setParsedItems([]);
    setParseErrors([]);
    setDokumentasiFiles([]);
    setSelectedStation("");
    setSelectedShift("");
    setSelectedQC("");
    setSelectedManajer("");
    setJam("");
    setStep("config");
  }, []);

  // Back navigation
  const handleBack = useCallback(() => {
    if (step === "config") setLocation("/");
    else if (step === "paste") setStep("config");
    else if (step === "preview") setStep("paste");
    else setStep("config");
  }, [step, setLocation]);

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
              onClick={handleBack}
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
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {(["config", "paste", "preview", "success"] as AutoStep[]).map((s, i) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-colors ${
                  step === s ? "bg-cyan-400" : 
                  (["config", "paste", "preview", "success"].indexOf(step) > i) ? "bg-cyan-700" : "bg-slate-700"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-4 space-y-4">
        {/* ========== STEP: CONFIG ========== */}
        {step === "config" && (
          <div className="space-y-4 max-w-xl mx-auto">
            <div className="text-center">
              <h2 className="text-lg font-bold text-cyan-400 mb-1">⚡ Konfigurasi</h2>
              <p className="text-xs text-slate-400">Pilih semua parameter, lalu paste data item</p>
            </div>

            {/* Date & Store row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">📅 Tanggal</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">🏪 Store</label>
                <select
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none"
                >
                  {STORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Station picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">🏭 Station</label>
              <div className="grid grid-cols-4 gap-2">
                {VALID_STATIONS.map(st => (
                  <button
                    key={st}
                    onClick={() => setSelectedStation(st)}
                    className={`p-3 rounded-lg border-2 text-center transition-all duration-200 ${
                      selectedStation === st
                        ? "border-cyan-500 bg-cyan-950/40 text-cyan-400 shadow-lg shadow-cyan-500/10"
                        : "border-slate-700/50 bg-slate-900/30 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-xl">{STATION_ICONS[st]}</div>
                    <div className="text-[10px] font-bold mt-0.5">{st}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Shift & Jam row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">🕐 Shift</label>
                <select
                  value={selectedShift}
                  onChange={e => setSelectedShift(e.target.value as Shift)}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none"
                >
                  <option value="" disabled>-- Pilih Shift --</option>
                  {VALID_SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">⏰ Jam Pemusnahan</label>
                <input
                  type="time"
                  value={jam}
                  onChange={e => setJam(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* QC & Manajer row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">🔍 QC</label>
                <select
                  value={selectedQC}
                  onChange={e => setSelectedQC(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none"
                >
                  <option value="" disabled>-- Pilih QC --</option>
                  {VALID_QC.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                {selectedQC && signatureUrls[selectedQC] && (
                  <div className="flex items-center gap-2 mt-1 p-1.5 rounded bg-slate-800/50 border border-slate-700/30">
                    <img src={signatureUrls[selectedQC]} alt="TTD" className="h-6 rounded bg-white/10 p-0.5" />
                    <span className="text-[10px] text-green-400">✓ TTD ready</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">👔 Manajer</label>
                <select
                  value={selectedManajer}
                  onChange={e => setSelectedManajer(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none"
                >
                  <option value="" disabled>-- Pilih Manajer --</option>
                  {VALID_MANAGERS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {selectedManajer && signatureUrls[selectedManajer] && (
                  <div className="flex items-center gap-2 mt-1 p-1.5 rounded bg-slate-800/50 border border-slate-700/30">
                    <img src={signatureUrls[selectedManajer]} alt="TTD" className="h-6 rounded bg-white/10 p-0.5" />
                    <span className="text-[10px] text-green-400">✓ TTD ready</span>
                  </div>
                )}
              </div>
            </div>

            {isLoadingSignatures && (
              <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Memuat tanda tangan...
              </p>
            )}

            <Button
              onClick={() => setStep("paste")}
              disabled={!configReady}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-5 text-base font-bold disabled:opacity-40"
            >
              Lanjut Paste Data Item →
            </Button>
          </div>
        )}

        {/* ========== STEP: PASTE ========== */}
        {step === "paste" && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-lg font-bold text-cyan-400 mb-1">📋 Paste Data Item</h2>
              <p className="text-xs text-slate-400">
                {STATION_ICONS[selectedStation as Station]} <span className="text-white font-bold">{selectedStation}</span> • {selectedShift} • {selectedDate}
              </p>
            </div>

            {/* Format reference */}
            <div className="p-3 rounded-lg border border-cyan-800/30 bg-cyan-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-cyan-400">📝 Format per baris</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyTemplate}
                  className="text-xs text-cyan-400 hover:text-cyan-300 h-6 px-2"
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
              <pre className="text-[11px] text-slate-400 font-mono leading-relaxed">{
`- NAMA PRODUK (KODE LOT): QTY SATUAN ALASAN

Contoh:
- Mie Goreng (2025-03-09): 5 PCS Expired
- Dimsum Ayam (2025-03-09): 3 PACK Rusak`
              }</pre>
            </div>

            {/* Text input */}
            <div className="relative">
              <textarea
                value={rawText}
                onChange={e => { setRawText(e.target.value); setParseErrors([]); }}
                placeholder={`Paste data item di sini...\n\nContoh:\n- Mie Goreng (2025-03-09): 5 PCS Expired\n- Dimsum Ayam (2025-03-09): 3 PACK Rusak\n- Bakso Ikan (2025-03-09): 2 PACK Stale`}
                className="w-full h-52 px-4 py-3 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white font-mono text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none placeholder:text-slate-600"
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
                  <span>Error ({parseErrors.length})</span>
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
                    toast({ title: "⚠️ Gagal", description: "Tidak bisa akses clipboard. Paste manual.", variant: "destructive" });
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
        {step === "preview" && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-lg font-bold text-green-400 mb-1">✅ Preview Data</h2>
              <p className="text-xs text-slate-400">Periksa data sebelum submit</p>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg border border-slate-700/50 bg-slate-900/30 text-center">
                <p className="text-[10px] text-slate-500">Station</p>
                <p className="text-sm font-bold text-white">{STATION_ICONS[selectedStation as Station]} {selectedStation}</p>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-700/50 bg-slate-900/30 text-center">
                <p className="text-[10px] text-slate-500">Shift</p>
                <p className="text-sm font-bold text-white">{selectedShift}</p>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-700/50 bg-slate-900/30 text-center">
                <p className="text-[10px] text-slate-500">Jam</p>
                <p className="text-sm font-bold text-yellow-400">{jam} WIB</p>
              </div>
            </div>

            {/* QC & Manajer */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg border border-slate-700/50 bg-slate-900/30">
                <p className="text-[10px] text-slate-500">QC</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-cyan-400">{selectedQC}</p>
                  {signatureUrls[selectedQC] && (
                    <img src={signatureUrls[selectedQC]} alt="TTD QC" className="h-6 rounded bg-white/10 p-0.5" />
                  )}
                </div>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-700/50 bg-slate-900/30">
                <p className="text-[10px] text-slate-500">Manajer</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-purple-400">{selectedManajer}</p>
                  {signatureUrls[selectedManajer] && (
                    <img src={signatureUrls[selectedManajer]} alt="TTD Manajer" className="h-6 rounded bg-white/10 p-0.5" />
                  )}
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="rounded-lg border border-slate-700/50 overflow-hidden">
              <div className="bg-slate-800/50 px-3 py-2 text-xs font-bold text-cyan-400">
                📦 Data Item ({parsedItems.length} produk)
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
                    {parsedItems.map((item, i) => (
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
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Submit ke Spreadsheet</>
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
                {selectedStation} - {selectedShift} berhasil direcord ke Google Sheets
              </p>
            </div>

            <div className="p-4 rounded-lg border border-green-800/30 bg-green-950/20 text-left space-y-1 text-sm">
              <p><span className="text-slate-400">Tanggal:</span> <span className="text-white">{selectedDate}</span></p>
              <p><span className="text-slate-400">Store:</span> <span className="text-white">{storeName}</span></p>
              <p><span className="text-slate-400">Station:</span> <span className="text-white">{STATION_ICONS[selectedStation as Station]} {selectedStation}</span></p>
              <p><span className="text-slate-400">Shift:</span> <span className="text-white">{selectedShift}</span></p>
              <p><span className="text-slate-400">Jam:</span> <span className="text-yellow-400">{jam} WIB</span></p>
              <p><span className="text-slate-400">Items:</span> <span className="text-white">{parsedItems.length} produk</span></p>
              <p><span className="text-slate-400">QC:</span> <span className="text-cyan-400">{selectedQC}</span></p>
              <p><span className="text-slate-400">Manajer:</span> <span className="text-purple-400">{selectedManajer}</span></p>
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
