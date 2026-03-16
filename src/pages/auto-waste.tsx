import { useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Zap, CheckCircle, AlertTriangle, Send, Loader2, ClipboardPaste, X, Copy, CheckCheck, RefreshCw, WifiOff, ShieldAlert, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/ui/footer";
import { MultiFileUpload } from "@/components/ui/multi-file-upload";
import { getCurrentWIBDateString } from "@shared/timezone";
import { apiFetch, ApiRequestError, getErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";

// ========================
// TYPES & CONSTANTS
// ========================

type Station = "NOODLE" | "DIMSUM" | "BAR" | "PRODUKSI";
type Shift = "OPENING" | "MIDDLE" | "CLOSING" | "MIDNIGHT";
type AutoStep = "config" | "paste" | "preview" | "success";

const VALID_SHIFTS: Shift[] = ["OPENING", "MIDDLE", "CLOSING", "MIDNIGHT"];
const VALID_STATIONS: Station[] = ["NOODLE", "DIMSUM", "BAR", "PRODUKSI"];

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

// Per-station submission status
type StationSubmitStatus = "pending" | "uploading" | "success" | "error";

// ========================
// ITEM-ONLY PARSER
// ========================

function parseItems(text: string): { items: ParsedItem[]; errors: ParseError[] } {
  const errors: ParseError[] = [];
  const items: ParsedItem[] = [];
  const lines = text.trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) {
    return { items: [], errors: [{ line: 0, message: "Kosong nih. Paste minimal 1 item dulu." }] };
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

    errors.push({ line: lineNum, message: `Format salah nih: "${line}". Gunakan: NAMA (KODE LOT): QTY SATUAN ALASAN` });
  }

  if (items.length === 0 && errors.length === 0) {
    errors.push({ line: 0, message: "Ga ada item yang ke-parse" });
  }

  return { items, errors };
}

// ========================
// MAIN COMPONENT
// ========================

export default function AutoWaste() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { tenantName } = useAuth();

  // Step
  const [step, setStep] = useState<AutoStep>("config");

  // Config state
  const [selectedDate, setSelectedDate] = useState(getCurrentWIBDateString());
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    if (tenantName) setStoreName(tenantName);
  }, [tenantName]);

  const [selectedShift, setSelectedShift] = useState<Shift | "">("");
  const [validQC, setValidQC] = useState<string[]>([]);
  const [validManagers, setValidManagers] = useState<string[]>([]);
  const [personnelLoading, setPersonnelLoading] = useState(true);
  const [selectedQC, setSelectedQC] = useState<string>("");
  const [selectedManajer, setSelectedManajer] = useState<string>("");
  const [jam, setJam] = useState("");

  // Multi-station selection
  const [selectedStations, setSelectedStations] = useState<Station[]>([]);
  const allStationsSelected = selectedStations.length === VALID_STATIONS.length;

  // Per-station paste state
  const [rawTexts, setRawTexts] = useState<Record<Station, string>>({
    NOODLE: "", DIMSUM: "", BAR: "", PRODUKSI: "",
  });
  const [parsedItemsMap, setParsedItemsMap] = useState<Record<Station, ParsedItem[]>>({
    NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [],
  });
  const [parseErrorsMap, setParseErrorsMap] = useState<Record<Station, ParseError[]>>({
    NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [],
  });

  // Per-station doc files
  const [dokumentasiFilesMap, setDokumentasiFilesMap] = useState<Record<Station, File[]>>({
    NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [],
  });

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusMap, setSubmitStatusMap] = useState<Record<Station, StationSubmitStatus>>({
    NOODLE: "pending", DIMSUM: "pending", BAR: "pending", PRODUKSI: "pending",
  });
  // Per-station error details
  const [stationErrors, setStationErrors] = useState<Record<Station, string>>({
    NOODLE: "", DIMSUM: "", BAR: "", PRODUKSI: "",
  });
  const [signatureUrls, setSignatureUrls] = useState<Record<string, string>>({});
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);

  // Global progress state
  const [globalProgress, setGlobalProgress] = useState({
    current: 0,
    total: 0,
    currentStation: "" as string,
    phase: "" as "uploading" | "processing" | "",
    percent: 0,
  });

  // Config validation
  const configReady = selectedShift && selectedQC && selectedManajer && selectedStations.length > 0 && jam;

  // Toggle station selection
  const toggleStation = (station: Station) => {
    setSelectedStations(prev =>
      prev.includes(station) ? prev.filter(s => s !== station) : [...prev, station]
    );
  };

  const toggleAllStations = () => {
    setSelectedStations(allStationsSelected ? [] : [...VALID_STATIONS]);
  };

  // Fetch signatures
  useEffect(() => {
    async function fetchSignatures() {
      setIsLoadingSignatures(true);
      try {
        const res = await apiFetch("/api/signatures");
        const data = await res.json();
        if (data.success) {
          setSignatureUrls(data.signatures);
        }
      } catch (e) {
        console.error("Failed to load signatures:", e);
        toast({ 
          title: "⚠️ Gagal Muat TTD", 
          description: e instanceof ApiRequestError ? getErrorMessage(e.type) : "Coba refresh halaman.",
          variant: "destructive" 
        });
      } finally {
        setIsLoadingSignatures(false);
      }
    }
    fetchSignatures();
  }, []);

  // Fetch QC & Manager lists
  useEffect(() => {
    async function fetchPersonnel() {
      setPersonnelLoading(true);
      try {
        const tenantId = localStorage.getItem("waste_app_tenant_id") || "";
        const res = await apiFetch(`/api/signatures?tenant_id=${tenantId}`);
        const data = await res.json();
        if (data.success && data.personnel) {
          setValidQC(data.personnel.filter((p: any) => p.role === "qc").map((p: any) => p.name));
          setValidManagers(data.personnel.filter((p: any) => p.role === "manager").map((p: any) => p.name));
        }
      } catch (e) {
        console.error("Failed to load personnel:", e);
        toast({ 
          title: "⚠️ Gagal Muat Data QC/Manager", 
          description: e instanceof ApiRequestError ? getErrorMessage(e.type) : "Coba refresh halaman.", 
          variant: "destructive" 
        });
      } finally {
        setPersonnelLoading(false);
      }
    }
    fetchPersonnel();
  }, []);

  // Parse all stations' items
  const handleParseAll = useCallback(() => {
    const newParsedMap = { ...parsedItemsMap };
    const newErrorsMap = { ...parseErrorsMap };
    let hasItems = false;
    let hasErrors = false;

    for (const station of selectedStations) {
      const text = rawTexts[station];
      if (!text.trim()) {
        newParsedMap[station] = [];
        newErrorsMap[station] = [{ line: 0, message: `Data ${station} kosong. Paste minimal 1 item.` }];
        hasErrors = true;
        continue;
      }
      const { items, errors } = parseItems(text);
      newParsedMap[station] = items;
      newErrorsMap[station] = errors;
      if (items.length > 0) hasItems = true;
      if (errors.length > 0) hasErrors = true;
    }

    setParsedItemsMap(newParsedMap);
    setParseErrorsMap(newErrorsMap);

    if (hasItems && !hasErrors) {
      setStep("preview");
    }
  }, [rawTexts, selectedStations, parsedItemsMap, parseErrorsMap]);

  // Submit stations (supports retry for failed ones)
  const handleSubmit = useCallback(async (retryStations?: Station[]) => {
    const stationsToSubmit = retryStations || selectedStations;
    
    // Validate all stations have docs (skip on retry — already validated)
    if (!retryStations) {
      const missingDocs = stationsToSubmit.filter(st => dokumentasiFilesMap[st].length === 0);
      if (missingDocs.length > 0) {
        toast({
          title: "📸 Foto Dokumentasi Dong",
          description: `Upload foto untuk: ${missingDocs.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    
    // Reset status for stations being submitted
    const newStatusMap = { ...submitStatusMap };
    const newErrors = { ...stationErrors };
    stationsToSubmit.forEach(st => { 
      newStatusMap[st] = "pending"; 
      newErrors[st] = "";
    });
    setSubmitStatusMap(newStatusMap);
    setStationErrors(newErrors);
    setGlobalProgress({ current: 0, total: stationsToSubmit.length, currentStation: "", phase: "", percent: 0 });

    const qcUrl = signatureUrls[selectedQC] || "";
    const mgrUrl = signatureUrls[selectedManajer] || "";

    if (!qcUrl) {
      toast({ title: "❌ TTD QC Ga Ketemu", description: `Tanda tangan "${selectedQC}" belum di-upload. Tambah di Settings > Personnel.`, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    if (!mgrUrl) {
      toast({ title: "❌ TTD Manajer Ga Ketemu", description: `Tanda tangan "${selectedManajer}" belum di-upload. Tambah di Settings > Personnel.`, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const jamFormatted = jam.includes("WIB") ? jam : `${jam} WIB`;
    let successCount = 0;
    let failCount = 0;
    const failedStations: Station[] = [];

    for (let idx = 0; idx < stationsToSubmit.length; idx++) {
      const station = stationsToSubmit[idx];
      const progressPercent = Math.round((idx / stationsToSubmit.length) * 100);
      setGlobalProgress({ current: idx + 1, total: stationsToSubmit.length, currentStation: station, phase: "uploading", percent: progressPercent });
      setSubmitStatusMap(prev => ({ ...prev, [station]: "uploading" }));

      try {
        const items = parsedItemsMap[station];
        const files = dokumentasiFilesMap[station];
        const jamList = items.map(() => jamFormatted);

        const formData = new FormData();
        formData.append("tanggal", selectedDate);
        formData.append("kategoriInduk", station);
        formData.append("shift", selectedShift);
        formData.append("storeName", storeName);
        formData.append("parafQCUrl", qcUrl);
        formData.append("parafManagerUrl", mgrUrl);
        formData.append("productList", JSON.stringify(items.map(i => i.namaProduk)));
        formData.append("kodeProdukList", JSON.stringify(items.map(i => i.kodeLot)));
        formData.append("jumlahProdukList", JSON.stringify(items.map(i => i.qty)));
        formData.append("unitList", JSON.stringify(items.map(i => i.unit)));
        formData.append("metodePemusnahanList", JSON.stringify(items.map(() => "DIBUANG")));
        formData.append("alasanPemusnahanList", JSON.stringify(items.map(i => i.alasan)));
        formData.append("jamTanggalPemusnahan", jamFormatted);
        formData.append("jamTanggalPemusnahanList", JSON.stringify(jamList));

        // Upload photos one-by-one with retry
        const uploadedUrls: string[] = [];
        for (let fi = 0; fi < files.length; fi++) {
          const file = files[fi];
          const photoForm = new FormData();
          photoForm.append('mode', 'upload-photo');
          photoForm.append('photo', file);
          
          const photoRes = await apiFetch("/api/auto-submit", {
            method: "POST",
            body: photoForm,
          }, { maxRetries: 3, timeout: 60000 }); // More retries + longer timeout for uploads
          
          const photoResult = await photoRes.json();
          if (photoResult.success && photoResult.url) {
            uploadedUrls.push(photoResult.url);
          } else {
            throw new Error(`Gagal upload foto ${fi + 1}: ${photoResult.message || "Unknown error"}`);
          }
        }
        if (uploadedUrls.length > 0) {
          formData.append('dokumentasiUrls', JSON.stringify(uploadedUrls));
        }

        const res = await apiFetch("/api/auto-submit", {
          method: "POST",
          body: formData,
        }, { maxRetries: 2, timeout: 45000 });

        const result = await res.json();

        if (!res.ok || !result.success) {
          // Parse specific error from response
          const errorMsg = result.message || result.error || `Server error ${res.status}`;
          throw new Error(errorMsg);
        }

        setSubmitStatusMap(prev => ({ ...prev, [station]: "success" }));
        setGlobalProgress(prev => ({ ...prev, percent: Math.round(((idx + 1) / stationsToSubmit.length) * 100) }));
        successCount++;
      } catch (error) {
        failCount++;
        failedStations.push(station);
        setSubmitStatusMap(prev => ({ ...prev, [station]: "error" }));
        setGlobalProgress(prev => ({ ...prev, percent: Math.round(((idx + 1) / stationsToSubmit.length) * 100) }));
        
        // Store detailed error per station
        let errorMsg = "Terjadi kesalahan";
        if (error instanceof ApiRequestError) {
          errorMsg = getErrorMessage(error.type);
        } else if (error instanceof Error) {
          errorMsg = error.message;
        }
        setStationErrors(prev => ({ ...prev, [station]: errorMsg }));
      }
    }

    setGlobalProgress(prev => ({ ...prev, percent: 100, phase: "" }));
    setIsSubmitting(false);

    if (failCount === 0) {
      setStep("success");
      toast({
        title: "✅ Semua Berhasil!",
        description: `${stationsToSubmit.length} station berhasil disimpan`,
      });
    } else if (successCount > 0) {
      // Partial success — show which failed with option to retry
      toast({
        title: `⚠️ ${failCount} Station Gagal`,
        description: `${successCount} berhasil, ${failCount} gagal. Klik "Retry" untuk coba lagi.`,
        variant: "destructive",
      });
    } else {
      // All failed
      const firstError = stationErrors[failedStations[0]] || "Terjadi kesalahan";
      toast({
        title: "❌ Semua Gagal",
        description: firstError,
        variant: "destructive",
      });
    }
  }, [parsedItemsMap, signatureUrls, selectedDate, storeName, selectedStations, selectedShift, selectedQC, selectedManajer, jam, dokumentasiFilesMap, toast, submitStatusMap, stationErrors]);

  // Retry only failed stations
  const handleRetryFailed = useCallback(() => {
    const failedStations = selectedStations.filter(st => submitStatusMap[st] === "error");
    if (failedStations.length > 0) {
      handleSubmit(failedStations);
    }
  }, [selectedStations, submitStatusMap, handleSubmit]);

  // Copy format template
  const copyTemplate = useCallback(() => {
    navigator.clipboard.writeText(
      "- Mie Goreng (2025-03-09): 5 PCS Expired\n- Dimsum Ayam (2025-03-09): 3 PACK Rusak"
    );
    toast({ title: "📋 Copied!", description: "Contoh format sudah di-copy" });
  }, [toast]);

  // Reset for new entry
  const handleNewEntry = useCallback(() => {
    setRawTexts({ NOODLE: "", DIMSUM: "", BAR: "", PRODUKSI: "" });
    setParsedItemsMap({ NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [] });
    setParseErrorsMap({ NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [] });
    setDokumentasiFilesMap({ NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [] });
    setSubmitStatusMap({ NOODLE: "pending", DIMSUM: "pending", BAR: "pending", PRODUKSI: "pending" });
    setStationErrors({ NOODLE: "", DIMSUM: "", BAR: "", PRODUKSI: "" });
    setSelectedStations([]);
    setSelectedShift("");
    setSelectedQC("");
    setSelectedManajer("");
    setJam("");
    setStep("config");
  }, []);



  // Count total items across all selected stations
  const totalItems = selectedStations.reduce((sum, st) => sum + parsedItemsMap[st].length, 0);

  // ========================
  // RENDER
  // ========================

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/95 flex flex-col">
      {/* Desktop page title */}
      <div className="hidden lg:flex items-center gap-3 px-6 py-4 border-b border-cyan-900/30 bg-[hsl(220,45%,8%)]/80 backdrop-blur-sm">
        <Zap className="w-6 h-6 text-cyan-400" />
        <h1 className="text-xl font-bold text-cyan-400">Auto Waste</h1>
        <div className="flex items-center gap-1 ml-auto">
          {(["config", "paste", "preview", "success"] as AutoStep[]).map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full transition-colors ${
                step === s ? "bg-cyan-400" : 
                (["config", "paste", "preview", "success"].indexOf(step) > i) ? "bg-cyan-700" : "bg-slate-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Header - Mobile only */}
      <header className="sticky top-0 z-50 border-b border-cyan-900/30 bg-[hsl(220,45%,8%)]/95 backdrop-blur-md lg:hidden">
        <div className="w-full px-4 py-2 flex items-center justify-between desktop-header-container">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <div>
              <h1 className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Waste Otomatis</h1>
              <p className="text-[10px] text-slate-500">Fast Mode • Batch Submit</p>
              {tenantName && <p className="text-[10px] text-cyan-500/70 font-mono truncate">{tenantName}</p>}
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {(["config", "paste", "preview", "success"] as AutoStep[]).map((s, i) => (
              <div
                key={s}
                className={`w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full transition-colors ${
                  step === s ? "bg-cyan-400" : 
                  (["config", "paste", "preview", "success"].indexOf(step) > i) ? "bg-cyan-700" : "bg-slate-700"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* ========== GLOBAL PROGRESS OVERLAY ========== */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            {/* Animated icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-cyan-500/20 border-2 border-cyan-500/50 flex items-center justify-center animate-pulse">
                <Send className="w-8 h-8 text-cyan-400" />
              </div>
            </div>

            {/* Title */}
            <div className="text-center">
              <h3 className="text-lg font-bold text-white mb-1">Mengirim Data...</h3>
              <p className="text-xs text-slate-400">Jangan tutup halaman ini</p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${globalProgress.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-cyan-400 font-mono font-bold">{globalProgress.percent}%</span>
                <span className="text-slate-400">
                  Station {globalProgress.current}/{globalProgress.total}
                </span>
              </div>
            </div>

            {/* Current station status */}
            {globalProgress.currentStation && (
              <div className="p-3 rounded-lg border border-cyan-800/30 bg-cyan-950/20 text-center">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span className="text-sm text-white font-medium">
                    {STATION_ICONS[globalProgress.currentStation as Station]} {globalProgress.currentStation}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Upload {dokumentasiFilesMap[globalProgress.currentStation as Station]?.length || 0} foto + {parsedItemsMap[globalProgress.currentStation as Station]?.length || 0} item...
                </p>
              </div>
            )}

            {/* Station checklist */}
            <div className="space-y-1.5">
              {selectedStations.map((st) => (
                <div key={st} className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                  submitStatusMap[st] === "success" ? "bg-green-950/30 border border-green-800/30" :
                  submitStatusMap[st] === "uploading" ? "bg-cyan-950/30 border border-cyan-800/30" :
                  submitStatusMap[st] === "error" ? "bg-red-950/30 border border-red-800/30" :
                  "bg-slate-900/30 border border-slate-800/30"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{STATION_ICONS[st]}</span>
                    <span className={`text-xs font-medium ${
                      submitStatusMap[st] === "success" ? "text-green-400" :
                      submitStatusMap[st] === "uploading" ? "text-cyan-400" :
                      submitStatusMap[st] === "error" ? "text-red-400" :
                      "text-slate-500"
                    }`}>{st}</span>
                  </div>
                  <div className="text-xs">
                    {submitStatusMap[st] === "success" && <span className="text-green-400">✅</span>}
                    {submitStatusMap[st] === "uploading" && <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />}
                    {submitStatusMap[st] === "error" && (
                      <span className="text-red-400 flex items-center gap-1">
                        ❌ <span className="text-[9px] max-w-[100px] truncate">{stationErrors[st]}</span>
                      </span>
                    )}
                    {submitStatusMap[st] === "pending" && <span className="text-slate-600">⏳</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full px-4 py-4 lg:py-8 space-y-4 lg:space-y-6 desktop-narrow">
        {/* ========== STEP: CONFIG ========== */}
        {step === "config" && (
          <div className="space-y-4 w-full">
            {/* Desktop: inline title with tagline */}
            <div className="hidden lg:flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">AUTO WASTE</h2>
                <span className="text-sm text-slate-500">Fast Mode • Batch Submit</span>
              </div>
            </div>

            {/* Date & Resto row */}
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <div className="space-y-1.5">
                <label className="text-xs lg:text-sm font-medium text-slate-400">📅 Tanggal</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2.5 lg:px-4 lg:py-3 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm lg:text-base focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs lg:text-sm font-medium text-slate-400">🏪 Resto</label>
                <div className="w-full px-3 py-2.5 lg:px-4 lg:py-3 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm lg:text-base font-medium">
                  {storeName || 'Loading...'}
                </div>
              </div>
            </div>

            {/* Station picker — multi select */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs lg:text-sm font-medium text-slate-400">🏭 Station</label>
                <button
                  onClick={toggleAllStations}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                    allStationsSelected
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                      : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-cyan-700/50 hover:text-cyan-400"
                  }`}
                >
                  <CheckCheck className="w-3 h-3" />
                  {allStationsSelected ? "Semua Dipilih" : "Pilih Semua"}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 lg:gap-3">
                {VALID_STATIONS.map(st => (
                  <button
                    key={st}
                    onClick={() => toggleStation(st)}
                    className={`p-3 lg:p-5 rounded-lg lg:rounded-xl border-2 text-center transition-all duration-200 ${
                      selectedStations.includes(st)
                        ? "border-cyan-500 bg-cyan-950/40 text-cyan-400 shadow-lg shadow-cyan-500/10"
                        : "border-slate-700/50 bg-slate-900/30 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-xl lg:text-3xl">{STATION_ICONS[st]}</div>
                    <div className="text-[10px] lg:text-sm font-bold mt-0.5 lg:mt-1">{st}</div>
                    {selectedStations.includes(st) && (
                      <div className="text-[8px] text-cyan-500 mt-0.5">✓</div>
                    )}
                  </button>
                ))}
              </div>
              {selectedStations.length > 0 && (
                <p className="text-[10px] lg:text-xs text-cyan-400/70 text-center">
                  {selectedStations.length} station dipilih — data akan disubmit terpisah per station
                </p>
              )}
            </div>

            {/* Shift & Jam row */}
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <div className="space-y-1.5">
                <label className="text-xs lg:text-sm font-medium text-slate-400">🕐 Shift</label>
                <select
                  value={selectedShift}
                  onChange={e => setSelectedShift(e.target.value as Shift)}
                  className="w-full px-3 py-2.5 lg:px-4 lg:py-3 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm lg:text-base focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none"
                >
                  <option value="" disabled>-- Pilih Shift --</option>
                  {VALID_SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs lg:text-sm font-medium text-slate-400">⏰ Jam Pemusnahan</label>
                <input
                  type="time"
                  value={jam}
                  onChange={e => setJam(e.target.value)}
                  className="w-full px-3 py-2.5 lg:px-4 lg:py-3 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm lg:text-base focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* QC & Manajer row */}
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <div className="space-y-1.5">
                <label className="text-xs lg:text-sm font-medium text-slate-400">🔍 QC</label>
                <select
                  value={selectedQC}
                  onChange={e => setSelectedQC(e.target.value)}
                  className="w-full px-3 py-2.5 lg:px-4 lg:py-3 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm lg:text-base focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none"
                >
                  <option value="" disabled>-- Pilih QC --</option>
                  {validQC.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                {selectedQC && signatureUrls[selectedQC] && (
                  <div className="flex items-center gap-2 mt-1 p-1.5 rounded bg-slate-800/50 border border-slate-700/30">
                    <img src={signatureUrls[selectedQC]} alt="TTD" className="h-6 lg:h-8 rounded bg-white/10 p-0.5" />
                    <span className="text-[10px] lg:text-xs text-green-400">✓ TTD udah ada</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs lg:text-sm font-medium text-slate-400">👔 Manajer</label>
                <select
                  value={selectedManajer}
                  onChange={e => setSelectedManajer(e.target.value)}
                  className="w-full px-3 py-2.5 lg:px-4 lg:py-3 bg-slate-900/50 border border-cyan-800/50 rounded-lg text-white text-sm lg:text-base focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none"
                >
                  <option value="" disabled>-- Pilih Manajer --</option>
                  {validManagers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {selectedManajer && signatureUrls[selectedManajer] && (
                  <div className="flex items-center gap-2 mt-1 p-1.5 rounded bg-slate-800/50 border border-slate-700/30">
                    <img src={signatureUrls[selectedManajer]} alt="TTD" className="h-6 lg:h-8 rounded bg-white/10 p-0.5" />
                    <span className="text-[10px] lg:text-xs text-green-400">✓ TTD udah ada</span>
                  </div>
                )}
              </div>
            </div>

            {isLoadingSignatures && (
              <p className="text-xs lg:text-sm text-slate-500 text-center flex items-center justify-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Lagi ambil TTD...
              </p>
            )}

            <Button
              onClick={() => setStep("paste")}
              disabled={!configReady}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-5 lg:py-6 text-base lg:text-lg font-bold disabled:opacity-40 lg:rounded-xl"
            >
              Gas, Paste Data Item ({selectedStations.length} Station) →
            </Button>
          </div>
        )}

        {/* ========== STEP: PASTE ========== */}
        {step === "paste" && (
          <div className="space-y-4 w-full">
            <div className="text-center">
              <h2 className="text-lg lg:text-2xl font-bold text-cyan-400 mb-1 lg:mb-2">📋 Paste Data Item</h2>
              <p className="text-xs lg:text-sm text-slate-400">
                {selectedShift} • {selectedDate} • {selectedStations.length} station
              </p>
            </div>

            {/* Format reference */}
            <div className="p-3 rounded-lg border border-cyan-800/30 bg-cyan-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs lg:text-sm font-bold text-cyan-400">📝 Format tiap baris</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyTemplate}
                  className="text-xs text-cyan-400 hover:text-cyan-300 h-6 px-2"
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
              <pre className="text-[11px] lg:text-sm text-slate-400 font-mono leading-relaxed">{
`- NAMA PRODUK (KODE LOT): QTY SATUAN ALASAN

Contoh:
- Mie Goreng (2025-03-09): 5 PCS Expired
- Dimsum Ayam (2025-03-09): 3 PACK Rusak`
              }</pre>
            </div>

            {/* Per-station textareas */}
            {selectedStations.map(station => (
              <div key={station} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{STATION_ICONS[station]}</span>
                  <span className="text-sm lg:text-base font-bold text-white">{station}</span>
                  {rawTexts[station].trim() && (
                    <span className="text-[10px] text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded">ada data</span>
                  )}
                </div>
                <div className="relative">
                  <textarea
                    value={rawTexts[station]}
                    onChange={e => {
                      setRawTexts(prev => ({ ...prev, [station]: e.target.value }));
                      setParseErrorsMap(prev => ({ ...prev, [station]: [] }));
                    }}
                    placeholder={`Paste item ${station} di sini...\n\n- Mie Goreng (2025-03-09): 5 PCS Expired\n- Bakso Ikan (2025-03-09): 2 PACK Rusak`}
                    className="w-full h-36 lg:h-56 px-4 py-3 lg:px-5 lg:py-4 bg-slate-900/50 border border-cyan-800/50 rounded-lg lg:rounded-xl text-white font-mono text-sm lg:text-base focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none placeholder:text-slate-600"
                  />
                  {rawTexts[station] && (
                    <button
                      onClick={() => {
                        setRawTexts(prev => ({ ...prev, [station]: "" }));
                        setParseErrorsMap(prev => ({ ...prev, [station]: [] }));
                      }}
                      className="absolute top-2 right-2 p-1 text-slate-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Per-station paste button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setRawTexts(prev => ({ ...prev, [station]: text }));
                      toast({ title: "📋 Pasted!", description: `Teks clipboard ke-paste ke ${station}` });
                    } catch {
                      toast({ title: "⚠️ Gagal", description: "Ga bisa akses clipboard. Paste manual ya.", variant: "destructive" });
                    }
                  }}
                  className="w-full border-cyan-800/30 text-cyan-400 hover:bg-cyan-950/30 h-8 text-xs"
                >
                  <ClipboardPaste className="w-3 h-3 mr-1" /> Paste dari Clipboard ke {station}
                </Button>

                {/* Parse errors for this station */}
                {parseErrorsMap[station].length > 0 && (
                  <div className="p-2 rounded-lg border border-red-800/50 bg-red-950/20 space-y-1">
                    <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{station} — Error ({parseErrorsMap[station].length})</span>
                    </div>
                    {parseErrorsMap[station].map((err, i) => (
                      <p key={i} className="text-[10px] text-red-300">
                        {err.line > 0 && <span className="text-red-500">Baris {err.line}: </span>}
                        {err.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Parse all & proceed */}
            <Button
              onClick={handleParseAll}
              disabled={selectedStations.every(st => !rawTexts[st].trim())}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-5 lg:py-6 lg:text-lg lg:rounded-xl"
            >
              <Zap className="w-4 h-4 mr-2" /> Parse & Cek Semua Station
            </Button>
          </div>
        )}

        {/* ========== STEP: PREVIEW ========== */}
        {step === "preview" && (
          <div className="space-y-4 w-full">
            <div className="text-center">
              <h2 className="text-lg lg:text-2xl font-bold text-green-400 mb-1 lg:mb-2">✅ Cek Data</h2>
              <p className="text-xs lg:text-sm text-slate-400">
                {selectedStations.length} station • {totalItems} total item
              </p>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-3 gap-2 lg:gap-3">
              <div className="p-2.5 lg:p-4 rounded-lg border border-slate-700/50 bg-slate-900/30 text-center">
                <p className="text-[10px] lg:text-xs text-slate-500">Station</p>
                <p className="text-sm lg:text-lg font-bold text-white">{selectedStations.length}x</p>
              </div>
              <div className="p-2.5 lg:p-4 rounded-lg border border-slate-700/50 bg-slate-900/30 text-center">
                <p className="text-[10px] lg:text-xs text-slate-500">Shift</p>
                <p className="text-sm lg:text-lg font-bold text-white">{selectedShift}</p>
              </div>
              <div className="p-2.5 lg:p-4 rounded-lg border border-slate-700/50 bg-slate-900/30 text-center">
                <p className="text-[10px] lg:text-xs text-slate-500">Jam</p>
                <p className="text-sm lg:text-lg font-bold text-yellow-400">{jam} WIB</p>
              </div>
            </div>

            {/* QC & Manajer */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 lg:p-4 rounded-lg border border-slate-700/50 bg-slate-900/30">
                <p className="text-[10px] lg:text-xs text-slate-500">QC</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm lg:text-base font-bold text-cyan-400">{selectedQC}</p>
                  {signatureUrls[selectedQC] && (
                    <img src={signatureUrls[selectedQC]} alt="TTD QC" className="h-6 rounded bg-white/10 p-0.5" />
                  )}
                </div>
              </div>
              <div className="p-2.5 lg:p-4 rounded-lg border border-slate-700/50 bg-slate-900/30">
                <p className="text-[10px] lg:text-xs text-slate-500">Manajer</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm lg:text-base font-bold text-purple-400">{selectedManajer}</p>
                  {signatureUrls[selectedManajer] && (
                    <img src={signatureUrls[selectedManajer]} alt="TTD Manajer" className="h-6 rounded bg-white/10 p-0.5" />
                  )}
                </div>
              </div>
            </div>

            {/* Per-station items + documentation */}
            {selectedStations.map(station => (
              <div key={station} className="space-y-3">
                {/* Station header */}
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xl">{STATION_ICONS[station]}</span>
                  <span className="text-base lg:text-lg font-bold text-white">{station}</span>
                  <span className="text-xs lg:text-sm text-slate-500">({parsedItemsMap[station].length} item)</span>
                  {isSubmitting && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      submitStatusMap[station] === "uploading" ? "bg-yellow-900/30 text-yellow-400" :
                      submitStatusMap[station] === "success" ? "bg-green-900/30 text-green-400" :
                      submitStatusMap[station] === "error" ? "bg-red-900/30 text-red-400" :
                      "bg-slate-800/50 text-slate-500"
                    }`}>
                      {submitStatusMap[station] === "uploading" ? "⏳ Uploading..." :
                       submitStatusMap[station] === "success" ? "✅ Done" :
                       submitStatusMap[station] === "error" ? "❌ Error" : "⏸ Waiting"}
                    </span>
                  )}
                </div>

                {/* Items table */}
                <div className="rounded-lg border border-slate-700/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs lg:text-sm">
                      <thead>
                        <tr className="bg-slate-800/30 text-slate-400">
                          <th className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-left">#</th>
                          <th className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-left">Produk</th>
                          <th className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-left">Lot</th>
                          <th className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-center">Qty</th>
                          <th className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-left">Satuan</th>
                          <th className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-left">Alasan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedItemsMap[station].map((item, i) => (
                          <tr key={i} className="border-t border-slate-800/30 hover:bg-slate-800/20">
                            <td className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-slate-500">{i + 1}</td>
                            <td className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-white font-medium truncate max-w-[100px] lg:max-w-[250px]">{item.namaProduk}</td>
                            <td className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-slate-300 text-[11px] lg:text-sm">{item.kodeLot || "-"}</td>
                            <td className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-center text-yellow-400 font-bold">{item.qty}</td>
                            <td className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-slate-300">{item.unit}</td>
                            <td className="px-2 py-1.5 lg:px-4 lg:py-2.5 text-slate-300 truncate max-w-[80px] lg:max-w-[200px]">{item.alasan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Documentation photos per station */}
                <div className="space-y-2">
                  <label className="text-xs lg:text-sm font-medium text-slate-300">
                    📸 Foto Dokumentasi {station} <span className="text-red-400">*wajib</span>
                  </label>
                  <MultiFileUpload
                    onFilesSelect={(files) => setDokumentasiFilesMap(prev => ({ ...prev, [station]: files }))}
                    maxFiles={10}
                    accept="image/*"
                    label={`Foto ${station}`}
                  />
                  {dokumentasiFilesMap[station].length === 0 ? (
                    <p className="text-[10px] text-red-400 flex items-center gap-1">⚠️ Minimal 1 foto untuk {station}</p>
                  ) : (
                    <p className="text-[10px] text-green-400 flex items-center gap-1">✅ {dokumentasiFilesMap[station].length} foto siap</p>
                  )}
                </div>

                {/* Divider between stations */}
                {station !== selectedStations[selectedStations.length - 1] && (
                  <div className="border-t border-dashed border-slate-700/50 my-2" />
                )}
              </div>
            ))}

            {/* Error summary banner */}
            {selectedStations.some(st => submitStatusMap[st] === "error") && !isSubmitting && (
              <div className="p-4 rounded-lg border border-red-800/50 bg-red-950/20 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-bold text-red-400">
                    {selectedStations.filter(st => submitStatusMap[st] === "error").length} station gagal
                  </span>
                </div>
                {selectedStations.filter(st => submitStatusMap[st] === "error").map(st => (
                  <div key={st} className="flex items-start gap-2 text-xs">
                    <span className="text-red-500 font-bold">{STATION_ICONS[st]} {st}:</span>
                    <span className="text-red-300">{stationErrors[st] || "Error tidak diketahui"}</span>
                  </div>
                ))}
                <Button
                  onClick={handleRetryFailed}
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Retry {selectedStations.filter(st => submitStatusMap[st] === "error").length} Station yang Gagal
                </Button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep("paste")}
                disabled={isSubmitting}
                className="flex-1 border-slate-700/50 text-slate-400"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Benerin
              </Button>
              <Button
                onClick={() => handleSubmit()}
                disabled={isSubmitting || selectedStations.some(st => dokumentasiFilesMap[st].length === 0)}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lagi nyimpen...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Kirim {selectedStations.length} Station</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ========== STEP: SUCCESS ========== */}
        {step === "success" && (
          <div className="space-y-6 w-full text-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-green-400 mb-2">Semua Data Tersimpan! 🎉</h2>
              <p className="text-sm lg:text-base text-slate-400">
                {selectedStations.length} station — {selectedShift} udah ke-record
              </p>
            </div>

            <div className="p-4 lg:p-6 rounded-lg lg:rounded-xl border border-green-800/30 bg-green-950/20 text-left space-y-1 lg:space-y-2 text-sm lg:text-base">
              <p><span className="text-slate-400">Tanggal:</span> <span className="text-white">{selectedDate}</span></p>
              <p><span className="text-slate-400">Resto:</span> <span className="text-white">{storeName}</span></p>
              <p><span className="text-slate-400">Shift:</span> <span className="text-white">{selectedShift}</span></p>
              <p><span className="text-slate-400">Jam:</span> <span className="text-yellow-400">{jam} WIB</span></p>
              <p><span className="text-slate-400">QC:</span> <span className="text-cyan-400">{selectedQC}</span></p>
              <p><span className="text-slate-400">Manajer:</span> <span className="text-purple-400">{selectedManajer}</span></p>
              <div className="border-t border-green-800/30 my-2" />
              {selectedStations.map(station => (
                <div key={station} className="flex items-center justify-between">
                  <span className="text-white">{STATION_ICONS[station]} {station}</span>
                  <span className={`text-xs font-bold ${
                    submitStatusMap[station] === "success" ? "text-green-400" : "text-red-400"
                  }`}>
                    {submitStatusMap[station] === "success" ? `✅ ${parsedItemsMap[station].length} item` : "❌ Error"}
                  </span>
                </div>
              ))}
              <div className="border-t border-green-800/30 my-2" />
              <p><span className="text-slate-400">Total:</span> <span className="text-white font-bold">{totalItems} produk</span></p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleNewEntry}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-5 lg:py-6 text-base lg:text-lg font-bold lg:rounded-xl"
              >
                <Zap className="w-5 h-5 mr-2" /> Shift Baru
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="w-full border-slate-700/50 text-slate-400"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Balik ke Menu
              </Button>
            </div>
          </div>
        )}
      </main>

      <div className="lg:hidden">
        <Footer />
      </div>
    </div>
  );
}
