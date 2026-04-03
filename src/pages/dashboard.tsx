import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Package, Calendar, BarChart3,
  Loader2, RefreshCw, ChevronDown, ChevronRight,
  Store, User, Clock, Award, Flame, Activity,
  ArrowUpRight, ArrowDownRight, Zap, ChevronUp,
  LayoutDashboard, Trophy, Target, Boxes
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { useToast } from "@/hooks/use-toast";
import wasteLogo from "@assets/waste-logo_1753322218969.webp";

// ==================== TYPES ====================
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
  lastEntry?: {
    date: string;
    qc: string;
    station: string;
    shift: string;
  };
  stationBreakdown?: Record<string, Array<{ unit: string; items: Array<{ name: string; qty: number }>; totalQty: number }>>;
  periodBreakdown?: Record<string, Record<string, Array<{ unit: string; items: Array<{ name: string; qty: number }>; totalQty: number }>>>;
  qcNames?: string[];
}

// ==================== UTILS ====================
function parseTabDate(tab: string): Date | null {
  const m = tab.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  return new Date(2000 + parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

function formatTabDate(tab: string): { display: string; dayName: string; fullDate: string } {
  const d = parseTabDate(tab);
  if (!d || isNaN(d.getTime())) return { display: tab, dayName: "?", fullDate: tab };
  const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  return {
    display: `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`,
    dayName: days[d.getDay()],
    fullDate: `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`,
  };
}

const STATION_COLORS: Record<string, string> = {
  NOODLE: "#4FD1FF",
  DIMSUM: "#8b5cf6",
  BAR: "#f59e0b",
  PRODUKSI: "#10b981",
};

const STATION_ICONS: Record<string, string> = {
  NOODLE: "🍜",
  DIMSUM: "🥟",
  BAR: "🍹",
  PRODUKSI: "🏭",
};

const SHIFT_COLORS: Record<string, string> = {
  OPENING: "#4FD1FF",
  MIDDLE: "#f59e0b",
  CLOSING: "#8b5cf6",
  MIDNIGHT: "#ef4444",
};

const PIE_COLORS = ["#4FD1FF", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

type RangeOption = "7" | "14" | "30" | "all" | "custom";

// ==================== ANIMATED COUNTER ====================
function AnimatedNumber({ value, duration = 1200, prefix = "", suffix = "" }: {
  value: number; duration?: number; prefix?: string; suffix?: string;
}) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setDisplayed(current);
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        ref.current = value;
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{prefix}{displayed.toLocaleString("id-ID")}{suffix}</>;
}

// ==================== SKELETON LOADER ====================
function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Hero skeleton */}
      <div className="h-40 rounded-2xl bg-[#23262F]/60" />
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[#23262F]/60" />
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="h-72 rounded-2xl bg-[#23262F]/60" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-[#23262F]/60" />
        <div className="h-64 rounded-2xl bg-[#23262F]/60" />
      </div>
    </div>
  );
}

// ==================== SECTION WRAPPER ====================
function Section({ title, icon, children, defaultOpen = true, badge, action }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gradient-to-br from-[#23262F] to-[#1F2128] border border-[rgba(79,209,255,0.06)] rounded-2xl overflow-hidden shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)] transition-all duration-300">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-[rgba(79,209,255,0.02)] transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#4FD1FF]/8 border border-[#4FD1FF]/10 flex items-center justify-center text-[#4FD1FF] group-hover:bg-[#4FD1FF]/12 transition-colors">
            {icon}
          </div>
          <h2 className="text-sm font-bold text-white tracking-tight">{title}</h2>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <ChevronDown className={`w-4 h-4 text-[#9CA3AF] transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      <div className={`transition-all duration-300 ease-in-out ${open ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}>
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}

// ==================== CUSTOM TOOLTIP ====================
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1C22] border border-[rgba(79,209,255,0.15)] rounded-xl px-3.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <p className="text-[11px] font-semibold text-[#4FD1FF] mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-[11px]">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#9CA3AF]">{p.name}:</span>
          <span className="font-bold text-white">{p.value?.toLocaleString("id-ID")}</span>
        </div>
      ))}
    </div>
  );
}

