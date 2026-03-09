import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  ArrowLeft, TrendingUp, Package, Calendar, BarChart3, 
  Loader2, RefreshCw, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";

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

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeOption>("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showRangeMenu, setShowRangeMenu] = useState(false);

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
    } catch (e) {
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

  // Format daily data for line chart
  const lineData = data?.dailyData.map((d) => ({
    date: new Date(d.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    fullDate: d.date,
    items: d.items,
    qty: d.qty,
  })) || [];

  // Station data for bar chart
  const stationData = Object.entries(data?.stationTotals || {}).map(([name, qty]) => ({
    name,
    qty,
    fill: STATION_COLORS[name] || "#64748b",
  }));

  // Shift data for pie chart
  const shiftData = Object.entries(data?.shiftTotals || {}).map(([name, qty]) => ({
    name,
    value: qty,
  }));

  // Station stacked data for line chart
  const stationLineData = data?.dailyData.map((d) => ({
    date: new Date(d.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    ...d.stations,
  })) || [];

  const allStations = [...new Set(data?.dailyData.flatMap((d) => Object.keys(d.stations)) || [])];

  return (
    <div className="min-h-screen bg-[hsl(220,45%,6%)] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-cyan-900/30 bg-[hsl(220,45%,8%)]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between">
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

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 py-4 space-y-4">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mr-3" />
            <span className="text-slate-400">Memuat data dashboard...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-20">
            <p className="text-red-400 mb-3">{error}</p>
            <Button onClick={fetchData} variant="outline" className="border-cyan-800 text-cyan-400">
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Dashboard Content */}
        {data && !loading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Hari", value: data.summary.totalDays, icon: Calendar, color: "cyan" },
                { label: "Total Item", value: data.summary.totalItems, icon: Package, color: "violet" },
                { label: "Total Qty", value: data.summary.totalQty, icon: TrendingUp, color: "amber" },
                { label: "Rata² Qty/Hari", value: data.summary.avgQtyPerDay, icon: BarChart3, color: "emerald" },
              ].map((card) => (
                <div
                  key={card.label}
                  className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-3"
                >
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
                    <Tooltip
                      contentStyle={{ background: "hsl(220,45%,12%)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontSize: "12px" }}
                      labelStyle={{ color: "#06b6d4" }}
                    />
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
              {/* Station Bar Chart */}
              <div className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-cyan-300 mb-3">📊 Waste per Station</h2>
                {stationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={stationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(6,182,212,0.1)" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: "hsl(220,45%,12%)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontSize: "12px" }}
                      />
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

              {/* Shift Pie Chart */}
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
                      <Tooltip
                        contentStyle={{ background: "hsl(220,45%,12%)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-slate-500 py-10">Tidak ada data</p>
                )}
              </div>
            </div>

            {/* Station Trend (Stacked) */}
            <div className="bg-[hsl(220,45%,10%)] border border-cyan-900/30 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-cyan-300 mb-3">📈 Tren per Station</h2>
              {stationLineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stationLineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(6,182,212,0.1)" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(220,45%,12%)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    {allStations.map((station) => (
                      <Bar
                        key={station}
                        dataKey={station}
                        name={station}
                        stackId="a"
                        fill={STATION_COLORS[station] || "#64748b"}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-500 py-10">Tidak ada data</p>
              )}
            </div>

            {/* Top Products Table */}
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
                                <div
                                  className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                  style={{ width: `${pct}%` }}
                                />
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
