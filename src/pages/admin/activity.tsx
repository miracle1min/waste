import { useState, useEffect, useRef } from "react";
import {
  Loader2, RefreshCw, Activity, Search, Filter, ChevronLeft, ChevronRight,
  Clock, Globe, Monitor, FileText, Plus, Trash2, Building2, UserCog,
  AlertCircle, LogOut
} from "lucide-react";
import { api } from "./types";
import { Card, Badge, Btn, EmptyState, HeroBanner, CollapsibleSection, SkeletonLoader, AnimatedCounter } from "./shared";

interface ActivityLogItem {
  id: number;
  action: string;
  category: string;
  user_id: number | null;
  username: string;
  tenant_id: string;
  tenant_name: string;
  ip_address: string;
  user_agent: string;
  details: Record<string, unknown>;
  status: "success" | "failed" | "warning";
  created_at: string;
}

const ACTION_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  LOGIN: { icon: UserCog, color: "text-green-400", label: "Login" },
  LOGIN_FAILED: { icon: AlertCircle, color: "text-red-400", label: "Login Gagal" },
  LOGOUT: { icon: LogOut, color: "text-yellow-400", label: "Logout" },
  SUBMIT_WASTE: { icon: FileText, color: "text-[#4FD1FF]", label: "Submit Waste" },
  CREATE_USER: { icon: Plus, color: "text-blue-400", label: "Buat User" },
  DELETE_USER: { icon: Trash2, color: "text-red-400", label: "Hapus User" },
  CREATE_TENANT: { icon: Building2, color: "text-purple-400", label: "Buat Store" },
  DELETE_TENANT: { icon: Trash2, color: "text-red-400", label: "Hapus Store" },
};

