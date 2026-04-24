import { useLocation } from "wouter";
import { useState, useEffect, useCallback, useRef, type ElementType } from "react";
import { ArrowLeft, Zap, CheckCircle, AlertTriangle, Send, Loader2, CheckCheck, RefreshCw, WifiOff, ShieldAlert, ServerCrash, Plus, Trash2, Soup, Package, CupSoda, Factory, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/ui/footer";
import { MultiFileUpload } from "@/components/ui/multi-file-upload";
import { getCurrentWIBDateString } from "@/lib/timezone";
import { apiFetch, ApiRequestError, getErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

// ========================
// TYPES & CONSTANTS
// ========================

type Station = "NOODLE" | "DIMSUM" | "BAR" | "PRODUKSI";
type Shift = "OPENING" | "MIDDLE" | "CLOSING" | "MIDNIGHT";
type AutoStep = "config" | "paste" | "preview" | "success";

const VALID_SHIFTS: Shift[] = ["OPENING", "MIDDLE", "CLOSING", "MIDNIGHT"];
const VALID_STATIONS: Station[] = ["NOODLE", "DIMSUM", "BAR", "PRODUKSI"];

const STATION_ICONS: Record<Station, ElementType> = {
  NOODLE: Soup,
  DIMSUM: Package,
  BAR: CupSoda,
  PRODUKSI: Factory,
};

function StationIcon({ station, className }: { station: Station; className?: string }) {
  const Icon = STATION_ICONS[station];
  return <Icon className={className} />;
}

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

type StationCatalogItem = {
  value: string;
  label: string;
  unit?: string;
  manual?: boolean;
  manualLot?: boolean;
};

type StationDraftRow = {
  id: string;
  optionValue: string;
  manualName: string;
  manualUnit: string;
  qty: string;
  alasan: string;
  kodeLot: string;
};

// Per-station submission status
type StationSubmitStatus = "pending" | "uploading" | "success" | "error";

// ========================
// ITEM CATALOG
// ========================

const MANUAL_ITEM_VALUE = "__MANUAL__";

const STATION_ITEM_CATALOG: Record<Station, StationCatalogItem[]> = {
  NOODLE: [
    { value: "PANGSIT GORENG", label: "PANGSIT GORENG", unit: "PCS" },
    { value: "MIE GACOAN LEVEL 0", label: "MIE GACOAN -> LEVEL 0", unit: "PORSI" },
    { value: "MIE GACOAN LEVEL 1", label: "MIE GACOAN -> LEVEL 1", unit: "PORSI" },
    { value: "MIE GACOAN LEVEL 2", label: "MIE GACOAN -> LEVEL 2", unit: "PORSI" },
    { value: "MIE GACOAN LEVEL 3", label: "MIE GACOAN -> LEVEL 3", unit: "PORSI" },
    { value: "MIE GACOAN LEVEL 4", label: "MIE GACOAN -> LEVEL 4", unit: "PORSI" },
    { value: "MIE GACOAN LEVEL 6", label: "MIE GACOAN -> LEVEL 6", unit: "PORSI" },
    { value: "MIE GACOAN LEVEL 8", label: "MIE GACOAN -> LEVEL 8", unit: "PORSI" },
    { value: "MIE HOMPIMPA LEVEL 1", label: "MIE HOMPIMPA -> LEVEL 1", unit: "PORSI" },
    { value: "MIE HOMPIMPA LEVEL 2", label: "MIE HOMPIMPA -> LEVEL 2", unit: "PORSI" },
    { value: "MIE HOMPIMPA LEVEL 3", label: "MIE HOMPIMPA -> LEVEL 3", unit: "PORSI" },
    { value: "MIE HOMPIMPA LEVEL 4", label: "MIE HOMPIMPA -> LEVEL 4", unit: "PORSI" },
    { value: "MIE HOMPIMPA LEVEL 6", label: "MIE HOMPIMPA -> LEVEL 6", unit: "PORSI" },
    { value: "MIE HOMPIMPA LEVEL 8", label: "MIE HOMPIMPA -> LEVEL 8", unit: "PORSI" },
    { value: "PAPERBOX MIE", label: "PAPERBOX MIE", unit: "PCS" },
    { value: "MIE POLOS", label: "MIE POLOS", unit: "PCS", manualLot: true },
    { value: "KERUPUK GORENG", label: "KERUPUK GORENG", unit: "GRAM" },
    { value: `${MANUAL_ITEM_VALUE}_NOODLE`, label: "LAINNYA (isi manual)", manual: true },
  ],
  DIMSUM: [
    { value: "UDANG KEJU", label: "UDANG KEJU", unit: "PCS" },
    { value: "UDANG RAMBUTAN", label: "UDANG RAMBUTAN", unit: "PCS" },
    { value: "LUMPIA UDANG", label: "LUMPIA UDANG", unit: "PCS" },
    { value: "SIOMAY AYAM", label: "SIOMAY AYAM", unit: "PCS" },
    { value: "PAPERBOX DIMSUM", label: "PAPERBOX DIMSUM", unit: "PCS" },
    { value: "SURAI NAGA", label: "SURAI NAGA", unit: "GRAM", manualLot: true },
    { value: "PENTOL", label: "PENTOL", unit: "PCS", manualLot: true },
  ],
  PRODUKSI: [
    { value: "KULIT PANGSIT", label: "KULIT PANGSIT", unit: "GRAM", manualLot: true },
    { value: "CABE RAWIT", label: "CABE RAWIT", unit: "GRAM" },
    { value: "KERUPUK GORENG", label: "KERUPUK GORENG", unit: "GRAM" },
    { value: `${MANUAL_ITEM_VALUE}_PRODUKSI`, label: "LAINNYA (isi manual)", manual: true },
  ],
  BAR: [
    { value: "APEL", label: "APEL", unit: "GRAM" },
    { value: "PEAR", label: "PEAR", unit: "GRAM" },
    { value: "BELIMBING", label: "BELIMBING", unit: "GRAM" },
    { value: "STROBERI SUSUT", label: "STROBERI SUSUT", unit: "GRAM" },
    { value: "STOBERI BUSUK", label: "STOBERI BUSUK", unit: "GRAM" },
    { value: "CUP 16", label: "CUP -> CUP 16", unit: "PCS" },
    { value: "CUP 14", label: "CUP -> CUP 14", unit: "PCS" },
    { value: "CUP 12", label: "CUP -> CUP 12", unit: "PCS" },
    { value: `${MANUAL_ITEM_VALUE}_BAR`, label: "LAINNYA (isi manual)", manual: true },
  ],
};

function createEmptyDraftRow(selectedDate: string): StationDraftRow {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    optionValue: "",
    manualName: "",
    manualUnit: "",
    qty: "",
    alasan: "",
    kodeLot: selectedDate,
  };
}
// ========================
// REUSABLE CLAY STYLES
// ========================
const CLAY_CARD = "rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#181C23_0%,#14181F_100%)] p-4 shadow-[0_20px_56px_rgba(0,0,0,0.32)] lg:p-5";
const CLAY_CARD_SM = "rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,#181C23_0%,#14181F_100%)] shadow-[0_16px_40px_rgba(0,0,0,0.28)]";
const CLAY_INPUT = "w-full rounded-[16px] border border-white/8 bg-[#10141A] px-3 py-2.5 text-sm text-[#E7ECF3] outline-none transition focus:border-[#4FD1FF]/30 focus:ring-2 focus:ring-[#4FD1FF]/15 lg:px-4 lg:py-3 lg:text-base";
const CLAY_SELECT = `${CLAY_INPUT} appearance-none [&>option]:bg-[#23262F] [&>option]:text-[#E5E7EB]`;
const CLAY_BTN_PRIMARY = "w-full rounded-[18px] bg-[linear-gradient(180deg,#26364A_0%,#1D2939_100%)] py-5 text-base font-semibold text-white shadow-[0_20px_48px_rgba(0,0,0,0.3)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-40 lg:py-6 lg:text-lg";
const CLAY_BTN_OUTLINE = "border-white/10 bg-[#171B22] text-[#A8B5C7] shadow-[0_14px_36px_rgba(0,0,0,0.24)] transition hover:-translate-y-0.5 hover:bg-[#1D232D] hover:text-white";
const LABEL = "text-[10px] font-sans uppercase tracking-[0.18em] text-[#7C8BA0] lg:text-xs";
const LABEL_MD = "text-xs lg:text-sm font-medium text-[#9CA3AF]";

// ========================
// AUTO-SAVE (localStorage)
// ========================
const DRAFT_KEY = "waste_app_draft_v1";
const DRAFT_DEBOUNCE = 800;
const DRAFT_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

type DraftData = {
  savedAt: number;
  step: AutoStep;
  selectedDate: string;
  selectedShift: Shift | "";
  selectedQC: string;
  selectedManajer: string;
  jam: string;
  selectedStations: Station[];
  stationDraftRowsMap: Record<Station, StationDraftRow[]>;
  parsedItemsMap: Record<Station, ParsedItem[]>;
  testerEnabled: boolean;
  testerChecks: Record<string, boolean>;
  testerKendala: string;
};

function saveDraftToStorage(data: DraftData) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
}