// ==================== MAIN DASHBOARD ====================
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

  const [statPeriod, setStatPeriod] = useState<"daily" | "weekly" | "monthly" | "custom">("weekly");
  const [customStatDate, setCustomStatDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

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
      const res = await apiFetch(`/api/dashboard-data?${params}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Gagal load data");
      }
    } catch {
      setError("Ga bisa connect ke server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange.startDate, dateRange.endDate]);

  const rangeLabels: Record<RangeOption, string> = {
    "7": "7 Hari",
    "14": "14 Hari",
    "30": "30 Hari",
    all: "Semua",
    custom: "Custom",
  };

  // Chart data
  const areaData = data?.dailyData.map((d) => ({
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

  const userName = localStorage.getItem("waste_app_qc_name") || "User";
  const tenantName = localStorage.getItem("waste_app_tenant_name") || "";

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Selamat Pagi" : hour < 15 ? "Selamat Siang" : hour < 18 ? "Selamat Sore" : "Selamat Malam";
  const greetingEmoji = hour < 11 ? "☀️" : hour < 15 ? "🌤️" : hour < 18 ? "🌅" : "🌙";

  // Compute trend (compare last 2 days qty)
  const trend = useMemo(() => {
    if (!data || data.dailyData.length < 2) return null;
    const sorted = [...data.dailyData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = sorted[0].qty;
    const prev = sorted[1].qty;
    if (prev === 0) return null;
    const pct = ((latest - prev) / prev) * 100;
    return { pct: Math.abs(Math.round(pct)), up: pct > 0 };
  }, [data]);

  return (
    <div className="flex-1 bg-[#1A1C22] text-white flex flex-col">
      {/* ═══════ DESKTOP HEADER ═══════ */}
      <div className="hidden lg:flex items-center gap-3 px-6 py-3.5 border-b border-[rgba(79,209,255,0.08)] bg-[#1A1C22]/95">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4FD1FF]/20 to-[#9F7AEA]/20 border border-[#4FD1FF]/15 flex items-center justify-center">
          <LayoutDashboard className="w-4 h-4 text-[#4FD1FF]" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">Dashboard</h1>
          {tenantName && <p className="text-[10px] text-[#9CA3AF] -mt-0.5">{tenantName}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Date range pills */}
          <div className="flex items-center bg-[#23262F] rounded-xl border border-[rgba(79,209,255,0.08)] p-1 gap-0.5">
            {(["7", "14", "30", "all"] as RangeOption[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setRange(opt)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                  range === opt
                    ? "bg-[#4FD1FF]/15 text-[#4FD1FF] shadow-[inset_0_1px_0_rgba(79,209,255,0.1)]"
                    : "text-[#9CA3AF] hover:text-[#9CA3AF] hover:bg-[#2A2D37]/50"
                }`}
              >
                {rangeLabels[opt]}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            className="text-[#4FD1FF] hover:bg-[#4FD1FF]/8 p-1.5 h-8 w-8 rounded-lg"
            title="Refresh data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ═══════ MOBILE HEADER ═══════ */}
      <header className="sticky top-0 z-50 border-b border-[rgba(79,209,255,0.08)] bg-[#1A1C22] lg:hidden">
        <div className="w-full px-3 pt-2 pb-1.5 flex items-center justify-between desktop-header-container">
          <div className="flex items-center gap-2.5">
            <img src={wasteLogo} alt="AWAS" className="w-7 h-7 rounded-md" />
            <div className="leading-tight">
              <h1 className="text-sm font-bold bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] bg-clip-text text-transparent flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#4FD1FF] flex-shrink-0" />
                Dashboard
              </h1>
              {tenantName && (
                <p className="text-[10px] text-[#9CA3AF] flex items-center gap-1 mt-0.5">
                  <Store className="w-2.5 h-2.5" />
                  {tenantName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#4FD1FF]/8 border border-[rgba(79,209,255,0.08)] mr-1">
              <User className="w-3 h-3 text-[#4FD1FF]/60" />
              <span className="text-[10px] font-medium text-[#4FD1FF]">{userName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="text-[#4FD1FF] hover:bg-[#4FD1FF]/8 p-1.5 h-8 w-8"
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {/* Mobile date range */}
        <div className="w-full px-3 pb-2 desktop-header-container">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5" style={{ WebkitOverflowScrolling: "touch" }}>
            {(["7", "14", "30", "all"] as RangeOption[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setRange(opt)}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  range === opt
                    ? "bg-[#4FD1FF]/15 text-[#4FD1FF] border border-[#4FD1FF]/20 shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)]"
                    : "text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-[#2A2D37] border border-transparent"
                }`}
              >
                {rangeLabels[opt]}
              </button>
            ))}
            <div className="relative">
              <button
                onClick={() => setShowRangeMenu(!showRangeMenu)}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  range === "custom"
                    ? "bg-[#4FD1FF]/15 text-[#4FD1FF] border border-[#4FD1FF]/20 shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)]"
                    : "text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-[#2A2D37] border border-transparent"
                }`}
              >
                <Calendar className="w-3 h-3" />
                Custom
                <ChevronDown className="w-3 h-3" />
              </button>
              {showRangeMenu && (
                <div className="absolute right-0 mt-1.5 w-60 bg-[#2A2D37] border border-[rgba(79,209,255,0.12)] rounded-xl shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)] z-50 p-3">
                  <p className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider mb-2">Pilih Rentang Tanggal</p>
                  <div className="space-y-1.5">
                    <div>
                      <label className="text-[10px] text-[#9CA3AF] mb-0.5 block">Dari</label>
                      <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full text-xs bg-[#23262F] border border-[rgba(79,209,255,0.12)] rounded-lg px-2 py-1.5 text-white focus:border-[#4FD1FF]/20 focus:outline-none transition" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#9CA3AF] mb-0.5 block">Sampai</label>
                      <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full text-xs bg-[#23262F] border border-[rgba(79,209,255,0.12)] rounded-lg px-2 py-1.5 text-white focus:border-[#4FD1FF]/20 focus:outline-none transition" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="ghost" onClick={() => setShowRangeMenu(false)} className="flex-1 h-7 text-[11px] text-[#9CA3AF] hover:text-white">Batal</Button>
                    <Button size="sm" onClick={() => { setRange("custom"); setShowRangeMenu(false); }} disabled={!customStart || !customEnd}
                      className="flex-1 h-7 text-[11px] bg-[#4FD1FF]/80 hover:bg-[#4FD1FF]/90 text-white rounded-lg">Terapkan</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <main className="flex-1 w-full px-5 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4 sm:space-y-5 overflow-x-hidden desktop-container">
        {loading && <DashboardSkeleton />}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Activity className="w-7 h-7 text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-red-400 font-medium mb-1">{error}</p>
              <p className="text-[#9CA3AF] text-xs">Cek koneksi internet atau coba lagi nanti</p>
            </div>
            <Button onClick={fetchData} variant="outline" className="border-[rgba(79,209,255,0.12)] text-[#4FD1FF] mt-2">
              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Coba Lagi
            </Button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* ═══════ HERO WELCOME BANNER ═══════ */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#23262F] via-[#1F2128] to-[#23262F] border border-[rgba(79,209,255,0.08)] shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)]">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#4FD1FF]/[0.02] rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#9F7AEA]/[0.02] rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl" />
              
              <div className="relative px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Greeting */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{greetingEmoji}</span>
                      <h1 className="text-base sm:text-lg font-bold text-white">{greeting}, <span className="bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] bg-clip-text text-transparent">{userName}</span></h1>
                    </div>
                    <p className="text-xs text-[#9CA3AF] flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      <span className="text-[#4FD1FF]/40">•</span>
                      <span className="text-[#4FD1FF]/60">{rangeLabels[range]}</span>
                    </p>
                  </div>

                  {/* Last entry mini-card */}
                  {data.lastEntry && (
                    <div className="flex items-center gap-3 bg-[#1A1C22]/60 rounded-xl px-3.5 py-2.5 border border-[rgba(79,209,255,0.06)]">
                      <div className="w-9 h-9 rounded-lg bg-[#4FD1FF]/8 border border-[#4FD1FF]/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-[#4FD1FF]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">Entry Terakhir</p>
                        <p className="text-xs font-bold text-white truncate">{data.lastEntry.station} • {data.lastEntry.shift}</p>
                        <p className="text-[10px] text-[#4FD1FF]/70">{data.lastEntry.date} — QC: {userName}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* QC Names */}
                {data.qcNames && data.qcNames.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[rgba(79,209,255,0.06)] flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-[#9CA3AF] font-medium mr-0.5">QC Aktif:</span>
                    {data.qcNames.map((qc: string) => (
                      <span key={qc} className="text-[10px] bg-[#4FD1FF]/8 text-[#4FD1FF] px-2.5 py-0.5 rounded-full border border-[#4FD1FF]/12 font-medium">{qc}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ═══════ SUMMARY STAT CARDS ═══════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Hari", value: data.summary.totalDays, icon: <Calendar className="w-4 h-4" />, gradient: "from-[#4FD1FF]/15 to-[#4FD1FF]/5", iconBg: "bg-[#4FD1FF]/10 border-[#4FD1FF]/15", textColor: "text-[#4FD1FF]" },
                { label: "Total Item", value: data.summary.totalItems, icon: <Package className="w-4 h-4" />, gradient: "from-[#8b5cf6]/15 to-[#8b5cf6]/5", iconBg: "bg-[#8b5cf6]/10 border-[#8b5cf6]/15", textColor: "text-[#8b5cf6]" },
                { label: "Total Qty", value: data.summary.totalQty, icon: <Boxes className="w-4 h-4" />, gradient: "from-[#f59e0b]/15 to-[#f59e0b]/5", iconBg: "bg-[#f59e0b]/10 border-[#f59e0b]/15", textColor: "text-[#f59e0b]" },
                { label: "Rata² Qty/Hari", value: data.summary.avgQtyPerDay, icon: <Target className="w-4 h-4" />, gradient: "from-[#10b981]/15 to-[#10b981]/5", iconBg: "bg-[#10b981]/10 border-[#10b981]/15", textColor: "text-[#10b981]" },
              ].map((card) => (
                <div
                  key={card.label}
                  className="group relative bg-gradient-to-br from-[#23262F] to-[#1F2128] border border-[rgba(79,209,255,0.06)] rounded-xl p-3.5 sm:p-4 shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                >
                  {/* Subtle gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl`} />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className={`w-8 h-8 rounded-lg ${card.iconBg} border flex items-center justify-center ${card.textColor}`}>
                        {card.icon}
                      </div>
                      {card.label === "Total Qty" && trend && (
                        <div className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          trend.up ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                        }`}>
                          {trend.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {trend.pct}%
                        </div>
                      )}
                    </div>
                    <p className={`text-xl sm:text-2xl font-bold ${card.textColor} tabular-nums`}>
                      <AnimatedNumber value={card.value} />
                    </p>
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5 uppercase tracking-wider font-medium">{card.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ═══════ STATION DETAIL (PERIOD BREAKDOWN) ═══════ */}
            {data.periodBreakdown && (
              <Section
                title="Waste per Station"
                icon={<Flame className="w-4 h-4" />}
                badge={
                  <span className="text-[10px] bg-[#4FD1FF]/8 text-[#4FD1FF]/70 px-2 py-0.5 rounded-full font-medium">Detail per Satuan</span>
                }
                action={
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex bg-[#1A1C22] rounded-lg border border-[rgba(79,209,255,0.08)] overflow-hidden">
                      {([["daily", "Hari Ini"], ["weekly", "7 Hari"], ["monthly", "30 Hari"]] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setStatPeriod(key)}
                          className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                            statPeriod === key
                              ? "bg-[#4FD1FF]/15 text-[#4FD1FF]"
                              : "text-[#9CA3AF] hover:text-[#9CA3AF]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        onClick={() => setStatPeriod("custom")}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all flex items-center gap-0.5 ${
                          statPeriod === "custom"
                            ? "bg-[#4FD1FF]/15 text-[#4FD1FF]"
                            : "text-[#9CA3AF] hover:text-[#9CA3AF]"
                        }`}
                      >
                        📅
                      </button>
                    </div>
                    {statPeriod === "custom" && (
                      <input
                        type="date"
                        value={customStatDate}
                        onChange={(e) => setCustomStatDate(e.target.value)}
                        className="text-[10px] bg-[#1A1C22] border border-[rgba(79,209,255,0.12)] rounded-lg px-2 py-1 text-white focus:border-[#4FD1FF]/30 focus:outline-none transition"
                      />
                    )}
                  </div>
                }
              >
                {(() => {
                  const periodData = statPeriod === "custom"
                    ? (data.periodBreakdown!.byDate?.[customStatDate] || {})
                    : (data.periodBreakdown![statPeriod] || {});
                  const stations = Object.keys(periodData);

                  if (stations.length === 0) {
                    const periodLabel = statPeriod === "daily" ? "hari ini"
                      : statPeriod === "weekly" ? "7 hari terakhir"
                      : statPeriod === "monthly" ? "30 hari terakhir"
                      : `tanggal ${customStatDate.split("-").reverse().join("/")}`;
                    return (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 rounded-xl bg-[#2A2D37] border border-[rgba(79,209,255,0.06)] flex items-center justify-center mx-auto mb-3">
                          <Package className="w-5 h-5 text-[#9CA3AF]" />
                        </div>
                        <p className="text-sm text-[#9CA3AF]">Belum ada data waste untuk {periodLabel}</p>
                      </div>
                    );
                  }

                  const sortedStations = stations.sort((a, b) => {
                    const totalA = periodData[a].reduce((s: number, u: any) => s + u.totalQty, 0);
                    const totalB = periodData[b].reduce((s: number, u: any) => s + u.totalQty, 0);
                    return totalB - totalA;
                  });

                  const grandTotal = sortedStations.reduce((s, st) => s + periodData[st].reduce((ss: number, u: any) => ss + u.totalQty, 0), 0);

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sortedStations.map((station: string, idx: number) => {
                        const unitGroups = periodData[station] as { unit: string; items: { name: string; qty: number }[]; totalQty: number }[];
                        const stationTotal = unitGroups.reduce((s: number, u) => s + u.totalQty, 0);
                        const stationItemCount = unitGroups.reduce((s: number, u) => s + u.items.length, 0);
                        const maxTotal = periodData[sortedStations[0]].reduce((s: number, u: any) => s + u.totalQty, 0);
                        const pct = grandTotal > 0 ? Math.round((stationTotal / grandTotal) * 100) : 0;

                        return (
                          <div key={station} className="bg-[#1A1C22]/60 rounded-xl border border-[rgba(79,209,255,0.06)] overflow-hidden hover:border-[rgba(79,209,255,0.12)] transition-colors">
                            {/* Station header */}
                            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[rgba(79,209,255,0.04)]">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ background: `${STATION_COLORS[station] || '#64748b'}15` }}>
                                  {STATION_ICONS[station] || "📦"}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-white">{station}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{
                                      background: `${STATION_COLORS[station] || '#64748b'}20`,
                                      color: STATION_COLORS[station] || '#64748b'
                                    }}>#{idx + 1}</span>
                                  </div>
                                  <p className="text-[10px] text-[#9CA3AF]">{stationItemCount} item • {pct}% dari total</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold" style={{ color: STATION_COLORS[station] || '#64748b' }}>
                                  {stationTotal.toLocaleString("id-ID")}
                                </p>
                                <p className="text-[9px] text-[#9CA3AF]">total qty</p>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="px-3.5 pt-2">
                              <div className="w-full bg-[#2A2D37] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-1.5 rounded-full transition-all duration-700 ease-out"
                                  style={{
                                    width: `${maxTotal > 0 ? (stationTotal / maxTotal) * 100 : 0}%`,
                                    background: `linear-gradient(90deg, ${STATION_COLORS[station] || '#64748b'}, ${STATION_COLORS[station] || '#64748b'}80)`
                                  }}
                                />
                              </div>
                            </div>

                            {/* Unit groups */}
                            <div className="p-3 space-y-2">
                              {unitGroups.map((ug) => (
                                <div key={ug.unit} className="bg-[#23262F]/80 rounded-lg p-2.5">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                      ug.unit === "GRAM" ? "bg-amber-500/10 text-amber-300 border border-amber-500/10" :
                                      ug.unit === "PCS" ? "bg-blue-500/10 text-blue-300 border border-blue-500/10" :
                                      ug.unit === "PORSI" ? "bg-green-500/10 text-green-300 border border-green-500/10" :
                                      "bg-purple-500/10 text-purple-300 border border-purple-500/10"
                                    }`}>
                                      {ug.unit}
                                    </span>
                                    <span className="text-[10px] text-[#9CA3AF]">
                                      <span className="font-bold text-white">{ug.totalQty.toLocaleString("id-ID")}</span> {ug.unit}
                                    </span>
                                  </div>
                                  <div className="space-y-1">
                                    {ug.items.slice(0, 5).map((item, iIdx) => (
                                      <div key={iIdx} className="flex items-center justify-between text-[11px] group/item">
                                        <span className="text-[#E5E7EB]/80 truncate mr-3 group-hover/item:text-[#E5E7EB] transition-colors">{item.name}</span>
                                        <span className="text-white/80 font-medium whitespace-nowrap tabular-nums">{item.qty.toLocaleString("id-ID")}</span>
                                      </div>
                                    ))}
                                    {ug.items.length > 5 && (
                                      <p className="text-[10px] text-[#4FD1FF]/50 mt-1 font-medium">+{ug.items.length - 5} item lainnya</p>
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
              </Section>
            )}

            {/* ═══════ TREND CHART (AREA) ═══════ */}
            <Section
              title="Tren Waste Harian"
              icon={<TrendingUp className="w-4 h-4" />}
              badge={
                trend && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                    trend.up ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                  }`}>
                    {trend.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trend.pct}% vs kemarin
                  </span>
                )
              }
            >
              {areaData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="gradQty" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4FD1FF" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#4FD1FF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradItems" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,209,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={{ stroke: "rgba(79,209,255,0.06)" }} tickLine={false} />
                    <YAxis tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Area type="monotone" dataKey="qty" name="Quantity" stroke="#4FD1FF" strokeWidth={2.5} fill="url(#gradQty)" dot={false} activeDot={{ r: 5, fill: "#4FD1FF", stroke: "#1A1C22", strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="items" name="Items" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradItems)" dot={false} activeDot={{ r: 4, fill: "#8b5cf6", stroke: "#1A1C22", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-[#9CA3AF] text-sm">Tidak ada data untuk periode ini</div>
              )}
            </Section>

            {/* ═══════ STATION & SHIFT CHARTS ═══════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Station Bar Chart */}
              <Section title="Waste per Station" icon={<BarChart3 className="w-4 h-4" />} defaultOpen={true}>
                {stationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stationData} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,209,255,0.04)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="qty" name="Quantity" radius={[8, 8, 0, 0]}>
                        {stationData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-[#9CA3AF] text-sm">Tidak ada data</div>
                )}
              </Section>

              {/* Shift Pie Chart */}
              <Section title="Waste per Shift" icon={<Clock className="w-4 h-4" />} defaultOpen={true}>
                {shiftData.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={shiftData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {shiftData.map((entry, i) => (
                            <Cell key={i} fill={SHIFT_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Legend pills */}
                    <div className="flex flex-wrap justify-center gap-2 mt-1">
                      {shiftData.map((entry, i) => {
                        const total = shiftData.reduce((s, e) => s + e.value, 0);
                        const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                        return (
                          <div key={i} className="flex items-center gap-1.5 bg-[#1A1C22]/60 rounded-lg px-2.5 py-1.5 border border-[rgba(79,209,255,0.04)]">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: SHIFT_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-[10px] text-[#9CA3AF] font-medium">{entry.name}</span>
                            <span className="text-[10px] font-bold text-white">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#9CA3AF] text-sm">Tidak ada data</div>
                )}
              </Section>
            </div>

            {/* ═══════ STATION TREND (STACKED BAR) ═══════ */}
            <Section title="Tren per Station" icon={<Activity className="w-4 h-4" />}>
              {stationLineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stationLineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,209,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    {allStations.map((station) => (
                      <Bar key={station} dataKey={station} name={station} stackId="a" fill={STATION_COLORS[station] || "#64748b"} radius={station === allStations[allStations.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-[#9CA3AF] text-sm">Tidak ada data</div>
              )}
            </Section>

            {/* ═══════ TOP PRODUCTS ═══════ */}
            <Section title="Top 10 Produk Waste" icon={<Trophy className="w-4 h-4" />}>
              {data.topProducts.length > 0 ? (
                <div className="space-y-2">
                  {data.topProducts.map((p, i) => {
                    const maxQty = data.topProducts[0]?.qty || 1;
                    const pct = (p.qty / maxQty) * 100;
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <div
                        key={i}
                        className="group flex items-center gap-3 bg-[#1A1C22]/50 hover:bg-[#1A1C22]/80 rounded-xl px-3.5 py-2.5 border border-[rgba(79,209,255,0.04)] hover:border-[rgba(79,209,255,0.1)] transition-all"
                      >
                        {/* Rank */}
                        <div className="w-8 h-8 rounded-lg bg-[#23262F] border border-[rgba(79,209,255,0.06)] flex items-center justify-center shrink-0">
                          {i < 3 ? (
                            <span className="text-sm">{medals[i]}</span>
                          ) : (
                            <span className="text-[11px] font-bold text-[#9CA3AF]">{i + 1}</span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-[#E5E7EB] truncate mr-2">{p.name}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-[#4FD1FF]/70 font-medium">{p.count}x</span>
                              <span className="text-xs font-bold text-[#f59e0b] tabular-nums">{p.qty.toLocaleString("id-ID")}</span>
                            </div>
                          </div>
                          {/* Bar */}
                          <div className="w-full bg-[#2A2D37] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                background: i === 0 ? "linear-gradient(90deg, #f59e0b, #f59e0b80)" :
                                  i === 1 ? "linear-gradient(90deg, #4FD1FF, #4FD1FF80)" :
                                  i === 2 ? "linear-gradient(90deg, #8b5cf6, #8b5cf680)" :
                                  "linear-gradient(90deg, #6B728080, #6B728040)"
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-[#9CA3AF] text-sm">Tidak ada data</div>
              )}
            </Section>
          </>
        )}
      </main>

      <div className="lg:hidden">
        <Footer />
      </div>
    </div>
  );
}