const CATEGORY_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "auth", label: "🔐 Auth" },
  { value: "waste", label: "🗑️ Waste" },
  { value: "user", label: "👤 User" },
  { value: "tenant", label: "🏪 Tenant" },
  { value: "system", label: "⚙️ System" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "success", label: "✅ Success" },
  { value: "failed", label: "❌ Failed" },
  { value: "warning", label: "⚠️ Warning" },
];

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const fetchLogs = async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", "30");
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const data = await api(`/api/dashboard-data?mode=activity-log&${params}`);
      if (data.success) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setPage(p);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(1); }, [category, status, dateFrom, dateTo]);

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchLogs(1), 400);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "Baru saja";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
    if (diff < 172_800_000) return "Kemarin";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const getActionConfig = (action: string) => ACTION_CONFIG[action] || { icon: Activity, color: "text-[#4FD1FF]/80", label: action };
  
  const getStatusBadge = (s: string): "success" | "danger" | "warning" => {
    if (s === "success") return "success";
    if (s === "failed") return "danger";
    return "warning";
  };

  const getBrowserInfo = (ua: string) => {
    if (!ua) return "Unknown";
    if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
    if (ua.includes("Edg")) return "Edge";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    return "Browser";
  };

  const getDeviceInfo = (ua: string) => {
    if (!ua) return "Unknown";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac")) return "Mac";
    if (ua.includes("Linux")) return "Linux";
    return "Other";
  };

  return (
    <div className="space-y-5">
      {/* Hero */}
      <HeroBanner icon={Activity} title="Activity Log" subtitle={`Riwayat semua aktivitas sistem • ${total} total log`} variant="green" />

      {/* Quick Stats */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border bg-[#4FD1FF]/8 border-[#4FD1FF]/20">
          <span className="text-lg font-bold font-sans text-[#4FD1FF]"><AnimatedCounter value={total} /></span>
          <span className="text-[10px] font-sans text-[#4FD1FF]/60">Total Log</span>
        </div>
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border bg-green-500/10 border-green-500/20">
          <span className="text-[10px] font-sans text-green-400">Hal {page}/{totalPages}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Btn variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-3.5 w-3.5" />
          Filter
        </Btn>
        <Btn variant="primary" size="sm" onClick={() => fetchLogs(1)}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Btn>
      </div>

      {/* Search & Filter */}
      <Card>
        <div className="p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4FD1FF]/60" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cari username, action, atau store..."
              className="w-full h-11 pl-10 pr-4 bg-[#1A1C22]/60 border border-[#4FD1FF]/15 rounded-xl font-sans text-sm text-[#E5E7EB] placeholder:text-[#9CA3AF] focus:border-[#4FD1FF]/40 focus:ring-1 focus:ring-[#4FD1FF]/15 focus:outline-none transition-all"
            />
          </div>

          {/* Filter Panel */}
          <div
            className="transition-all duration-300 ease-in-out overflow-hidden"
            style={{ maxHeight: showFilters ? "200px" : "0", opacity: showFilters ? 1 : 0 }}
          >
            <div className="mt-3 pt-3 border-t border-[#4FD1FF]/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-sans text-[#4FD1FF]/60 mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#1A1C22]/60 border border-[#4FD1FF]/15 rounded-lg font-sans text-xs text-[#E5E7EB] focus:border-[#4FD1FF]/40 focus:outline-none appearance-none"
                >
                  {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-[#1A1C22]">{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-sans text-[#4FD1FF]/60 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#1A1C22]/60 border border-[#4FD1FF]/15 rounded-lg font-sans text-xs text-[#E5E7EB] focus:border-[#4FD1FF]/40 focus:outline-none appearance-none"
                >
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-[#1A1C22]">{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-sans text-[#4FD1FF]/60 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#1A1C22]/60 border border-[#4FD1FF]/15 rounded-lg font-sans text-xs text-[#E5E7EB] focus:border-[#4FD1FF]/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-sans text-[#4FD1FF]/60 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#1A1C22]/60 border border-[#4FD1FF]/15 rounded-lg font-sans text-xs text-[#E5E7EB] focus:border-[#4FD1FF]/40 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Log List */}
      <Card>
        {loading ? (
          <SkeletonLoader rows={6} type="list" />
        ) : logs.length === 0 ? (
          <EmptyState icon={Activity} text="Belum ada activity log" />
        ) : (
          <div className="divide-y divide-[rgba(79,209,255,0.08)]">
            {logs.map((log) => {
              const cfg = getActionConfig(log.action);
              const Icon = cfg.icon;
              const isExpanded = expandedId === log.id;
              return (
                <div
                  key={log.id}
                  className="px-4 py-3 sm:px-5 hover:bg-[#4FD1FF]/[0.02] transition-colors cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg border border-[#4FD1FF]/10 flex items-center justify-center ${
                      log.status === "failed" ? "bg-red-500/10" : log.status === "warning" ? "bg-yellow-500/10" : "bg-[#4FD1FF]/8"
                    }`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-sans font-medium text-[#E5E7EB]">{cfg.label}</span>
                        <Badge variant={getStatusBadge(log.status)}>{log.status}</Badge>
                        <Badge variant="default">{log.category}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {log.username && (
                          <span className="text-xs font-sans text-[#4FD1FF] flex items-center gap-1">
                            <UserCog className="h-3 w-3" />
                            {log.username}
                          </span>
                        )}
                        {log.tenant_name && (
                          <span className="text-xs font-sans text-purple-400 flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {log.tenant_name}
                          </span>
                        )}
                        <span className="text-[11px] font-sans text-[#4FD1FF]/60 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(log.created_at)}
                        </span>
                      </div>

                      {/* Expanded Details */}
                      <div
                        className="transition-all duration-300 ease-in-out overflow-hidden"
                        style={{ maxHeight: isExpanded ? "500px" : "0", opacity: isExpanded ? 1 : 0 }}
                      >
                        <div className="mt-3 p-3 rounded-lg bg-[#1A1C22]/60 border border-[#4FD1FF]/10 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
                            <div>
                              <span className="text-[#4FD1FF]/60">IP Address: </span>
                              <span className="text-[#4FD1FF] inline-flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {log.ip_address || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#4FD1FF]/60">Device: </span>
                              <span className="text-[#4FD1FF] inline-flex items-center gap-1">
                                <Monitor className="h-3 w-3" />
                                {getDeviceInfo(log.user_agent)} • {getBrowserInfo(log.user_agent)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#4FD1FF]/60">Tenant ID: </span>
                              <span className="text-[#4FD1FF]">{log.tenant_id || "—"}</span>
                            </div>
                            <div>
                              <span className="text-[#4FD1FF]/60">User ID: </span>
                              <span className="text-[#4FD1FF]">{log.user_id ?? "—"}</span>
                            </div>
                            <div>
                              <span className="text-[#4FD1FF]/60">Waktu: </span>
                              <span className="text-[#4FD1FF]">{new Date(log.created_at).toLocaleString("id-ID")}</span>
                            </div>
                          </div>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div>
                              <span className="text-[10px] font-sans text-[#4FD1FF]/60 block mb-1">Detail:</span>
                              <pre className="text-[11px] font-sans text-[#4FD1FF] bg-[#1A1C22] rounded-md p-2 overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <ChevronRight className={`h-4 w-4 text-[#4FD1FF]/60 flex-shrink-0 mt-1 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 sm:px-5 border-t border-[#4FD1FF]/10 flex items-center justify-between">
            <span className="text-xs font-sans text-[#4FD1FF]/60">
              Hal {page}/{totalPages} • {total} log
            </span>
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Btn>
              <Btn variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
