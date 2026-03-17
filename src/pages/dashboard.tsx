import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  TrendingUp, Package, Calendar, BarChart3, 
  Loader2, RefreshCw, ChevronDown,
  Store, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { useToast } from "@/hooks/use-toast";
import wasteLogo from "@assets/waste-logo_1753322218969.webp";

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
  NOODLE: "#4FD1FF",
  DIMSUM: "#8b5cf6",
  BAR: "#f59e0b",
  PRODUKSI: "#10b981",
};

const SHIFT_COLORS: Record<string, string> = {
  OPENING: "#4FD1FF",
  MIDDLE: "#f59e0b",
  CLOSING: "#8b5cf6",
  MIDNIGHT: "#ef4444",
};

const PIE_COLORS = ["#4FD1FF", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

type RangeOption = "7" | "14" | "30" | "all" | "custom";

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
  


  // Pelapor dropdown state
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

  const userName = localStorage.getItem("waste_app_qc_name") || "User";
  const tenantName = localStorage.getItem("waste_app_tenant_name") || "";

  return (
    <div className="min-h-screen bg-[#1A1C22] text-white flex flex-col">
      {/* Desktop page title */}
      <div className="hidden lg:flex items-center gap-3 px-6 py-4 border-b border-[rgba(79,209,255,0.08)] bg-[#1A1C22]/80 backdrop-blur-sm">
        <BarChart3 className="w-5 h-5 text-[#4FD1FF]" />
        <h1 className="text-lg font-bold text-[#4FD1FF]">Dashboard</h1>
        {tenantName && <span className="text-xs text-[#4FD1FF]/60 font-sans">{tenantName}</span>}
        <div className="ml-auto">
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

      {/* Header - Mobile only */}
      <header className="sticky top-0 z-50 border-b border-[rgba(79,209,255,0.08)] bg-[#1A1C22]/95 backdrop-blur-md lg:hidden">
        {/* Top row: branding + actions */}
        <div className="w-full px-3 pt-2 pb-1.5 flex items-center justify-between desktop-header-container">
          <div className="flex items-center gap-2.5">
            <img src={wasteLogo} alt="AWAS" className="w-7 h-7 rounded-md" />
            <div className="leading-tight">
              <h1 className="text-sm font-bold bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] bg-clip-text text-transparent flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#4FD1FF] flex-shrink-0" />
                Dashboard
              </h1>
              {tenantName && (
                <p className="text-[10px] text-[#6B7280] flex items-center gap-1 mt-0.5">
                  <Store className="w-2.5 h-2.5" />
                  {tenantName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* User badge */}
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
        {/* Bottom row: date range controls */}
        <div className="w-full px-3 pb-2 desktop-header-container">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                <div className="absolute left-0 mt-1.5 w-60 bg-[#2A2D37] border border-[rgba(79,209,255,0.12)] rounded-xl shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)] z-50 p-3">
                  <p className="text-[10px] text-[#6B7280] font-medium uppercase tracking-wider mb-2">Pilih Rentang Tanggal</p>
                  <div className="space-y-1.5">
                    <div>
                      <label className="text-[10px] text-[#9CA3AF] mb-0.5 block">Dari</label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full text-xs bg-[#23262F] border border-[rgba(79,209,255,0.12)] rounded-lg px-2 py-1.5 text-white focus:border-[#4FD1FF]/20 focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#9CA3AF] mb-0.5 block">Sampai</label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full text-xs bg-[#23262F] border border-[rgba(79,209,255,0.12)] rounded-lg px-2 py-1.5 text-white focus:border-[#4FD1FF]/20 focus:outline-none transition"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowRangeMenu(false)}
                      className="flex-1 h-7 text-[11px] text-[#9CA3AF] hover:text-white"
                    >
                      Batal
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setRange("custom"); setShowRangeMenu(false); }}
                      disabled={!customStart || !customEnd}
                      className="flex-1 h-7 text-[11px] bg-[#4FD1FF]/80 hover:bg-[#4FD1FF]/90 text-white rounded-lg"
                    >
                      Terapkan
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-3 py-4 space-y-4 desktop-container">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#4FD1FF] mr-3" />
            <span className="text-[#9CA3AF]">Lagi loading data, bentar ya...</span>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-20">
            <p className="text-red-400 mb-3">{error}</p>
            <Button onClick={fetchData} variant="outline" className="border-[rgba(79,209,255,0.12)] text-[#4FD1FF]">
              Coba Lagi
            </Button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* ==================== DATA WASTE TERAKHIR ==================== */}
            {data.lastEntry && (
              <div className="bg-[#23262F] border border-[rgba(79,209,255,0.08)] rounded-xl p-4">
                <h2 className="text-sm font-semibold text-[#4FD1FF] flex items-center gap-2 mb-3">
                  📋 Data Waste Terakhir
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#23262F]/80 rounded-lg p-3 border border-[rgba(79,209,255,0.06)]">
                    <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">Tanggal</p>
                    <p className="text-sm font-bold text-white mt-1">{data.lastEntry.date}</p>
                  </div>
                  <div className="bg-[#23262F]/80 rounded-lg p-3 border border-[rgba(79,209,255,0.06)]">
                    <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">QC / Pelapor</p>
                    <p className="text-sm font-bold text-[#4FD1FF] mt-1">{data.lastEntry.qc || '-'}</p>
                  </div>
                  <div className="bg-[#23262F]/80 rounded-lg p-3 border border-[rgba(79,209,255,0.06)]">
                    <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">Station</p>
                    <p className="text-sm font-bold text-amber-300 mt-1">{data.lastEntry.station}</p>
                  </div>
                  <div className="bg-[#23262F]/80 rounded-lg p-3 border border-[rgba(79,209,255,0.06)]">
                    <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">Shift</p>
                    <p className="text-sm font-bold text-violet-300 mt-1">{data.lastEntry.shift}</p>
                  </div>
                </div>
                {data.qcNames && data.qcNames.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-[#6B7280] mr-1 self-center">QC Aktif:</span>
                    {data.qcNames.map((qc: string) => (
                      <span key={qc} className="text-[10px] bg-[#4FD1FF]/8 text-[#4FD1FF] px-2 py-0.5 rounded-full border border-[#4FD1FF]/15">{qc}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ==================== WASTE STATION DETAIL (by UNIT) ==================== */}
            {data.periodBreakdown && (
              <div className="bg-[#23262F] border border-[rgba(79,209,255,0.08)] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h2 className="text-sm font-semibold text-[#4FD1FF] flex items-center gap-2">
                    🏭 Waste per Station (Detail per Satuan)
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex bg-[#23262F] rounded-lg border border-[rgba(79,209,255,0.08)] overflow-hidden">
                      {([["daily", "Hari Ini"], ["weekly", "7 Hari"], ["monthly", "30 Hari"]] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setStatPeriod(key)}
                          className={`px-3 py-1 text-[11px] font-medium transition-all ${
                            statPeriod === key 
                              ? "bg-[#4FD1FF]/80 text-white" 
                              : "text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-[#2A2D37]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        onClick={() => setStatPeriod("custom")}
                        className={`px-3 py-1 text-[11px] font-medium transition-all flex items-center gap-1 ${
                          statPeriod === "custom" 
                            ? "bg-[#4FD1FF]/80 text-white" 
                            : "text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-[#2A2D37]"
                        }`}
                      >
                        📅 Tanggal
                      </button>
                    </div>
                    {statPeriod === "custom" && (
                      <input
                        type="date"
                        value={customStatDate}
                        onChange={(e) => setCustomStatDate(e.target.value)}
                        className="text-xs bg-[#23262F] border border-[rgba(79,209,255,0.12)] rounded-lg px-2 py-1 text-white focus:border-[#4FD1FF]/30 focus:outline-none focus:ring-1 focus:ring-[#4FD1FF]/15 transition"
                      />
                    )}
                  </div>
                </div>

                {(() => {
                  const periodData = statPeriod === "custom" 
                    ? (data.periodBreakdown.byDate?.[customStatDate] || {})
                    : (data.periodBreakdown[statPeriod] || {});
                  const stations = Object.keys(periodData);
                  
                  if (stations.length === 0) {
                    const periodLabel = statPeriod === "daily" ? "hari ini" 
                      : statPeriod === "weekly" ? "7 hari terakhir" 
                      : statPeriod === "monthly" ? "30 hari terakhir"
                      : `tanggal ${customStatDate.split("-").reverse().join("/")}`;
                    return (
                      <p className="text-center text-[#6B7280] py-6 text-sm">
                        Belum ada data waste buat {periodLabel}
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
                        const stationTotal = unitGroups.reduce((s: number, u) => s + u.items.length, 0);
                        const maxTotal = periodData[sortedStations[0]].reduce((s: number, u: any) => s + u.totalQty, 0);
                        
                        return (
                          <div key={station} className="bg-[#23262F]/80 rounded-lg border border-[rgba(79,209,255,0.06)] overflow-hidden">
                            {/* Station header */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(79,209,255,0.06)]">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white bg-[#4FD1FF]/12 px-2 py-0.5 rounded">#{idx + 1}</span>
                                <span className="text-sm font-bold text-white">{station}</span>
                              </div>
                              <span className="text-[11px] text-[#9CA3AF]">
                                Total: <span className="text-[#4FD1FF] font-bold">{stationTotal.toLocaleString()}</span> item
                              </span>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="px-3 pt-1">
                              <div className="w-full bg-[#2A2D37] rounded-full h-1.5">
                                <div 
                                  className="h-1.5 rounded-full bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] transition-all"
                                  style={{ width: `${maxTotal > 0 ? (stationTotal / maxTotal) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                            
                            {/* Unit groups */}
                            <div className="p-3 space-y-2">
                              {unitGroups.map((ug) => (
                                <div key={ug.unit} className="bg-[#2A2D37]/80 rounded-lg p-2">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      ug.unit === 'GRAM' ? 'bg-amber-900/40 text-amber-300' :
                                      ug.unit === 'PCS' ? 'bg-blue-900/40 text-blue-300' :
                                      ug.unit === 'PORSI' ? 'bg-green-900/40 text-green-300' :
                                      'bg-purple-900/40 text-purple-300'
                                    }`}>
                                      {ug.unit}
                                    </span>
                                    <span className="text-[10px] text-[#9CA3AF]">
                                      Subtotal: <span className="font-bold text-white">{ug.totalQty.toLocaleString()} {ug.unit}</span>
                                    </span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {ug.items.slice(0, 5).map((item, iIdx) => (
                                      <div key={iIdx} className="flex items-center justify-between text-[11px]">
                                        <span className="text-[#E5E7EB] truncate mr-2">{item.name}</span>
                                        <span className="text-white font-sans font-medium whitespace-nowrap">{item.qty.toLocaleString()} {ug.unit}</span>
                                      </div>
                                    ))}
                                    {ug.items.length > 5 && (
                                      <p className="text-[10px] text-[#6B7280] mt-1">+{ug.items.length - 5} item lainnya</p>
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
                <div key={card.label} className="bg-[#23262F] border border-[rgba(79,209,255,0.08)] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <card.icon className={`w-4 h-4 text-${card.color}-400`} />
                    <span className="text-[10px] text-[#6B7280] uppercase tracking-wider">{card.label}</span>
                  </div>
                  <p className={`text-2xl font-bold text-${card.color}-400`}>
                    {card.value.toLocaleString("id-ID")}
                  </p>
                </div>
              ))}
            </div>

            {/* Trend Chart */}
            <div className="bg-[#23262F] border border-[rgba(79,209,255,0.08)] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[#4FD1FF] mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Tren Waste Harian
              </h2>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,209,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#2A2D37", border: "1px solid rgba(79,209,255,0.12)", borderRadius: "8px", fontSize: "12px" }} labelStyle={{ color: "#4FD1FF" }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey="qty" name="Quantity" stroke="#4FD1FF" strokeWidth={2} dot={{ fill: "#4FD1FF", r: 3 }} />
                    <Line type="monotone" dataKey="items" name="Items" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-[#6B7280] py-10">Tidak ada data untuk periode ini</p>
              )}
            </div>

            {/* Station & Shift Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#23262F] border border-[rgba(79,209,255,0.08)] rounded-xl p-4">
                <h2 className="text-sm font-semibold text-[#4FD1FF] mb-3">📊 Waste per Station</h2>
                {stationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={stationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,209,255,0.06)" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "#2A2D37", border: "1px solid rgba(79,209,255,0.12)", borderRadius: "8px", fontSize: "12px" }} />
                      <Bar dataKey="qty" name="Quantity" radius={[6, 6, 0, 0]}>
                        {stationData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-[#6B7280] py-10">Tidak ada data</p>
                )}
              </div>

              <div className="bg-[#23262F] border border-[rgba(79,209,255,0.08)] rounded-xl p-4">
                <h2 className="text-sm font-semibold text-[#4FD1FF] mb-3">🕐 Waste per Shift</h2>
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
                      <Tooltip contentStyle={{ background: "#2A2D37", border: "1px solid rgba(79,209,255,0.12)", borderRadius: "8px", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-[#6B7280] py-10">Tidak ada data</p>
                )}
              </div>
            </div>

            {/* Station Trend */}
            <div className="bg-[#23262F] border border-[rgba(79,209,255,0.08)] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[#4FD1FF] mb-3">📈 Tren per Station</h2>
              {stationLineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stationLineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,209,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#2A2D37", border: "1px solid rgba(79,209,255,0.12)", borderRadius: "8px", fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    {allStations.map((station) => (
                      <Bar key={station} dataKey={station} name={station} stackId="a" fill={STATION_COLORS[station] || "#64748b"} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-[#6B7280] py-10">Tidak ada data</p>
              )}
            </div>

            {/* Top Products */}
            <div className="bg-[#23262F] border border-[rgba(79,209,255,0.08)] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[#4FD1FF] mb-3">🏆 Top 10 Produk Waste</h2>
              {data.topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[rgba(79,209,255,0.08)]">
                        <th className="text-left py-2 px-2 text-[#6B7280]">#</th>
                        <th className="text-left py-2 px-2 text-[#6B7280]">Nama Produk</th>
                        <th className="text-right py-2 px-2 text-[#6B7280]">Frekuensi</th>
                        <th className="text-right py-2 px-2 text-[#6B7280]">Total Qty</th>
                        <th className="text-left py-2 px-2 text-[#6B7280]">Bar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, i) => {
                        const maxQty = data.topProducts[0]?.qty || 1;
                        const pct = (p.qty / maxQty) * 100;
                        return (
                          <tr key={i} className="border-b border-[rgba(79,209,255,0.06)] hover:bg-[#4FD1FF]/5 transition">
                            <td className="py-2 px-2 text-[#6B7280] font-sans">{i + 1}</td>
                            <td className="py-2 px-2 text-[#E5E7EB] font-medium">{p.name}</td>
                            <td className="py-2 px-2 text-right text-[#4FD1FF]">{p.count}x</td>
                            <td className="py-2 px-2 text-right text-amber-400 font-semibold">{p.qty}</td>
                            <td className="py-2 px-2 w-32">
                              <div className="w-full bg-[#2A2D37] rounded-full h-2">
                                <div className="h-2 rounded-full bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA]" style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-[#6B7280] py-10">Tidak ada data</p>
              )}
            </div>

          </>
        )}
      </main>

      <div className="lg:hidden">
        <Footer />
      </div>
    </div>
  );
}
