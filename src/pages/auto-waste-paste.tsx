import { useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Zap, CheckCircle, AlertTriangle, Send, Loader2, ClipboardPaste, X, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/ui/footer";
import { MultiFileUpload } from "@/components/ui/multi-file-upload";
import { getCurrentWIBDateString } from "@/lib/timezone";
import { apiFetch, ApiRequestError, getErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

type Station = "NOODLE" | "DIMSUM" | "BAR" | "PRODUKSI";
type Shift = "OPENING" | "MIDDLE" | "CLOSING" | "MIDNIGHT";
type AutoStep = "config" | "paste" | "preview" | "success";

const VALID_SHIFTS: Shift[] = ["OPENING", "MIDDLE", "CLOSING", "MIDNIGHT"];
const VALID_STATIONS: Station[] = ["NOODLE", "DIMSUM", "BAR", "PRODUKSI"];
const STATION_ICONS: Record<Station, string> = {
  NOODLE: "🍜",
  DIMSUM: "🥟",
  BAR: "🍹",
  PRODUKSI: "🏭",
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

function parseItems(text: string): { items: ParsedItem[]; errors: ParseError[] } {
  const errors: ParseError[] = [];
  const items: ParsedItem[] = [];
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    return { items: [], errors: [{ line: 0, message: "Data kosong. Paste minimal 1 item." }] };
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lineNum = i + 1;

    if (/^data\s*item/i.test(line)) continue;

    line = line.replace(/^[-•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
    if (!line) continue;

    const withLot = line.match(/^(.+?)\s*\(([^)]+)\)\s*:\s*(\d+)\s+(\S+)\s+(.+)$/);
    if (withLot) {
      items.push({
        namaProduk: withLot[1].trim().toUpperCase(),
        kodeLot: withLot[2].trim(),
        qty: parseInt(withLot[3], 10),
        unit: withLot[4].trim().toUpperCase(),
        alasan: withLot[5].trim(),
      });
      continue;
    }

    const noLot = line.match(/^(.+?):\s*(\d+)\s+(\S+)\s+(.+)$/);
    if (noLot) {
      items.push({
        namaProduk: noLot[1].trim().toUpperCase(),
        kodeLot: "",
        qty: parseInt(noLot[2], 10),
        unit: noLot[3].trim().toUpperCase(),
        alasan: noLot[4].trim(),
      });
      continue;
    }

    errors.push({ line: lineNum, message: `Format salah: "${line}". Gunakan: NAMA (KODE LOT): QTY SATUAN ALASAN` });
  }

  if (items.length === 0 && errors.length === 0) {
    errors.push({ line: 0, message: "Tidak ada item yang berhasil di-parse." });
  }

  return { items, errors };
}

export default function AutoWastePaste() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { tenantName } = useAuth();

  const [step, setStep] = useState<AutoStep>("config");
  const [selectedDate, setSelectedDate] = useState(getCurrentWIBDateString());
  const [selectedShift, setSelectedShift] = useState<Shift | "">("");
  const [selectedQC, setSelectedQC] = useState("");
  const [selectedManajer, setSelectedManajer] = useState("");
  const [selectedStation, setSelectedStation] = useState<Station | "">("");
  const [jam, setJam] = useState("");
  const [validQC, setValidQC] = useState<string[]>([]);
  const [validManagers, setValidManagers] = useState<string[]>([]);
  const [personnelLoading, setPersonnelLoading] = useState(true);

  const [rawText, setRawText] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [dokumentasiFiles, setDokumentasiFiles] = useState<File[]>([]);
  const [signatureUrls, setSignatureUrls] = useState<Record<string, string>>({});
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const storeName = tenantName || localStorage.getItem("waste_app_tenant_name") || "";
  const configReady = selectedShift && selectedQC && selectedManajer && selectedStation && jam && selectedDate;

  useEffect(() => {
    async function fetchSignatures() {
      setIsLoadingSignatures(true);
      try {
        const res = await apiFetch("/api/signatures");
        const data = await res.json();
        if (data.success) setSignatureUrls(data.signatures || {});
      } catch (e) {
        toast({
          title: "Gagal Muat TTD",
          description: e instanceof ApiRequestError ? getErrorMessage(e.type) : "Coba refresh halaman.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingSignatures(false);
      }
    }
    fetchSignatures();
  }, []);

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
        toast({
          title: "Gagal Muat Data QC/Manager",
          description: e instanceof ApiRequestError ? getErrorMessage(e.type) : "Coba refresh halaman.",
          variant: "destructive",
        });
      } finally {
        setPersonnelLoading(false);
      }
    }
    fetchPersonnel();
  }, []);

  const handleParse = useCallback(() => {
    const { items, errors } = parseItems(rawText);
    setParsedItems(items);
    setParseErrors(errors);
    if (items.length > 0 && errors.length === 0) {
      setStep("preview");
    }
  }, [rawText]);

  const handleSubmit = useCallback(async () => {
    if (!parsedItems.length || !selectedStation || !selectedShift || !selectedQC || !selectedManajer) return;
    setIsSubmitting(true);

    try {
      const qcUrl = signatureUrls[selectedQC] || "";
      const mgrUrl = signatureUrls[selectedManajer] || "";
      if (!qcUrl) throw new Error(`TTD untuk QC "${selectedQC}" tidak ditemukan`);
      if (!mgrUrl) throw new Error(`TTD untuk Manajer "${selectedManajer}" tidak ditemukan`);

      const jamFormatted = jam.includes("WIB") ? jam : `${jam} WIB`;
      const formData = new FormData();
      formData.append("tanggal", selectedDate);
      formData.append("kategoriInduk", selectedStation);
      formData.append("shift", selectedShift);
      formData.append("storeName", storeName);
      formData.append("parafQCUrl", qcUrl);
      formData.append("parafManagerUrl", mgrUrl);
      formData.append("productList", JSON.stringify(parsedItems.map((i) => i.namaProduk)));
      formData.append("kodeProdukList", JSON.stringify(parsedItems.map((i) => i.kodeLot || selectedDate)));
      formData.append("jumlahProdukList", JSON.stringify(parsedItems.map((i) => i.qty)));
      formData.append("unitList", JSON.stringify(parsedItems.map((i) => i.unit)));
      formData.append("metodePemusnahanList", JSON.stringify(parsedItems.map(() => "DIBUANG")));
      formData.append("alasanPemusnahanList", JSON.stringify(parsedItems.map((i) => i.alasan)));
      formData.append("jamTanggalPemusnahan", jamFormatted);
      formData.append("jamTanggalPemusnahanList", JSON.stringify(parsedItems.map(() => jamFormatted)));

      dokumentasiFiles.forEach((file, idx) => {
        formData.append(`dokumentasi_${idx}`, file);
      });

      const res = await apiFetch("/api/auto-submit", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Gagal menyimpan data");

      setStep("success");
      toast({
        title: "Berhasil",
        description: `Data ${selectedStation} - ${selectedShift} berhasil disimpan`,
      });
    } catch (error) {
      toast({
        title: "Gagal",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [parsedItems, selectedStation, selectedShift, selectedQC, selectedManajer, jam, selectedDate, storeName, dokumentasiFiles, signatureUrls, toast]);

  const copyTemplate = useCallback(() => {
    navigator.clipboard.writeText("- MIE GORENG (2025-03-09): 5 PCS EXPIRED\n- DIMSUM AYAM (2025-03-09): 3 PACK RUSAK");
    toast({ title: "Template dicopy", description: "Contoh format siap dipaste." });
  }, [toast]);

  const handleNewEntry = useCallback(() => {
    setRawText("");
    setParsedItems([]);
    setParseErrors([]);
    setDokumentasiFiles([]);
    setSelectedShift("");
    setSelectedQC("");
    setSelectedManajer("");
    setSelectedStation("");
    setJam("");
    setStep("config");
  }, []);

  return (
    <div className="flex-1 bg-[#0a0a0a] flex flex-col text-[#f0f0f0]">
      <div className="hidden lg:flex items-center gap-3 px-6 py-4 border-b-2 border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#FFE500] bg-[#1a1a00] shadow-[2px_2px_0px_#000]">
          <Zap className="w-4 h-4 text-[#FFE500]" />
        </div>
        <div>
          <h1 className="text-base font-black text-white uppercase tracking-wide">Auto Waste</h1>
          <p className="text-[10px] text-[#555] font-bold uppercase tracking-widest">Paste format item cepat</p>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b-2 border-[#1a1a1a] bg-[#0a0a0a] lg:hidden">
        <div className="w-full px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setLocation("/")} className="text-[#555] hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#FFE500] bg-[#1a1a00] shadow-[2px_2px_0px_#000]">
              <Zap className="w-3.5 h-3.5 text-[#FFE500]" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white uppercase tracking-wide">Auto Waste</h1>
              {tenantName && <p className="text-[9px] text-[#FFE500]/60 font-bold uppercase truncate">{tenantName}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-4">
        {step === "config" && (
          <div className="space-y-4 max-w-xl mx-auto">
            <div className="text-center">
              <h2 className="text-lg font-bold text-[#FFE500] mb-1">Konfigurasi Auto Waste</h2>
              <p className="text-xs text-[#9CA3AF]">Pilih config dulu, lalu paste item format cepat.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9CA3AF]">Tanggal</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-3 py-2.5 bg-[#111] border-2 border-[#2a2a2a] rounded-lg text-white text-sm outline-none focus:border-[#FFE500]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9CA3AF]">Store</label>
                <input value={storeName} readOnly className="w-full px-3 py-2.5 bg-[#111] border-2 border-[#2a2a2a] rounded-lg text-white text-sm opacity-80" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9CA3AF]">Shift</label>
                <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value as Shift)} className="w-full px-3 py-2.5 bg-[#111] border-2 border-[#2a2a2a] rounded-lg text-white text-sm outline-none focus:border-[#FFE500]">
                  <option value="">-- Pilih Shift --</option>
                  {VALID_SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9CA3AF]">Jam Pemusnahan</label>
                <input type="time" value={jam} onChange={(e) => setJam(e.target.value)} className="w-full px-3 py-2.5 bg-[#111] border-2 border-[#2a2a2a] rounded-lg text-white text-sm outline-none focus:border-[#FFE500]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#9CA3AF]">Station</label>
              <div className="grid grid-cols-4 gap-2">
                {VALID_STATIONS.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStation(st)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${selectedStation === st ? "border-[#FFE500] bg-[#1a1a00] text-[#FFE500] shadow-nb-yellow" : "border-[#2a2a2a] bg-[#111] text-[#555] hover:border-[#444] hover:text-[#aaa]"}`}
                  >
                    <div className="text-xl">{STATION_ICONS[st]}</div>
                    <div className="text-[10px] font-bold mt-0.5">{st}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9CA3AF]">QC</label>
                <select value={selectedQC} onChange={(e) => setSelectedQC(e.target.value)} className="w-full px-3 py-2.5 bg-[#111] border-2 border-[#2a2a2a] rounded-lg text-white text-sm outline-none focus:border-[#FFE500]">
                  <option value="">-- Pilih QC --</option>
                  {validQC.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9CA3AF]">Manajer</label>
                <select value={selectedManajer} onChange={(e) => setSelectedManajer(e.target.value)} className="w-full px-3 py-2.5 bg-[#111] border-2 border-[#2a2a2a] rounded-lg text-white text-sm outline-none focus:border-[#FFE500]">
                  <option value="">-- Pilih Manajer --</option>
                  {validManagers.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {(personnelLoading || isLoadingSignatures) && <p className="text-xs text-[#666] text-center">Memuat personnel & tanda tangan...</p>}

            <Button onClick={() => setStep("paste")} disabled={!configReady} className="w-full bg-[#FFE500] text-black hover:brightness-95 py-5 text-base font-black disabled:opacity-40">
              Lanjut Paste Item
            </Button>
          </div>
        )}

        {step === "paste" && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-lg font-bold text-[#FFE500] mb-1">Paste Item</h2>
              <p className="text-xs text-[#9CA3AF]">{selectedStation} • {selectedShift} • {selectedDate}</p>
            </div>

            <div className="p-3 rounded-lg border-2 border-[#2a2a2a] bg-[#111]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#FFE500]">Format</span>
                <Button variant="ghost" size="sm" onClick={copyTemplate} className="text-xs text-[#FFE500] hover:text-[#FFE500] h-6 px-2">
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
              <pre className="text-[11px] text-[#9CA3AF] font-mono leading-relaxed whitespace-pre-wrap">- NAMA PRODUK (KODE LOT): QTY SATUAN ALASAN{"\n"}- MIE GORENG (2025-03-09): 5 PCS EXPIRED</pre>
            </div>

            <div className="relative">
              <textarea
                value={rawText}
                onChange={(e) => { setRawText(e.target.value); setParseErrors([]); }}
                placeholder="Paste item di sini..."
                className="w-full h-56 px-4 py-3 bg-[#111] border-2 border-[#2a2a2a] rounded-lg text-white font-mono text-sm outline-none resize-none placeholder:text-[#555] focus:border-[#FFE500]"
              />
              {rawText && (
                <button type="button" onClick={() => { setRawText(""); setParseErrors([]); }} className="absolute top-2 right-2 p-1 text-[#555] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {parseErrors.length > 0 && (
              <div className="p-3 rounded-lg border-2 border-red-500/30 bg-red-500/10 space-y-1">
                <div className="flex items-center gap-2 text-red-400 text-sm font-bold mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Error ({parseErrors.length})</span>
                </div>
                {parseErrors.map((err, i) => <p key={i} className="text-xs text-red-300">{err.line > 0 ? `Baris ${err.line}: ` : ""}{err.message}</p>)}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  setRawText(text);
                  toast({ title: "Paste sukses", description: "Teks clipboard masuk ke form." });
                } catch {
                  toast({ title: "Gagal akses clipboard", description: "Paste manual ya.", variant: "destructive" });
                }
              }} className="flex-1 border-[#2a2a2a] text-[#FFE500] hover:bg-[#1a1a00]">
                <ClipboardPaste className="w-4 h-4 mr-2" /> Paste
              </Button>
              <Button onClick={handleParse} disabled={!rawText.trim()} className="flex-1 bg-[#FFE500] text-black hover:brightness-95 font-black disabled:opacity-40">
                <Zap className="w-4 h-4 mr-2" /> Parse & Preview
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-lg font-bold text-green-400 mb-1">Preview Data</h2>
              <p className="text-xs text-[#9CA3AF]">Cek hasil parse sebelum submit.</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg border-2 border-[#2a2a2a] bg-[#111] text-center"><p className="text-[10px] text-[#666]">Station</p><p className="text-sm font-bold text-white">{selectedStation}</p></div>
              <div className="p-2.5 rounded-lg border-2 border-[#2a2a2a] bg-[#111] text-center"><p className="text-[10px] text-[#666]">Shift</p><p className="text-sm font-bold text-white">{selectedShift}</p></div>
              <div className="p-2.5 rounded-lg border-2 border-[#2a2a2a] bg-[#111] text-center"><p className="text-[10px] text-[#666]">Jam</p><p className="text-sm font-bold text-[#FFE500]">{jam} WIB</p></div>
            </div>

            <div className="rounded-lg border-2 border-[#2a2a2a] overflow-hidden">
              <div className="bg-[#111] px-3 py-2 text-xs font-bold text-[#FFE500]">Data Item ({parsedItems.length})</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#151515] text-[#666]">
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
                      <tr key={`${item.namaProduk}-${i}`} className="border-t border-[#222]">
                        <td className="px-3 py-2 text-[#666]">{i + 1}</td>
                        <td className="px-3 py-2 text-white font-medium">{item.namaProduk}</td>
                        <td className="px-3 py-2 text-[#C9D1D9]">{item.kodeLot || selectedDate}</td>
                        <td className="px-3 py-2 text-center text-[#FFE500] font-bold">{item.qty}</td>
                        <td className="px-3 py-2 text-[#C9D1D9]">{item.unit}</td>
                        <td className="px-3 py-2 text-[#C9D1D9]">{item.alasan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#E5E7EB]">Foto Dokumentasi</label>
              <MultiFileUpload onFilesSelect={setDokumentasiFiles} maxFiles={10} accept="image/*" label="Foto Dokumentasi" />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("paste")} className="flex-1 border-[#2a2a2a] text-[#9CA3AF] hover:bg-[#111]">
                <ArrowLeft className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 bg-green-500 text-black hover:brightness-95 font-black">
                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : <><Send className="w-4 h-4 mr-2" /> Submit</>}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-6 max-w-xl mx-auto text-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">Data Tersimpan</h2>
              <p className="text-sm text-[#9CA3AF]">{selectedStation} - {selectedShift} berhasil direcord.</p>
            </div>
            <div className="flex flex-col gap-3">
              <Button onClick={handleNewEntry} className="w-full bg-[#FFE500] text-black hover:brightness-95 py-5 text-base font-black">
                <Zap className="w-5 h-5 mr-2" /> Input Lagi
              </Button>
              <Button variant="outline" onClick={() => setLocation("/")} className="w-full border-[#2a2a2a] text-[#9CA3AF] hover:bg-[#111]">
                <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Pilih Mode
              </Button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