function loadDraftFromStorage(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data: DraftData = JSON.parse(raw);
    if (Date.now() - data.savedAt > DRAFT_MAX_AGE) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

function clearDraftStorage() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

function hasMeaningfulDraft(d: DraftData): boolean {
  const hasItems = d.selectedStations.some(
    st => d.stationDraftRowsMap[st]?.length > 0
  );
  const hasConfig = !!(d.selectedShift || d.selectedQC || d.selectedManajer || d.jam);
  return hasItems || (hasConfig && d.selectedStations.length > 0) || d.testerEnabled;
}

// ========================
// MAIN COMPONENT
// ========================

export default function AutoWaste() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { tenantName, qcName } = useAuth();

  // Fetch real IP address
  const [clientIP, setClientIP] = useState<string>("...");
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then(res => res.json())
      .then(data => { if (data.ip) setClientIP(data.ip); })
      .catch(() => setClientIP("N/A"));
  }, []);

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

  // Tester state
  const [testerEnabled, setTesterEnabled] = useState(false);
  const [testerChecks, setTesterChecks] = useState<Record<string, boolean>>({
    'MIE GACOAN LV. 1': false,
    'UDANG KEJU': false,
    'UDANG RAMBUTAN': false,
    'LUMPIA UDANG': false,
    'ALL BIANG BAR': false,
  });
  const [testerKendala, setTesterKendala] = useState('');
  const [testerSubmitStatus, setTesterSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const testerAllChecked = Object.values(testerChecks).every(v => v);
  const testerResultText = testerAllChecked
                      ? "OK: Semua sisa bahan dan produk aman dan approved."
    : testerKendala;

  // Multi-station selection
  const [selectedStations, setSelectedStations] = useState<Station[]>([]);
  const allStationsSelected = selectedStations.length === VALID_STATIONS.length;

  // Per-station item builder state
  const [stationDraftRowsMap, setStationDraftRowsMap] = useState<Record<Station, StationDraftRow[]>>({
    NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [],
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

  // Collapsible station sections (for paste & preview steps)
  // Accordion behavior: only one station expanded at a time
  const [expandedStations, setExpandedStations] = useState<Record<Station, boolean>>({
    NOODLE: false, DIMSUM: false, BAR: false, PRODUKSI: false,
  });
  const toggleExpandStation = useCallback((station: Station) => {
    setExpandedStations(prev => {
      const isCurrentlyExpanded = prev[station];
      // Collapse all, then toggle the clicked one
      const allCollapsed: Record<Station, boolean> = { NOODLE: false, DIMSUM: false, BAR: false, PRODUKSI: false };
      return { ...allCollapsed, [station]: !isCurrentlyExpanded };
    });
  }, []);
  // Expand a specific station (and collapse others)
  const focusStation = useCallback((station: Station) => {
    setExpandedStations({ NOODLE: false, DIMSUM: false, BAR: false, PRODUKSI: false, [station]: true });
  }, []);

  // Collapsible preview station details
  const [expandedPreviewStations, setExpandedPreviewStations] = useState<Record<Station, boolean>>({
    NOODLE: false, DIMSUM: false, BAR: false, PRODUKSI: false,
  });
  const togglePreviewStation = useCallback((station: Station) => {
    setExpandedPreviewStations(prev => ({ ...prev, [station]: !prev[station] }));
  }, []);

  // Global progress state
  const [globalProgress, setGlobalProgress] = useState({
    current: 0,
    total: 0,
    currentStation: "" as string,
    phase: "" as "uploading" | "processing" | "",
    percent: 0,
  });

  // ========================
  // AUTO-SAVE & RESTORE
  // ========================
  const draftRestoredRef = useRef(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const pendingDraftRef = useRef<DraftData | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply draft data to all state setters
  const applyDraft = useCallback((d: DraftData) => {
    const safeStep = d.step === "success" ? "config" : d.step;
    setStep(safeStep);
    setSelectedDate(d.selectedDate);
    setSelectedShift(d.selectedShift);
    setSelectedQC(d.selectedQC);
    setSelectedManajer(d.selectedManajer);
    setJam(d.jam);
    setSelectedStations(d.selectedStations);
    setStationDraftRowsMap(d.stationDraftRowsMap);
    setParsedItemsMap(d.parsedItemsMap);
    setTesterEnabled(d.testerEnabled);
    setTesterChecks(d.testerChecks);
    setTesterKendala(d.testerKendala);
  }, []);

  // Restore draft on mount (once)
  // - Fresh draft (< 60s old) = auto-restore silently (user just navigated away and back)
  // - Older draft = show banner and let user choose
  useEffect(() => {
    if (draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    const draft = loadDraftFromStorage();
    if (!draft || !hasMeaningfulDraft(draft)) return;

    const ageMs = Date.now() - draft.savedAt;
    const isFresh = ageMs < 60_000; // < 60 seconds = in-app navigation

    if (isFresh) {
      // Auto-restore silently - user just switched tabs/pages
      applyDraft(draft);
    } else {
      // Older draft - ask user
      pendingDraftRef.current = draft;
      setShowDraftBanner(true);
    }
  }, [applyDraft]);

  const restoreDraft = useCallback(() => {
    const d = pendingDraftRef.current;
    if (!d) return;
    applyDraft(d);
    pendingDraftRef.current = null;
    setShowDraftBanner(false);
    toast({ title: "Draft Dipulihkan", description: "Data input sebelumnya berhasil dimuat." });
  }, [applyDraft, toast]);

  const dismissDraft = useCallback(() => {
    pendingDraftRef.current = null;
    setShowDraftBanner(false);
    clearDraftStorage();
  }, []);

  // Auto-save: debounced write to localStorage on state change
  useEffect(() => {
    // Don't save during submit or on success (already submitted)
    if (isSubmitting) return;
    if (step === "success") return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const draft: DraftData = {
        savedAt: Date.now(),
        step,
        selectedDate,
        selectedShift,
        selectedQC,
        selectedManajer,
        jam,
        selectedStations,
        stationDraftRowsMap,
        parsedItemsMap,
        testerEnabled,
        testerChecks,
        testerKendala,
      };
      if (hasMeaningfulDraft(draft)) {
        saveDraftToStorage(draft);
      }
    }, DRAFT_DEBOUNCE);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [step, selectedDate, selectedShift, selectedQC, selectedManajer, jam, selectedStations, stationDraftRowsMap, parsedItemsMap, testerEnabled, testerChecks, testerKendala, isSubmitting]);

  // Warn before leaving page if there's unsaved data
  useEffect(() => {
    const hasData = selectedStations.some(st => stationDraftRowsMap[st].length > 0) || testerEnabled;
    if (!hasData || step === "success") return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [selectedStations, stationDraftRowsMap, testerEnabled, step]);

  // FIX #29: Add selectedDate validation to configReady
  const configReady = selectedShift && selectedQC && selectedManajer && (selectedStations.length > 0 || testerEnabled) && jam && selectedDate;

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
          title: "Gagal Muat TTD",
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
          title: "Gagal Muat Data QC/Manager",
          description: e instanceof ApiRequestError ? getErrorMessage(e.type) : "Coba refresh halaman.", 
          variant: "destructive" 
        });
      } finally {
        setPersonnelLoading(false);
      }
    }
    fetchPersonnel();
  }, []);

  // Build selected items per station
  const getCatalogItem = useCallback((station: Station, value: string) => {
    return STATION_ITEM_CATALOG[station].find(item => item.value === value);
  }, []);

  const addDraftRow = useCallback((station: Station) => {
    setStationDraftRowsMap(prev => ({
      ...prev,
      [station]: [...prev[station], createEmptyDraftRow(selectedDate)],
    }));
    setParseErrorsMap(prev => ({ ...prev, [station]: [] }));
  }, [selectedDate]);

  const updateDraftRow = useCallback((station: Station, rowId: string, patch: Partial<StationDraftRow>) => {
    setStationDraftRowsMap(prev => ({
      ...prev,
      [station]: prev[station].map(row => row.id === rowId ? { ...row, ...patch } : row),
    }));
    setParseErrorsMap(prev => ({ ...prev, [station]: [] }));
  }, []);

  const removeDraftRow = useCallback((station: Station, rowId: string) => {
    setStationDraftRowsMap(prev => ({
      ...prev,
      [station]: prev[station].filter(row => row.id != rowId),
    }));
    setParseErrorsMap(prev => ({ ...prev, [station]: [] }));
  }, []);

  const getAvailableOptions = useCallback((station: Station, rowId: string) => {
    const selectedValues = new Set(
      stationDraftRowsMap[station]
        .filter(row => row.id !== rowId)
        .map(row => row.optionValue)
        .filter(Boolean)
    );

    return STATION_ITEM_CATALOG[station].filter(item => !selectedValues.has(item.value));
  }, [stationDraftRowsMap]);

  const buildItemsFromSelections = useCallback(() => {
    const newParsedMap: Record<Station, ParsedItem[]> = { NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [] };
    const newErrorsMap: Record<Station, ParseError[]> = { NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [] };
    let hasItems = false;
    let hasErrors = false;

    for (const station of selectedStations) {
      const rows = stationDraftRowsMap[station];
      if (rows.length === 0) {
        newErrorsMap[station] = [{ line: 0, message: `Pilih minimal 1 item untuk ${station}.` }];
        hasErrors = true;
        continue;
      }

      const usedValues = new Set<string>();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const option = getCatalogItem(station, row.optionValue);
        const lineNum = i + 1;

        if (!option) {
          newErrorsMap[station].push({ line: lineNum, message: "Pilih item dari dropdown dulu." });
          hasErrors = true;
          continue;
        }

        if (usedValues.has(option.value)) {
          newErrorsMap[station].push({ line: lineNum, message: "Item yang sama ga bisa dipilih dua kali dalam 1 station." });
          hasErrors = true;
          continue;
        }
        usedValues.add(option.value);

        const namaProduk = option.manual ? row.manualName.trim().toUpperCase() : option.value;
        const unit = option.manual ? row.manualUnit.trim().toUpperCase() : (option.unit || "");
        const qty = Number(row.qty);
        const alasan = row.alasan.trim();
        const kodeLot = option.manualLot ? row.kodeLot.trim() : selectedDate;

        if (!namaProduk) {
          newErrorsMap[station].push({ line: lineNum, message: "Nama item manual masih kosong." });
          hasErrors = true;
        }
        if (!unit) {
          newErrorsMap[station].push({ line: lineNum, message: "Satuan item masih kosong." });
          hasErrors = true;
        }
        if (!Number.isFinite(qty) || qty <= 0) {
          newErrorsMap[station].push({ line: lineNum, message: "Qty harus lebih dari 0." });
          hasErrors = true;
        }
        if (!alasan) {
          newErrorsMap[station].push({ line: lineNum, message: "Alasan waste wajib diisi." });
          hasErrors = true;
        }
        if (!kodeLot) {
          newErrorsMap[station].push({ line: lineNum, message: "Kode lot / pick date wajib diisi." });
          hasErrors = true;
        }

        newParsedMap[station].push({
          namaProduk,
          kodeLot,
          qty,
          unit,
          alasan,
        });
      }

      if (newParsedMap[station].length > 0) hasItems = true;
    }

    return { newParsedMap, newErrorsMap, hasItems, hasErrors };
  }, [getCatalogItem, selectedDate, selectedStations, stationDraftRowsMap]);

  const handlePrepareItems = useCallback(() => {
    const { newParsedMap, newErrorsMap, hasItems, hasErrors } = buildItemsFromSelections();
    setParsedItemsMap(newParsedMap);
    setParseErrorsMap(newErrorsMap);

    if (hasItems && !hasErrors) {
      setStep("preview");
    }
  }, [buildItemsFromSelections]);

  // Submit stations (supports retry for failed ones)
  const handleSubmit = useCallback(async (retryStations?: Station[]) => {
    const stationsToSubmit = retryStations || selectedStations;
    
    // Validate all stations have docs (skip on retry - already validated)
    if (!retryStations) {
      const missingDocs = stationsToSubmit.filter(st => dokumentasiFilesMap[st].length === 0);
      if (missingDocs.length > 0) {
        toast({
          title: "Foto Dokumentasi Wajib",
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
      toast({ title: "TTD QC Tidak Ditemukan", description: `Tanda tangan "${selectedQC}" belum di-upload. Tambah di Settings > Personnel.`, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    if (!mgrUrl) {
      toast({ title: "TTD Manajer Tidak Ditemukan", description: `Tanda tangan "${selectedManajer}" belum di-upload. Tambah di Settings > Personnel.`, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const jamFormatted = jam.includes("WIB") ? jam : `${jam} WIB`;

    // Submit tester first if enabled (and not a retry of failed stations)
    // FIX #6: Use local variable to track tester status (avoid stale closure)
    let localTesterFailed = false;
    if (testerEnabled && !retryStations) {
      setTesterSubmitStatus('submitting');
      try {
        const testerForm = new FormData();
        testerForm.append('mode', 'submit-tester');
        testerForm.append('storeName', storeName);
        testerForm.append('shift', selectedShift);
        testerForm.append('tanggal', selectedDate);
        testerForm.append('jam', jamFormatted);
        testerForm.append('testerItems', JSON.stringify(
          Object.entries(testerChecks).filter(([_, v]) => v).map(([k]) => k)
        ));
        testerForm.append('testerAllOk', testerAllChecked ? 'true' : 'false');
        testerForm.append('testerKendala', testerKendala);
        testerForm.append('parafQCUrl', qcUrl);
        testerForm.append('parafManagerUrl', mgrUrl);

        const testerRes = await apiFetch("/api/auto-submit", {
          method: "POST",
          body: testerForm,
        }, { maxRetries: 2, timeout: 30000 });
        const testerResult = await testerRes.json();
        if (!testerRes.ok || !testerResult.success) {
          throw new Error(testerResult.message || 'Tester submission failed');
        }
        setTesterSubmitStatus('success');
      } catch (error) {
        localTesterFailed = true;
        setTesterSubmitStatus('error');
        const errorMsg = error instanceof Error ? error.message : 'Tester error';
        toast({ title: "Tester Gagal", description: errorMsg, variant: "destructive" });
        // Continue with station submissions even if tester fails
      }
    }

    // If tester-only (no stations), handle completion
    if (stationsToSubmit.length === 0) {
      setIsSubmitting(false);
      // FIX #6: Use localTesterFailed instead of stale testerSubmitStatus state
      if (testerEnabled && !localTesterFailed) {
        try {
          const notifForm = new FormData();
          notifForm.append('mode', 'send-wa-notif');
          notifForm.append('storeName', storeName);
          notifForm.append('shift', selectedShift);
          notifForm.append('tanggal', selectedDate);
          notifForm.append('stations', JSON.stringify([]));
          notifForm.append('testerAllOk', testerAllChecked ? 'true' : 'false');
          notifForm.append('testerKendala', testerKendala);
          notifForm.append('testerItems', JSON.stringify(
            Object.entries(testerChecks).filter(([_, v]) => v).map(([k]) => k)
          ));
          apiFetch("/api/auto-submit", { method: "POST", body: notifForm }).catch(() => {});
        } catch {}
      }
      setStep("success");
      clearDraftStorage();
      toast({ title: "Tester Berhasil", description: "Data tester berhasil disimpan" });
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const failedStations: Station[] = [];
    // FIX #6: Track errors locally to avoid stale closure when reading state after setStationErrors
    const localStationErrors: Record<string, string> = {};

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
        // FIX #6: Track error locally to avoid stale closure when reading state after setStationErrors
        localStationErrors[station] = errorMsg;
      }
    }

    setGlobalProgress(prev => ({ ...prev, percent: 100, phase: "" }));
    setIsSubmitting(false);

    // Send combined WhatsApp notification for successful stations
    const successfulStations = stationsToSubmit.filter(st => !failedStations.includes(st));
    if (successfulStations.length > 0) {
      try {
        const stationsPayload = successfulStations.map(station => {
          const items = parsedItemsMap[station];
          return {
            kategoriInduk: station,
            productList: items.map(i => i.namaProduk),
            jumlahProdukList: items.map(i => i.qty),
            unitList: items.map(i => i.unit),
          };
        });
        const notifForm = new FormData();
        notifForm.append('mode', 'send-wa-notif');
        notifForm.append('storeName', storeName);
        notifForm.append('shift', selectedShift);
        notifForm.append('tanggal', selectedDate);
        notifForm.append('stations', JSON.stringify(stationsPayload));
        if (testerEnabled) {
          notifForm.append('testerAllOk', testerAllChecked ? 'true' : 'false');
          notifForm.append('testerKendala', testerKendala);
          notifForm.append('testerItems', JSON.stringify(
            Object.entries(testerChecks).filter(([_, v]) => v).map(([k]) => k)
          ));
        }
        apiFetch("/api/auto-submit", { method: "POST", body: notifForm }).catch(() => {});
      } catch (e) {
        console.error('[WA Notif] Failed to send combined notification:', e);
      }
    }

    if (failCount === 0) {
      setStep("success");
      clearDraftStorage();
      toast({
        title: "Semua Berhasil",
        description: `${stationsToSubmit.length} station berhasil disimpan`,
      });
    } else if (successCount > 0) {
      // Partial success - show which failed with option to retry
      toast({
        title: `${failCount} Station Gagal`,
        description: `${successCount} berhasil, ${failCount} gagal. Klik "Retry" untuk coba lagi.`,
        variant: "destructive",
      });
    } else {
      // All failed — FIX #6: Use local error map instead of stale state
      const firstError = localStationErrors[failedStations[0]] || "Terjadi kesalahan";
      toast({
        title: "Semua Gagal",
        description: firstError,
        variant: "destructive",
      });
    }
  }, [parsedItemsMap, signatureUrls, selectedDate, storeName, selectedStations, selectedShift, selectedQC, selectedManajer, jam, dokumentasiFilesMap, toast, submitStatusMap, stationErrors, testerEnabled, testerChecks, testerAllChecked, testerKendala, testerSubmitStatus]);

  // Retry only failed stations
  const handleRetryFailed = useCallback(() => {
    const failedStations = selectedStations.filter(st => submitStatusMap[st] === "error");
    if (failedStations.length > 0) {
      handleSubmit(failedStations);
    }
  }, [selectedStations, submitStatusMap, handleSubmit]);

  // Reset for new entry
  const handleNewEntry = useCallback(() => {
    setStationDraftRowsMap({ NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [] });
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
    setTesterEnabled(false);
    setTesterChecks({ 'MIE GACOAN LV. 1': false, 'UDANG KEJU': false, 'UDANG RAMBUTAN': false, 'LUMPIA UDANG': false, 'ALL BIANG BAR': false });
    setTesterKendala('');
    setTesterSubmitStatus('idle');
    setStep("config");
    clearDraftStorage();
  }, []);



  // Count total items across all selected stations
  const totalItems = selectedStations.reduce((sum, st) => sum + parsedItemsMap[st].length, 0);

  // ========================
  // RENDER
  // ========================

  return (
    <div className="flex-1 bg-[#111318] flex flex-col text-[#E7ECF3]">
      {/* Desktop page title */}
      <div className="hidden lg:flex items-center gap-3 px-6 py-4 border-b border-white/8 bg-[#111318]">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-[#171B22]">
          <Zap className="w-5 h-5 text-[#4FD1FF]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Input Waste</h1>
          <p className="text-xs text-[#7C8BA0]">Batch submit per shift</p>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {(["config", "paste", "preview", "success"] as AutoStep[]).map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full transition-colors ${
                step === s ? "bg-[#4FD1FF]" : 
                (["config", "paste", "preview", "success"].indexOf(step) > i) ? "bg-[#4FD1FF]/40" : "bg-[#2A2D37]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Header - Mobile only */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#111318] lg:hidden">
        <div className="w-full px-4 py-2 flex items-center justify-between desktop-header-container">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-[#171B22]">
              <Zap className="w-4 h-4 text-[#4FD1FF]" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Input Waste</h1>
              <p className="text-[10px] text-[#7C8BA0]">Batch submit per shift</p>
              {tenantName && <p className="text-[10px] text-[#4FD1FF]/60 font-sans truncate">{tenantName}</p>}
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {(["config", "paste", "preview", "success"] as AutoStep[]).map((s, i) => (
              <div
                key={s}
                className={`w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full transition-colors ${
                  step === s ? "bg-[#4FD1FF]" : 
                  (["config", "paste", "preview", "success"].indexOf(step) > i) ? "bg-[#4FD1FF]/40" : "bg-[#2A2D37]"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* ========== GLOBAL PROGRESS OVERLAY ========== */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] bg-[#1A1C22] flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            {/* Animated icon */}
            <div className="flex justify-center">
              <div className={`w-20 h-20 rounded-full bg-[#4FD1FF]/10 border-2 border-[#4FD1FF]/20 flex items-center justify-center animate-pulse ${CLAY_CARD_SM}`}>
                <Send className="w-8 h-8 text-[#4FD1FF]" />
              </div>
            </div>

            {/* Title */}
            <div className="text-center">
              <h3 className="text-lg font-bold text-[#E5E7EB] mb-1">Mengirim Data...</h3>
              <p className="text-xs text-[#9CA3AF]">Jangan tutup halaman ini</p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="h-3 w-full bg-[#1A1C22] rounded-full overflow-hidden shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_3px_rgba(255,255,255,0.02)]">
                <div
                  className="h-full bg-gradient-to-r from-[#4FD1FF] via-[#9F7AEA] to-[#9F7AEA] rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${globalProgress.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#4FD1FF] font-sans font-bold">{globalProgress.percent}%</span>
                <span className="text-[#9CA3AF]">
                  Station {globalProgress.current}/{globalProgress.total}
                </span>
              </div>
            </div>

            {/* Current station status */}
            {globalProgress.currentStation && (
              <div className={`${CLAY_CARD_SM} p-3 text-center`}>
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#4FD1FF]" />
                    <span className="text-sm text-[#E5E7EB] font-medium">
                      {globalProgress.currentStation && (
                        <StationIcon station={globalProgress.currentStation as Station} className="w-4 h-4 inline mr-1.5 align-[-2px]" />
                      )}
                      {globalProgress.currentStation}
                    </span>
                </div>
                <p className="text-[10px] text-[#9CA3AF] mt-1">
                  Upload {dokumentasiFilesMap[globalProgress.currentStation as Station]?.length || 0} foto + {parsedItemsMap[globalProgress.currentStation as Station]?.length || 0} item...
                </p>
              </div>
            )}

            {/* Station checklist */}
            <div className="space-y-1.5">
              {selectedStations.map((st) => (
                <div key={st} className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${CLAY_CARD_SM} ${
                  submitStatusMap[st] === "success" ? "border-green-500/20" :
                  submitStatusMap[st] === "uploading" ? "border-[#4FD1FF]/20" :
                  submitStatusMap[st] === "error" ? "border-red-500/20" : ""
                }`}>
                  <div className="flex items-center gap-2">
                    <StationIcon station={st} className="w-4 h-4 text-[#9CA3AF]" />
                    <span className={`text-xs font-medium ${
                      submitStatusMap[st] === "success" ? "text-green-400" :
                      submitStatusMap[st] === "uploading" ? "text-[#4FD1FF]" :
                      submitStatusMap[st] === "error" ? "text-red-400" :
                      "text-[#9CA3AF]"
                    }`}>{st}</span>
                  </div>
                  <div className="text-xs">
                    {submitStatusMap[st] === "success" && <span className="text-green-400">OK</span>}
                    {submitStatusMap[st] === "uploading" && <Loader2 className="w-3 h-3 animate-spin text-[#4FD1FF]" />}
                    {submitStatusMap[st] === "error" && (
                      <span className="text-red-400 flex items-center gap-1">
                        ERR <span className="text-[9px] max-w-[100px] truncate">{stationErrors[st]}</span>
                      </span>
                    )}
                    {submitStatusMap[st] === "pending" && <span className="text-[#9CA3AF]">...</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full px-4 sm:px-6 py-5 lg:py-8 space-y-4 lg:space-y-6 desktop-narrow">
        {/* User Identity Badge - compact */}
        <div className="flex items-center text-[9px] lg:text-[10px] text-[#9CA3AF] font-mono px-2 py-1 rounded-md bg-[#23262F] border border-[rgba(79,209,255,0.08)] w-fit">
          <span className="text-[#4FD1FF]/60">{qcName || "-"}</span>
          <span className="text-[#2A2D37] mx-1">|</span>
          <span>{tenantName || "-"}</span>
          <span className="text-[#2A2D37] mx-1">|</span>
          <span>{clientIP}</span>
        </div>

        {/* ========== DRAFT RECOVERY BANNER ========== */}
        {showDraftBanner && pendingDraftRef.current && (
          <div className={`${CLAY_CARD_SM} px-3 py-2.5 border-amber-500/20 flex items-center justify-between gap-3`}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-400">Ada draft tersimpan</p>
              <p className="text-[10px] text-[#9CA3AF] truncate">
                {pendingDraftRef.current.selectedShift || "?"} - {pendingDraftRef.current.selectedDate} - {pendingDraftRef.current.selectedStations.length} station
                {pendingDraftRef.current.testerEnabled ? " + Tester" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={restoreDraft}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-[10px] font-bold text-amber-400 hover:bg-amber-500/25 transition-colors"
              >
                Lanjutkan
              </button>
              <button
                onClick={dismissDraft}
                className="px-2 py-1.5 rounded-lg bg-[#23262F] border border-white/8 text-[10px] text-[#9CA3AF] hover:text-white transition-colors"
              >
                Buang
              </button>
            </div>
          </div>
        )}

        {/* ========== STEP: CONFIG ========== */}
        {step === "config" && (
          <div className="space-y-4 w-full">
            {/* Desktop: inline title with tagline */}
            <div className="hidden lg:flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] bg-clip-text text-transparent">AUTO WASTE</h2>
                <span className="text-sm text-[#9CA3AF]">Fast Mode - Batch Submit</span>
              </div>
            </div>

            {/* ---- Card 1: Date, Resto, Shift, Jam (merged compact) ---- */}
            <div className={CLAY_CARD}>
              <div className="grid grid-cols-2 gap-2.5 lg:gap-4">
                <div className="space-y-1">
                  <label className={LABEL}>Tanggal</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className={CLAY_INPUT}
                  />
                </div>
                <div className="space-y-1">
                  <label className={LABEL}>Resto</label>
                  <div className={`${CLAY_INPUT} flex items-center font-medium text-xs lg:text-sm truncate`}>
                    {storeName || 'Loading...'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={LABEL}>Shift</label>
                  <select
                    value={selectedShift}
                    onChange={e => setSelectedShift(e.target.value as Shift)}
                    className={CLAY_SELECT}
                  >
                    <option value="" disabled>-- Pilih --</option>
                    {VALID_SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={LABEL}>Jam Pemusnahan</label>
                  <input
                    type="time"
                    value={jam}
                    onChange={e => setJam(e.target.value)}
                    className={CLAY_INPUT}
                  />
                </div>
              </div>
            </div>

            {/* ---- Card 2: Station picker ---- */}
            <div className={CLAY_CARD}>
              <div className="flex items-center justify-between mb-3">
                <label className={LABEL}>Station</label>
                <button
                  onClick={toggleAllStations}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 ${
                    allStationsSelected
                      ? "bg-[#4FD1FF]/15 text-[#4FD1FF] border border-[#4FD1FF]/25 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.02)]"
                      : "bg-[#1A1C22] text-[#9CA3AF] border border-[rgba(79,209,255,0.12)] hover:border-[#4FD1FF]/25 hover:text-[#4FD1FF] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)]"
                  }`}
                >
                  <CheckCheck className="w-3 h-3" />
                  {allStationsSelected ? "Semua Dipilih" : "Pilih Semua"}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5 lg:gap-3">
                {VALID_STATIONS.map(st => (
                  <button
                    key={st}
                    onClick={() => toggleStation(st)}
                    className={`p-2 lg:p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                      selectedStations.includes(st)
                        ? "border-[#4FD1FF]/30 bg-[#4FD1FF]/10 text-[#4FD1FF] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.02)]"
                        : "border-[rgba(79,209,255,0.1)] bg-[#1A1C22] text-[#9CA3AF] hover:border-[#4FD1FF]/20 hover:text-[#E5E7EB] active:scale-[0.97] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]"
                    }`}
                  >
                    <StationIcon station={st} className="w-5 h-5 lg:w-7 lg:h-7 mx-auto" />
                    <div className="text-[9px] lg:text-xs font-bold mt-0.5">{st}</div>
                  </button>
                ))}
              </div>
              {/* Tester toggle - compact inline */}
              <div className="mt-2 pt-2 border-t border-[rgba(79,209,255,0.08)]">
                <button
                  onClick={() => setTesterEnabled(prev => !prev)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-200 ${
                    testerEnabled
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-[rgba(79,209,255,0.1)] bg-[#1A1C22] text-[#9CA3AF] hover:border-amber-500/20 hover:text-amber-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">TESTER</span>
                    <span className="text-[9px] opacity-70">QC Checklist</span>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors ${testerEnabled ? "bg-amber-500" : "bg-[#2A2D37]"} relative`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${testerEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                </button>
              </div>

              {/* Tester checklist section - compact */}
              {testerEnabled && (
                <div className="mt-2 p-3 rounded-xl bg-[#1A1C22] border border-amber-500/15 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-400">Checklist</h3>
                    <button
                      onClick={() => {
                        const allChecked = Object.values(testerChecks).every(v => v);
                        const newVal = !allChecked;
                        setTesterChecks(prev => {
                          const updated = { ...prev };
                          for (const key of Object.keys(updated)) updated[key] = newVal;
                          return updated;
                        });
                      }}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${
                        testerAllChecked
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                          : "bg-[#23262F] text-[#9CA3AF] border border-[rgba(79,209,255,0.12)] hover:text-amber-400"
                      }`}
                    >
                      <CheckCheck className="w-2.5 h-2.5" />
                      {testerAllChecked ? "All OK" : "All"}
                    </button>
                  </div>

                  <div className="space-y-1">
                    {Object.entries(testerChecks).map(([item, checked]) => (
                      <label
                        key={item}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all ${
                          checked
                            ? "border-green-500/20 bg-green-500/[0.05]"
                            : "border-[rgba(79,209,255,0.08)] bg-[#23262F]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setTesterChecks(prev => ({ ...prev, [item]: !prev[item] }))}
                          className="w-3.5 h-3.5 rounded accent-amber-500"
                        />
                        <span className={`text-xs ${checked ? "text-green-400" : "text-[#E5E7EB]"}`}>{item}</span>
                      </label>
                    ))}
                  </div>

                  {!testerAllChecked && (
                    <textarea
                      value={testerKendala}
                      onChange={e => setTesterKendala(e.target.value)}
                      placeholder="Jelaskan kendala..."
                      className={`${CLAY_INPUT} h-14 resize-none text-xs`}
                    />
                  )}

                  <div className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${
                    testerAllChecked
                      ? "bg-green-500/[0.08] border border-green-500/15 text-green-400"
                      : "bg-amber-500/[0.08] border border-amber-500/15 text-amber-400"
                  }`}>
                    {testerAllChecked
                      ? "OK: Semua aman dan approved."
                      : `Kendala: ${testerKendala || "(belum diisi)"}`
                    }
                  </div>
                </div>
              )}

              {selectedStations.length > 0 && (
                <p className="text-[10px] lg:text-xs text-[#4FD1FF]/70 text-center mt-3">
                  {selectedStations.length} station dipilih{testerEnabled ? " + Tester" : ""} - data akan disubmit terpisah per station
                </p>
              )}
              {selectedStations.length === 0 && testerEnabled && (
                <p className="text-[10px] lg:text-xs text-amber-400/70 text-center mt-3">
                  Tester only mode - checklist akan disubmit langsung
                </p>
              )}
            </div>

            {/* Card 3 (Shift & Jam) merged into Card 1 above */}

            {/* ---- Card 4: QC & Manajer (compact) ---- */}
            <div className={CLAY_CARD}>
              <div className="grid grid-cols-2 gap-2.5 lg:gap-4">
                <div className="space-y-1">
                  <label className={LABEL}>QC</label>
                  <select
                    value={selectedQC}
                    onChange={e => setSelectedQC(e.target.value)}
                    className={CLAY_SELECT}
                  >
                    <option value="" disabled>-- Pilih --</option>
                    {validQC.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                  {selectedQC && signatureUrls[selectedQC] && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <img src={signatureUrls[selectedQC]} alt="TTD" className="h-5 rounded bg-[#2A2D37] p-0.5" />
                      <span className="text-[9px] text-green-400">OK</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className={LABEL}>Manajer</label>
                  <select
                    value={selectedManajer}
                    onChange={e => setSelectedManajer(e.target.value)}
                    className={CLAY_SELECT}
                  >
                    <option value="" disabled>-- Pilih --</option>
                    {validManagers.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {selectedManajer && signatureUrls[selectedManajer] && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <img src={signatureUrls[selectedManajer]} alt="TTD" className="h-5 rounded bg-[#2A2D37] p-0.5" />
                      <span className="text-[9px] text-green-400">OK</span>
                    </div>
                  )}
                </div>
              </div>
              {isLoadingSignatures && (
                <p className="text-[10px] text-[#9CA3AF] text-center flex items-center justify-center gap-1 mt-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading TTD...
                </p>
              )}
            </div>

            {/* CTA Button */}
            <Button
              onClick={() => {
                if (selectedStations.length === 0 && testerEnabled) {
                  setStep("preview");
                } else {
                  // Auto-expand first station when entering paste step
                  if (selectedStations.length > 0) {
                    focusStation(selectedStations[0]);
                  }
                  setStep("paste");
                }
              }}
              disabled={!configReady}
              className="w-full rounded-[16px] bg-[linear-gradient(180deg,#26364A_0%,#1D2939_100%)] py-4 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.3)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-40 lg:py-5 lg:text-base"
            >
              {selectedStations.length === 0 && testerEnabled
                ? "Submit Tester ->"
                : `Pilih Item (${selectedStations.length} Station${testerEnabled ? " + Tester" : ""}) ->`
              }
            </Button>
          </div>
        )}

        {/* ========== STEP: PASTE ========== */}
        {step === "paste" && (
          <div className="space-y-3 w-full">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base lg:text-xl font-bold bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] bg-clip-text text-transparent">Pilih Item Waste</h2>
                <p className="text-[10px] lg:text-xs text-[#9CA3AF]">
                  {selectedShift} - {selectedDate} - {selectedStations.length} station
                </p>
              </div>
              <button
                onClick={() => setStep("config")}
                className="text-[10px] text-[#9CA3AF] hover:text-white flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Config
              </button>
            </div>

            {/* Compact rules - collapsible */}
            <details className={`${CLAY_CARD_SM} px-3 py-2`}>
              <summary className="text-[10px] lg:text-xs font-bold text-[#4FD1FF] cursor-pointer select-none">Info rules input</summary>
              <ul className="mt-1.5 space-y-0.5 text-[10px] lg:text-xs text-[#9CA3AF]">
                <li>- Item dropdown, 1x per station</li>
                <li>- Lot otomatis = tanggal input</li>
                <li>- KULIT PANGSIT, SURAI NAGA, PENTOL, MIE POLOS = pick date manual</li>
                <li>- LAINNYA = isi nama & satuan manual</li>
              </ul>
            </details>

            {selectedStations.map((station) => (
              <div key={station} className={CLAY_CARD_SM}>
                {/* Collapsible station header */}
                <button
                  type="button"
                  onClick={() => toggleExpandStation(station)}
                  className="w-full flex items-center justify-between px-3 py-2.5 lg:px-4 lg:py-3"
                >
                  <div className="flex items-center gap-2">
                    {expandedStations[station] ? <ChevronDown className="w-4 h-4 text-[#4FD1FF]" /> : <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />}
                    <StationIcon station={station} className="w-4 h-4 text-[#9CA3AF]" />
                    <span className="text-sm font-bold text-[#E5E7EB]">{station}</span>
                    {stationDraftRowsMap[station].length > 0 && (
                      <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md border border-green-500/20">
                        {stationDraftRowsMap[station].length} item
                      </span>
                    )}
                    {parseErrorsMap[station].length > 0 && (
                      <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20">
                        {parseErrorsMap[station].length} error
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); addDraftRow(station); focusStation(station); }}
                    className={`${CLAY_BTN_OUTLINE} h-7 px-2 text-[10px] text-[#4FD1FF] hover:bg-[#4FD1FF]/5`}
                  >
                    <Plus className="w-3 h-3 mr-0.5" /> Add
                  </Button>
                </button>

                {/* Collapsible content */}
                {expandedStations[station] && (
                  <div className="px-3 pb-3 lg:px-4 lg:pb-4 space-y-2">
                    {parseErrorsMap[station].length > 0 && (
                      <div className="p-2 rounded-lg border border-red-500/20 bg-[#1A1C22] space-y-0.5">
                        {parseErrorsMap[station].map((err, i) => (
                          <p key={i} className="text-[10px] text-red-300">
                            {err.line > 0 && <span className="text-red-500">#{err.line}: </span>}
                            {err.message}
                          </p>
                        ))}
                      </div>
                    )}

                    {stationDraftRowsMap[station].length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[rgba(79,209,255,0.16)] px-3 py-4 text-center text-xs text-[#9CA3AF]">
                        Belum ada item. Klik "+ Add" di atas.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {stationDraftRowsMap[station].map((row, index) => {
                          const option = getCatalogItem(station, row.optionValue);
                          const availableOptions = getAvailableOptions(station, row.id);
                          const isManual = Boolean(option?.manual);
                          const needsManualLot = Boolean(option?.manualLot);

                          return (
                            <div key={row.id} className="rounded-lg border border-[rgba(79,209,255,0.10)] bg-[#1A1C22] p-2.5 lg:p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-[#4FD1FF]">#{index + 1}</p>
                                <button
                                  type="button"
                                  onClick={() => removeDraftRow(station, row.id)}
                                  className="text-[10px] text-red-400 hover:text-red-300"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className={LABEL}>Item</label>
                                  <select
                                    value={row.optionValue}
                                    onChange={(e) => updateDraftRow(station, row.id, {
                                      optionValue: e.target.value,
                                      kodeLot: selectedDate,
                                      manualName: e.target.value.startsWith(MANUAL_ITEM_VALUE) ? row.manualName : "",
                                      manualUnit: e.target.value.startsWith(MANUAL_ITEM_VALUE) ? row.manualUnit : "",
                                    })}
                                    className={`${CLAY_SELECT} text-xs py-2`}
                                  >
                                    <option value="">-- Pilih --</option>
                                    {availableOptions.map((item) => (
                                      <option key={item.value} value={item.value}>{item.label}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className={LABEL}>Qty {option?.unit && !isManual ? `(${option.unit})` : ""}</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={row.qty}
                                    onChange={(e) => updateDraftRow(station, row.id, { qty: e.target.value })}
                                    className={`${CLAY_INPUT} text-xs py-2`}
                                    placeholder="Qty"
                                  />
                                </div>

                                {isManual && (
                                  <>
                                    <div className="space-y-1">
                                      <label className={LABEL}>Nama Manual</label>
                                      <input
                                        type="text"
                                        value={row.manualName}
                                        onChange={(e) => updateDraftRow(station, row.id, { manualName: e.target.value })}
                                        className={`${CLAY_INPUT} text-xs py-2`}
                                        placeholder="SAMBAL KHUSUS"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className={LABEL}>Satuan</label>
                                      <input
                                        type="text"
                                        value={row.manualUnit}
                                        onChange={(e) => updateDraftRow(station, row.id, { manualUnit: e.target.value })}
                                        className={`${CLAY_INPUT} text-xs py-2`}
                                        placeholder="PCS / GRAM"
                                      />
                                    </div>
                                  </>
                                )}

                                {needsManualLot && (
                                  <div className="space-y-1">
                                    <label className={LABEL}>Pick Date</label>
                                    <input
                                      type="date"
                                      value={row.kodeLot}
                                      onChange={(e) => updateDraftRow(station, row.id, { kodeLot: e.target.value })}
                                      className={`${CLAY_INPUT} text-xs py-2`}
                                    />
                                  </div>
                                )}

                                <div className={`space-y-1 ${!isManual && !needsManualLot ? "col-span-2" : ""}`}>
                                  <label className={LABEL}>Alasan</label>
                                  <input
                                    type="text"
                                    value={row.alasan}
                                    onChange={(e) => updateDraftRow(station, row.id, { alasan: e.target.value })}
                                    className={`${CLAY_INPUT} text-xs py-2`}
                                    placeholder="Expired, rusak, susut"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            <Button
              onClick={handlePrepareItems}
              disabled={selectedStations.every(st => stationDraftRowsMap[st].length === 0)}
              className="w-full rounded-[16px] bg-[linear-gradient(180deg,#26364A_0%,#1D2939_100%)] py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.3)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-40 lg:py-4 lg:text-base"
            >
              <Zap className="w-4 h-4 mr-1.5" /> Cek & Preview
            </Button>
          </div>
        )}

        {/* ========== STEP: PREVIEW ========== */}
        {step === "preview" && (
          <div className="space-y-3 w-full">
            {/* Compact header with inline summary */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base lg:text-xl font-bold text-green-400">Cek & Kirim</h2>
                <p className="text-[10px] lg:text-xs text-[#9CA3AF]">
                  {selectedStations.length} station - {totalItems} item - {selectedShift} {jam} WIB
                </p>
              </div>
              <div className="flex items-center gap-2">
                {signatureUrls[selectedQC] && <img src={signatureUrls[selectedQC]} alt="QC" className="h-5 rounded bg-[#2A2D37] p-0.5" />}
                {signatureUrls[selectedManajer] && <img src={signatureUrls[selectedManajer]} alt="Mgr" className="h-5 rounded bg-[#2A2D37] p-0.5" />}
              </div>
            </div>

            {/* Compact info strip */}
            <div className={`${CLAY_CARD_SM} px-3 py-2 flex items-center justify-between text-[10px] lg:text-xs`}>
              <div className="flex items-center gap-3">
                <span className="text-[#9CA3AF]">QC: <span className="text-[#4FD1FF] font-medium">{selectedQC}</span></span>
                <span className="text-[#9CA3AF]">Mgr: <span className="text-[#9F7AEA] font-medium">{selectedManajer}</span></span>
              </div>
              <span className="text-[#9CA3AF]">{selectedDate}</span>
            </div>

            {/* Tester preview - compact */}
            {testerEnabled && (
              <div className={`${CLAY_CARD_SM} px-3 py-2 border-amber-500/15`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400">TESTER</span>
                    {testerSubmitStatus === 'success' && <span className="text-[9px] text-green-400">Done</span>}
                    {testerSubmitStatus === 'error' && <span className="text-[9px] text-red-400">Error</span>}
                  </div>
                  <span className={`text-[10px] font-medium ${testerAllChecked ? "text-green-400" : "text-amber-400"}`}>
                    {testerAllChecked ? "All OK" : `Kendala: ${testerKendala || "-"}`}
                  </span>
                </div>
              </div>
            )}

            {/* Per-station: collapsible with photo upload */}
            {selectedStations.map(station => (
              <div key={station} className={CLAY_CARD_SM}>
                {/* Station header - clickable to expand/collapse */}
                <button
                  type="button"
                  onClick={() => togglePreviewStation(station)}
                  className="w-full flex items-center justify-between px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    {expandedPreviewStations[station] ? <ChevronDown className="w-3.5 h-3.5 text-[#4FD1FF]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF]" />}
                    <StationIcon station={station} className="w-4 h-4 text-[#9CA3AF]" />
                    <span className="text-sm font-bold text-[#E5E7EB]">{station}</span>
                    <span className="text-[9px] text-[#9CA3AF]">({parsedItemsMap[station].length} item)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dokumentasiFilesMap[station].length > 0 ? (
                      <span className="text-[9px] text-green-400">{dokumentasiFilesMap[station].length} foto</span>
                    ) : (
                      <span className="text-[9px] text-red-400">No foto</span>
                    )}
                    {isSubmitting && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        submitStatusMap[station] === "uploading" ? "text-yellow-400" :
                        submitStatusMap[station] === "success" ? "text-green-400" :
                        submitStatusMap[station] === "error" ? "text-red-400" : "text-[#9CA3AF]"
                      }`}>
                        {submitStatusMap[station] === "uploading" ? "..." :
                         submitStatusMap[station] === "success" ? "OK" :
                         submitStatusMap[station] === "error" ? "ERR" : "-"}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded: items table + photo upload */}
                {expandedPreviewStations[station] && (
                  <div className="px-3 pb-3 space-y-2">
                    {/* Compact items list */}
                    <div className="rounded-lg border border-[rgba(79,209,255,0.08)] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] lg:text-xs">
                          <thead>
                            <tr className="bg-[#1A1C22] text-[#9CA3AF]">
                              <th className="px-1.5 py-1 text-left">#</th>
                              <th className="px-1.5 py-1 text-left">Produk</th>
                              <th className="px-1.5 py-1 text-center">Qty</th>
                              <th className="px-1.5 py-1 text-left">Unit</th>
                              <th className="px-1.5 py-1 text-left">Alasan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedItemsMap[station].map((item, i) => (
                              <tr key={i} className="border-t border-[rgba(79,209,255,0.06)]">
                                <td className="px-1.5 py-1 text-[#9CA3AF]">{i + 1}</td>
                                <td className="px-1.5 py-1 text-[#E5E7EB] font-medium truncate max-w-[90px] lg:max-w-[200px]">{item.namaProduk}</td>
                                <td className="px-1.5 py-1 text-center text-yellow-400 font-bold">{item.qty}</td>
                                <td className="px-1.5 py-1 text-[#E5E7EB]">{item.unit}</td>
                                <td className="px-1.5 py-1 text-[#9CA3AF] truncate max-w-[60px] lg:max-w-[150px]">{item.alasan}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Photo upload */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-[#E5E7EB]">
                        Foto {station} <span className="text-red-400">*</span>
                      </label>
                      <MultiFileUpload
                        onFilesSelect={(files) => setDokumentasiFilesMap(prev => ({ ...prev, [station]: files }))}
                        maxFiles={10}
                        accept="image/*"
                        label={`Foto ${station}`}
                      />
                    </div>
                  </div>
                )}

                {/* Always show photo upload inline if collapsed and no photos yet */}
                {!expandedPreviewStations[station] && dokumentasiFilesMap[station].length === 0 && (
                  <div className="px-3 pb-2.5">
                    <MultiFileUpload
                      onFilesSelect={(files) => setDokumentasiFilesMap(prev => ({ ...prev, [station]: files }))}
                      maxFiles={10}
                      accept="image/*"
                      label={`Foto ${station}`}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Error summary banner */}
            {selectedStations.some(st => submitStatusMap[st] === "error") && !isSubmitting && (
              <div className={`${CLAY_CARD_SM} px-3 py-2.5 border-red-500/20`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-bold text-red-400">
                    {selectedStations.filter(st => submitStatusMap[st] === "error").length} station gagal
                  </span>
                </div>
                {selectedStations.filter(st => submitStatusMap[st] === "error").map(st => (
                  <p key={st} className="text-[10px] text-red-300 mb-0.5">
                    <span className="text-red-500 font-bold">{st}:</span> {stationErrors[st] || "Error"}
                  </p>
                ))}
                <Button
                  onClick={handleRetryFailed}
                  size="sm"
                  className="w-full mt-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-2 rounded-lg text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1.5" /> Retry Gagal
                </Button>
              </div>
            )}

            {/* Action buttons - compact */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setStep(selectedStations.length > 0 ? "paste" : "config")}
                disabled={isSubmitting}
                className={`flex-1 ${CLAY_BTN_OUTLINE} py-3 text-xs`}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
              <Button
                onClick={() => handleSubmit()}
                disabled={isSubmitting || (selectedStations.length > 0 && selectedStations.some(st => dokumentasiFilesMap[st].length === 0))}
                className="flex-[2] bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl py-3 text-xs lg:text-sm transition-all duration-200"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Menyimpan...</>
                ) : (
                  <><Send className="w-3.5 h-3.5 mr-1.5" /> Kirim {selectedStations.length > 0 ? `${selectedStations.length} Station` : ""}{testerEnabled ? (selectedStations.length > 0 ? " + Tester" : "Tester") : ""}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ========== STEP: SUCCESS ========== */}
        {step === "success" && (
          <div className="space-y-4 w-full text-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-green-400 mb-1">Tersimpan!</h2>
              <p className="text-xs lg:text-sm text-[#9CA3AF]">
                {selectedStations.length} station - {selectedShift} ke-record
              </p>
            </div>

            <div className={`${CLAY_CARD_SM} px-3 py-3 text-left space-y-1.5 text-xs lg:text-sm`}>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">Tanggal</span>
                <span className="text-[#E5E7EB] font-medium">{selectedDate} - {jam} WIB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">Resto / Shift</span>
                <span className="text-[#E5E7EB] font-medium">{storeName} / {selectedShift}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">QC / Manajer</span>
                <span><span className="text-[#4FD1FF] font-medium">{selectedQC}</span> / <span className="text-[#9F7AEA] font-medium">{selectedManajer}</span></span>
              </div>

              <div className="border-t border-[rgba(79,209,255,0.08)] my-1.5" />

              {testerEnabled && (
                <div className="flex items-center justify-between">
                  <span className="text-[#E5E7EB]">TESTER</span>
                  <span className={`text-xs font-bold ${
                    testerSubmitStatus === "success" ? "text-green-400" : testerSubmitStatus === "error" ? "text-red-400" : "text-[#9CA3AF]"
                  }`}>
                    {testerSubmitStatus === "success"
                      ? (testerAllChecked ? "OK AMAN" : "Warning Kendala")
                      : testerSubmitStatus === "error" ? "ERR Error" : "-"}
                  </span>
                </div>
              )}

              {selectedStations.map(station => (
                <div key={station} className="flex items-center justify-between">
                  <span className="text-[#E5E7EB] inline-flex items-center gap-1.5">
                    <StationIcon station={station} className="w-4 h-4" />
                    {station}
                  </span>
                  <span className={`text-xs font-bold ${
                    submitStatusMap[station] === "success" ? "text-green-400" : "text-red-400"
                  }`}>
                    {submitStatusMap[station] === "success" ? `OK ${parsedItemsMap[station].length} item` : "ERR Error"}
                  </span>
                </div>
              ))}

              <div className="border-t border-[rgba(79,209,255,0.08)] my-1.5" />

              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">Total</span>
                <span className="text-[#E5E7EB] font-bold text-sm lg:text-base">{totalItems} produk</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleNewEntry}
                className="flex-[2] rounded-[16px] bg-[linear-gradient(180deg,#26364A_0%,#1D2939_100%)] py-3 text-sm font-semibold text-white transition hover:brightness-105"
              >
                <Zap className="w-4 h-4 mr-1.5" /> Shift Baru
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className={`flex-1 ${CLAY_BTN_OUTLINE} py-3 text-xs`}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Menu
              </Button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
