import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Store, Users, Database, UserCheck, HardDrive, LayoutDashboard,
  Plus, Pencil, Trash2, Save, X, Loader2, Eye, EyeOff, RefreshCw,
  Shield, CheckCircle, AlertCircle, Zap, Upload, LogOut, Menu,
  Building2, UserCog, KeyRound, Server, ChevronRight, MoreHorizontal,
  Activity, Search, Filter, ChevronLeft, Clock, Globe, Monitor, FileText
} from "lucide-react";
import wasteLogo from "@assets/waste-logo_1753322218969.webp";

// ===== Types =====
interface Tenant { id: string; name: string; address: string; phone: string; status: string; neon_database_url: string; created_at: string; }
interface UserItem { id: string; tenant_id: string; username: string; role: string; created_at: string; }
interface Personnel { id: number; tenant_id: string; name: string; full_name: string; role: string; signature_url: string; status: string; created_at: string; }
interface TenantConfig { tenant_id: string; google_spreadsheet_id: string; google_sheets_credentials: string; r2_account_id: string; r2_access_key_id: string; r2_secret_access_key: string; r2_bucket_name: string; r2_public_url: string; updated_at: string; }

// ===== API Helper =====
async function api(url: string, method = "GET", body?: any) {
  const token = localStorage.getItem("waste_app_token") || "";
  const tenantId = localStorage.getItem("waste_app_tenant_id") || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (tenantId) headers["x-tenant-id"] = tenantId;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

// ===== Shared Components =====
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-cyan-900/30 bg-gray-900/40 backdrop-blur-sm ${className}`}>{children}</div>;
}

function CardHeader({ children, className = "", action }: { children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={`px-4 py-3 sm:px-5 sm:py-4 border-b border-cyan-900/20 flex items-center justify-between ${className}`}>
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "purple" | "blue" }) {
  const styles = {
    default: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    success: "bg-green-500/10 text-green-300 border-green-500/20",
    warning: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    danger: "bg-red-500/10 text-red-300 border-red-500/20",
    purple: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border ${styles[variant]}`}>{children}</span>;
}

function Input({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-[11px] font-mono text-cyan-500 mb-1.5">{label}</label>
      <input {...props} className={`w-full h-11 px-3.5 bg-black/30 border border-cyan-900/40 rounded-xl font-mono text-sm text-cyan-100 placeholder:text-cyan-800 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all ${props.className || ""}`} />
      {hint && <p className="text-[10px] font-mono text-cyan-700 mt-1">{hint}</p>}
    </div>
  );
}

function Select({ label, hint, children, ...props }: { label: string; hint?: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-[11px] font-mono text-cyan-500 mb-1.5">{label}</label>
      <select {...props} className={`w-full h-11 px-3.5 bg-black/30 border border-cyan-900/40 rounded-xl font-mono text-sm text-cyan-100 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all appearance-none ${props.className || ""}`}>
        {children}
      </select>
      {hint && <p className="text-[10px] font-mono text-cyan-700 mt-1">{hint}</p>}
    </div>
  );
}

function Btn({ children, variant = "primary", size = "md", ...props }: { children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost" | "purple"; size?: "sm" | "md" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex items-center justify-center gap-2 font-mono font-medium rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm" };
  const variants = {
    primary: "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-400/60",
    secondary: "border border-cyan-800/40 bg-transparent text-cyan-400 hover:bg-cyan-500/5 hover:border-cyan-600/50",
    danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
    ghost: "border border-transparent text-cyan-500 hover:bg-cyan-500/5",
    purple: "border border-purple-400/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:border-purple-400/60",
  };
  return <button {...props} className={`${base} ${sizes[size]} ${variants[variant]} ${props.className || ""}`}>{children}</button>;
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl border border-cyan-900/30 bg-cyan-500/5 flex items-center justify-center mx-auto mb-3">
        <Icon className="h-6 w-6 text-cyan-700" />
      </div>
      <p className="text-sm font-mono text-cyan-600">{text}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      <p className="text-xs font-mono text-cyan-600 mt-3">Loading...</p>
    </div>
  );
}

function RefreshBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-2 rounded-xl border border-cyan-800/30 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all">
      <RefreshCw className="h-4 w-4 text-cyan-500" />
    </button>
  );
}

// ===== Menu Items =====
type PageKey = "overview" | "tenants" | "users" | "personnel" | "configs" | "database" | "activity";
const MENU_ITEMS: { key: PageKey; label: string; shortLabel: string; icon: any; desc: string }[] = [
  { key: "overview", label: "Overview", shortLabel: "Home", icon: LayoutDashboard, desc: "Ringkasan sistem" },
  { key: "tenants", label: "Store", shortLabel: "Store", icon: Building2, desc: "Kelola resto/store" },
  { key: "users", label: "Users", shortLabel: "Users", icon: UserCog, desc: "Manajemen user" },
  { key: "personnel", label: "QC & Manager", shortLabel: "QC", icon: UserCheck, desc: "Personil & TTD" },
  { key: "configs", label: "Config", shortLabel: "Config", icon: KeyRound, desc: "Env & kredensial" },
  { key: "database", label: "Database", shortLabel: "DB", icon: Server, desc: "DB management" },
  { key: "activity", label: "Activity Log", shortLabel: "Log", icon: Activity, desc: "Riwayat aktivitas" },
];

// Mobile bottom nav shows first 4, rest in "More" menu
const MOBILE_NAV = MENU_ITEMS.slice(0, 4);
const MORE_NAV = MENU_ITEMS.slice(4);

// ===== Main Admin Panel =====
export default function AdminPanel() {
  const { qcName, logout, isLoggingOut } = useAuth();
  const [activePage, setActivePage] = useState<PageKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => { logout(); setTimeout(() => window.location.reload(), 800); };
  const handleNav = (key: PageKey) => { setActivePage(key); setSidebarOpen(false); setMoreOpen(false); };

  // Close "more" popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-cyan-100">
      {/* ====== Mobile overlay ====== */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      <div className="flex">
        {/* ====== Sidebar (desktop + mobile drawer) ====== */}
        <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-gray-950 border-r border-cyan-900/20 flex flex-col transition-transform duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} shrink-0`}>
          {/* Logo area */}
          <div className="p-5 border-b border-cyan-900/20">
            <div className="flex items-center gap-3">
              <img src={wasteLogo} alt="AWAS" className="w-10 h-10 rounded-xl shadow-lg shadow-cyan-500/10" />
              <div>
                <h1 className="text-base font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent leading-tight">AWAS</h1>
                <p className="text-[10px] text-cyan-700 font-mono">Control Panel</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNav(item.key)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all duration-200 group ${
                    isActive
                      ? "bg-cyan-500/10 border border-cyan-500/25 text-cyan-100"
                      : "border border-transparent text-cyan-500 hover:text-cyan-200 hover:bg-white/[0.02]"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    isActive ? "bg-cyan-500/15" : "bg-white/[0.02] group-hover:bg-cyan-500/5"
                  }`}>
                    <Icon className={`h-[18px] w-[18px] ${isActive ? "text-cyan-400" : "text-cyan-600 group-hover:text-cyan-400"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-mono font-medium ${isActive ? "text-cyan-100" : ""}`}>{item.label}</p>
                    <p className={`text-[10px] font-mono ${isActive ? "text-cyan-500" : "text-cyan-800"}`}>{item.desc}</p>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.5)] shrink-0" />}
                </button>
              );
            })}
          </nav>

          {/* User / Logout */}
          <div className="p-3 border-t border-cyan-900/20 space-y-2">
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-purple-500/5 border border-purple-900/20">
              <Shield className="h-4 w-4 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-mono text-purple-300 truncate">{qcName}</p>
                <p className="text-[10px] font-mono text-purple-600">Super Admin</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-mono text-red-400/60 hover:text-red-300 hover:bg-red-500/5 border border-transparent hover:border-red-900/20 transition-all"
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              {isLoggingOut ? "Keluar..." : "Logout"}
            </button>
          </div>
        </aside>

        {/* ====== Main Content ====== */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b border-cyan-900/20 bg-gray-950/90 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16">
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-1 rounded-xl border border-cyan-800/30 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all">
                  <Menu className="h-5 w-5 text-cyan-400" />
                </button>
                {/* Mobile logo */}
                <img src={wasteLogo} alt="" className="w-7 h-7 rounded-lg lg:hidden" />
                <div>
                  <h2 className="text-sm sm:text-base font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
                    {MENU_ITEMS.find(m => m.key === activePage)?.label || "Admin"}
                  </h2>
                  <p className="text-[10px] font-mono text-cyan-700 hidden sm:block">
                    {MENU_ITEMS.find(m => m.key === activePage)?.desc}
                  </p>
                </div>
              </div>
              <div className="lg:hidden flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/5 border border-purple-900/20">
                  <Shield className="h-3 w-3 text-purple-400" />
                  <span className="text-[10px] font-mono text-purple-300 max-w-[80px] truncate">{qcName}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-6 overflow-y-auto">
            <div className="max-w-5xl mx-auto">
              {activePage === "overview" && <OverviewPage onNavigate={handleNav} />}
              {activePage === "tenants" && <TenantsPage />}
              {activePage === "users" && <UsersPage />}
              {activePage === "personnel" && <PersonnelPage />}
              {activePage === "configs" && <ConfigsPage />}
              {activePage === "database" && <DatabasePage />}
              {activePage === "activity" && <ActivityLogPage />}
            </div>
          </main>

          {/* ====== Mobile Bottom Nav ====== */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-cyan-900/20 bg-gray-950/95 backdrop-blur-xl safe-area-bottom">
            <div className="flex items-stretch">
              {MOBILE_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNav(item.key)}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all ${isActive ? "text-cyan-300" : "text-cyan-700 active:text-cyan-400"}`}
                  >
                    <div className={`p-1 rounded-lg transition-all ${isActive ? "bg-cyan-500/10" : ""}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] font-mono font-medium">{item.shortLabel}</span>
                    {isActive && <div className="w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,255,255,0.6)]" />}
                  </button>
                );
              })}
              {/* More button */}
              <div className="flex-1 relative" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`w-full flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all ${MORE_NAV.some(m => m.key === activePage) ? "text-cyan-300" : "text-cyan-700 active:text-cyan-400"}`}
                >
                  <div className={`p-1 rounded-lg transition-all ${MORE_NAV.some(m => m.key === activePage) ? "bg-cyan-500/10" : ""}`}>
                    <MoreHorizontal className="h-5 w-5" />
                  </div>
                  <span className="text-[9px] font-mono font-medium">More</span>
                  {MORE_NAV.some(m => m.key === activePage) && <div className="w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,255,255,0.6)]" />}
                </button>
                {/* More popup */}
                {moreOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border border-cyan-900/30 bg-gray-900/95 backdrop-blur-xl shadow-xl overflow-hidden">
                    {MORE_NAV.map((item) => {
                      const Icon = item.icon;
                      const isActive = activePage === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => handleNav(item.key)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${isActive ? "bg-cyan-500/10 text-cyan-200" : "text-cyan-500 hover:bg-cyan-500/5"}`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="text-sm font-mono">{item.label}</span>
                        </button>
                      );
                    })}
                    {/* Logout in more menu */}
                    <div className="border-t border-cyan-900/20">
                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-400/70 hover:bg-red-500/5 transition-all"
                      >
                        {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                        <span className="text-sm font-mono">{isLoggingOut ? "Keluar..." : "Logout"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}


// ==========================================
// OVERVIEW PAGE
// ==========================================
function OverviewPage({ onNavigate }: { onNavigate: (key: PageKey) => void }) {
  const [stats, setStats] = useState({ tenants: 0, users: 0, configs: 0, tenantsWithDb: 0 });
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [td, ud, cd] = await Promise.all([
          api("/api/settings/tenants"),
          api("/api/settings/users"),
          api("/api/settings/configs"),
        ]);
        const tList = td.tenants || [];
        setTenants(tList);
        setStats({
          tenants: tList.length,
          users: (ud.users || []).length,
          configs: (cd.configs || []).length,
          tenantsWithDb: tList.filter((t: Tenant) => t.neon_database_url).length,
        });
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState />;

  const cards = [
    { label: "Store", value: stats.tenants, icon: Building2, color: "cyan" as const, sub: `${stats.tenantsWithDb} punya own DB`, page: "tenants" as PageKey },
    { label: "Users", value: stats.users, icon: UserCog, color: "blue" as const, sub: "Semua store", page: "users" as PageKey },
    { label: "Config", value: stats.configs, icon: KeyRound, color: "green" as const, sub: `dari ${stats.tenants} store`, page: "configs" as PageKey },
    { label: "DB Isolated", value: stats.tenantsWithDb, icon: Server, color: "purple" as const, sub: `dari ${stats.tenants} store`, page: "database" as PageKey },
  ];

  const colorStyles: Record<string, { card: string; icon: string; value: string }> = {
    cyan: { card: "border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent", icon: "text-cyan-400 bg-cyan-500/10", value: "text-cyan-200" },
    blue: { card: "border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent", icon: "text-blue-400 bg-blue-500/10", value: "text-blue-200" },
    green: { card: "border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent", icon: "text-green-400 bg-green-500/10", value: "text-green-200" },
    purple: { card: "border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent", icon: "text-purple-400 bg-purple-500/10", value: "text-purple-200" },
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/5 via-blue-500/3 to-purple-500/5 p-5 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
          Selamat datang, Admin! 👑
        </h2>
        <p className="text-xs sm:text-sm text-cyan-600 font-mono mt-1">
          Semua kontrol ada di tangan lo. Kelola store, user, dan konfigurasi dari sini.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const style = colorStyles[card.color];
          return (
            <button
              key={card.label}
              onClick={() => onNavigate(card.page)}
              className={`rounded-2xl border p-4 sm:p-5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${style.card}`}
            >
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-3 ${style.icon}`}>
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <p className={`text-2xl sm:text-3xl font-bold font-mono ${style.value}`}>{card.value}</p>
              <p className="text-xs font-mono mt-1 text-cyan-400">{card.label}</p>
              <p className="text-[10px] font-mono mt-0.5 text-cyan-700">{card.sub}</p>
            </button>
          );
        })}
      </div>

      {/* Store List */}
      <Card>
        <CardHeader action={
          <Btn variant="ghost" size="sm" onClick={() => onNavigate("tenants")}>
            Lihat Semua <ChevronRight className="h-3 w-3" />
          </Btn>
        }>
          <h3 className="text-sm font-mono font-bold text-cyan-300">Daftar Store</h3>
        </CardHeader>
        <div className="divide-y divide-cyan-900/15">
          {tenants.map((t) => (
            <div key={t.id} className="px-4 sm:px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.status === "active" ? "bg-green-400 shadow-[0_0_6px_rgba(0,255,128,0.5)]" : "bg-red-400"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-mono text-cyan-200 truncate">{t.name}</p>
                  <p className="text-[10px] font-mono text-cyan-700 truncate">{t.address || "Alamat belum diisi"}</p>
                </div>
              </div>
              <Badge variant={t.neon_database_url ? "purple" : "warning"}>
                {t.neon_database_url ? "Own DB" : "Master"}
              </Badge>
            </div>
          ))}
          {tenants.length === 0 && (
            <div className="px-4 py-10 text-center text-sm font-mono text-cyan-700">Belum ada store</div>
          )}
        </div>
      </Card>
    </div>
  );
}


// ==========================================
// TENANTS PAGE
// ==========================================
function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", status: "active", neon_database_url: "" });
  const [saving, setSaving] = useState(false);

  const loadTenants = async () => { setLoading(true); const data = await api("/api/settings/tenants"); setTenants(data.tenants || []); setLoading(false); };
  useEffect(() => { loadTenants(); }, []);

  const handleSave = async () => {
    setSaving(true);
    if (editingId) {
      await api("/api/settings/tenants", "PUT", { id: editingId, ...form });
    } else {
      const autoId = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      await api("/api/settings/tenants", "POST", { id: autoId, ...form });
    }
    setSaving(false); setShowForm(false); setEditingId(null);
    setForm({ name: "", address: "", phone: "", status: "active", neon_database_url: "" });
    loadTenants();
  };

  const handleEdit = (t: Tenant) => {
    setEditingId(t.id);
    setForm({ name: t.name, address: t.address || "", phone: t.phone || "", status: t.status, neon_database_url: t.neon_database_url || "" });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin mau hapus store ini?")) return;
    await api(`/api/settings/tenants?id=${id}`, "DELETE");
    loadTenants();
  };

  const openNewForm = () => {
    setShowForm(true); setEditingId(null);
    setForm({ name: "", address: "", phone: "", status: "active", neon_database_url: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-mono text-cyan-500">{tenants.length} Store</p>
        <div className="flex gap-2">
          <RefreshBtn onClick={loadTenants} />
          <Btn onClick={openNewForm}><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Tambah Store</span><span className="sm:hidden">Tambah</span></Btn>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-mono font-bold text-cyan-300">{editingId ? "Edit Store" : "Tambah Store Baru"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nama Store" value={form.name} onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} placeholder="GCK Bekasi Kp Bulu" />
            <Input label="Alamat" value={form.address} onChange={(e) => setForm({ ...form, address: (e.target as HTMLInputElement).value })} placeholder="Jl. Raya Bekasi No. 123" />
            <Input label="No. Telp" value={form.phone} onChange={(e) => setForm({ ...form, phone: (e.target as HTMLInputElement).value })} placeholder="08123456789" />
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: (e.target as HTMLSelectElement).value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <Input
            label="🗄️ Neon Database URL"
            value={form.neon_database_url}
            onChange={(e) => setForm({ ...form, neon_database_url: (e.target as HTMLInputElement).value })}
            placeholder="postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require"
            hint="Kosongkan jika masih pakai master DB"
          />
          <div className="flex gap-2 pt-1">
            <Btn onClick={handleSave} disabled={saving || !form.name} variant="primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Menyimpan..." : "Simpan"}
            </Btn>
            <Btn variant="secondary" onClick={() => { setShowForm(false); setEditingId(null); }}><X className="h-4 w-4" /> Batal</Btn>
          </div>
        </Card>
      )}

      {/* List */}
      {loading ? <LoadingState /> : tenants.length === 0 ? (
        <EmptyState icon={Store} text="Belum ada store. Tambahin dulu yuk!" />
      ) : (
        <>
          {/* Desktop: Table */}
          <Card className="hidden sm:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-cyan-900/20 bg-cyan-500/[0.03]">
                    <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">NAMA</th>
                    <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">ALAMAT</th>
                    <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">DB</th>
                    <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">STATUS</th>
                    <th className="text-right px-5 py-3 text-cyan-500 text-[11px] font-medium">AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-b border-cyan-900/10 hover:bg-white/[0.01] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-cyan-200 font-medium">{t.name}</p>
                        <p className="text-[10px] text-cyan-700">{t.id}</p>
                      </td>
                      <td className="px-5 py-3.5 text-cyan-400 text-xs">{t.address || "—"}</td>
                      <td className="px-5 py-3.5"><Badge variant={t.neon_database_url ? "purple" : "warning"}>{t.neon_database_url ? "Own DB" : "Master"}</Badge></td>
                      <td className="px-5 py-3.5"><Badge variant={t.status === "active" ? "success" : "danger"}>{t.status}</Badge></td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => handleEdit(t)} className="p-2 rounded-lg border border-cyan-800/30 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all">
                            <Pencil className="h-3.5 w-3.5 text-cyan-400" />
                          </button>
                          <button onClick={() => handleDelete(t.id)} className="p-2 rounded-lg border border-red-800/30 hover:border-red-500/40 hover:bg-red-500/5 transition-all">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile: Cards */}
          <div className="sm:hidden space-y-3">
            {tenants.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === "active" ? "bg-green-400" : "bg-red-400"}`} />
                      <p className="text-sm font-mono text-cyan-200 font-medium truncate">{t.name}</p>
                    </div>
                    {t.address && <p className="text-[11px] font-mono text-cyan-600 mb-2 truncate">{t.address}</p>}
                    <div className="flex gap-2">
                      <Badge variant={t.neon_database_url ? "purple" : "warning"}>{t.neon_database_url ? "Own DB" : "Master"}</Badge>
                      <Badge variant={t.status === "active" ? "success" : "danger"}>{t.status}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => handleEdit(t)} className="p-2 rounded-lg border border-cyan-800/30 hover:border-cyan-500/40 transition-all">
                      <Pencil className="h-3.5 w-3.5 text-cyan-400" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-2 rounded-lg border border-red-800/30 hover:border-red-500/40 transition-all">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


// ==========================================
// USERS PAGE
// ==========================================
function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ tenant_id: "", username: "", password: "", role: "admin" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [ud, td] = await Promise.all([api("/api/settings/users"), api("/api/settings/tenants")]);
    setUsers(ud.users || []); setTenants(td.tenants || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const getTenantName = (tid: string) => {
    if (tid === "ALL") return "Semua Store";
    return tenants.find((t) => t.id === tid)?.name || tid;
  };

  const handleSave = async () => {
    setSaving(true);
    if (editingId) {
      const payload: any = { id: editingId, tenant_id: form.tenant_id, username: form.username, role: form.role };
      if (form.password) payload.password = form.password;
      await api("/api/settings/users", "PUT", payload);
    } else {
      await api("/api/settings/users", "POST", form);
    }
    setSaving(false); setShowForm(false); setEditingId(null);
    setForm({ tenant_id: "", username: "", password: "", role: "admin" });
    load();
  };

  const handleEdit = (u: UserItem) => {
    setEditingId(u.id);
    setForm({ tenant_id: u.tenant_id, username: u.username, password: "", role: u.role });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin mau hapus user ini?")) return;
    await api(`/api/settings/users?id=${id}`, "DELETE");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-mono text-cyan-500">{users.length} User</p>
        <div className="flex gap-2">
          <RefreshBtn onClick={load} />
          <Btn onClick={() => { setShowForm(true); setEditingId(null); setForm({ tenant_id: "", username: "", password: "", role: "admin" }); }}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Tambah User</span><span className="sm:hidden">Tambah</span>
          </Btn>
        </div>
      </div>

      {showForm && (
        <Card className="p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-mono font-bold text-cyan-300">{editingId ? "Edit User" : "Tambah User Baru"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: (e.target as HTMLInputElement).value })} placeholder="johndoe" />
            <Input label={editingId ? "Password (kosongkan = tetap)" : "Password"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: (e.target as HTMLInputElement).value })} placeholder="••••••••" />
            <Select label="Store" value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: (e.target as HTMLSelectElement).value })}>
              <option value="">— Pilih Resto —</option>
              <option value="ALL">Semua Resto (Super Admin)</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: (e.target as HTMLSelectElement).value })}>
              <option value="admin">🔍 QC / Quality Control</option>
              <option value="super_admin">👑 Super Admin</option>
            </Select>
          </div>
          <div className="flex gap-2 pt-1">
            <Btn onClick={handleSave} disabled={saving || !form.username || (!editingId && !form.password) || !form.tenant_id}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Menyimpan..." : "Simpan"}
            </Btn>
            <Btn variant="secondary" onClick={() => { setShowForm(false); setEditingId(null); }}><X className="h-4 w-4" /> Batal</Btn>
          </div>
        </Card>
      )}

      {loading ? <LoadingState /> : users.length === 0 ? (
        <EmptyState icon={Users} text="Belum ada user." />
      ) : (
        <>
          {/* Desktop: Table */}
          <Card className="hidden sm:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-cyan-900/20 bg-cyan-500/[0.03]">
                    <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">USERNAME</th>
                    <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">RESTO</th>
                    <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">ROLE</th>
                    <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">DIBUAT</th>
                    <th className="text-right px-5 py-3 text-cyan-500 text-[11px] font-medium">AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-cyan-900/10 hover:bg-white/[0.01] transition-colors">
                      <td className="px-5 py-3.5 text-cyan-200 font-medium">{u.username}</td>
                      <td className="px-5 py-3.5 text-cyan-400 text-xs">{getTenantName(u.tenant_id)}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={u.role === "super_admin" ? "purple" : "blue"}>
                          {u.role === "super_admin" ? "👑 Super Admin" : "🔍 QC"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-cyan-600 text-xs">{new Date(u.created_at).toLocaleDateString("id-ID")}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => handleEdit(u)} className="p-2 rounded-lg border border-cyan-800/30 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all">
                            <Pencil className="h-3.5 w-3.5 text-cyan-400" />
                          </button>
                          <button onClick={() => handleDelete(u.id)} className="p-2 rounded-lg border border-red-800/30 hover:border-red-500/40 hover:bg-red-500/5 transition-all">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile: Cards */}
          <div className="sm:hidden space-y-3">
            {users.map((u) => (
              <Card key={u.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono text-cyan-200 font-medium">{u.username}</p>
                    <p className="text-[11px] font-mono text-cyan-600 mt-0.5 truncate">{getTenantName(u.tenant_id)}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant={u.role === "super_admin" ? "purple" : "blue"}>
                        {u.role === "super_admin" ? "👑 Super Admin" : "🔍 QC"}
                      </Badge>
                      <span className="text-[10px] font-mono text-cyan-700 self-center">{new Date(u.created_at).toLocaleDateString("id-ID")}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => handleEdit(u)} className="p-2 rounded-lg border border-cyan-800/30 transition-all">
                      <Pencil className="h-3.5 w-3.5 text-cyan-400" />
                    </button>
                    <button onClick={() => handleDelete(u.id)} className="p-2 rounded-lg border border-red-800/30 transition-all">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


// ==========================================
// PERSONNEL PAGE
// ==========================================
function PersonnelPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", full_name: "", role: "qc", signature_url: "", status: "active" });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "qc" | "manager">("all");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const load = async () => { setLoading(true); const td = await api("/api/settings/tenants"); setTenants(td.tenants || []); setLoading(false); };
  const loadPersonnel = async (tid: string) => {
    if (!tid) { setPersonnel([]); return; }
    const data = await api(`/api/settings/personnel?tenant_id=${tid}`);
    setPersonnel(data.personnel || []);
  };
  useEffect(() => { load(); }, []);

  const handleSelectTenant = (tid: string) => { setSelectedTenant(tid); setShowForm(false); setEditingId(null); loadPersonnel(tid); };

  const handleSave = async () => {
    if (!selectedTenant) return;
    setSaving(true);
    if (editingId) { await api(`/api/settings/personnel?id=${editingId}`, "PUT", form); }
    else { await api("/api/settings/personnel", "POST", { tenant_id: selectedTenant, ...form }); }
    setSaving(false); setShowForm(false); setEditingId(null);
    setForm({ name: "", full_name: "", role: "qc", signature_url: "", status: "active" });
    loadPersonnel(selectedTenant);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTenant) return;
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await api("/api/settings/configs", "POST", {
          action: "upload-signature", tenant_id: selectedTenant,
          file_base64: base64, file_name: file.name, mime_type: file.type,
        });
        if (result.signature_url) setForm((prev) => ({ ...prev, signature_url: result.signature_url }));
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch { setUploading(false); }
  };

  const handleEdit = (p: Personnel) => {
    setEditingId(p.id);
    setForm({ name: p.name, full_name: p.full_name || "", role: p.role, signature_url: p.signature_url || "", status: p.status });
    setPreviewUrl(""); setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin mau hapus personil ini?")) return;
    await api(`/api/settings/personnel?id=${id}`, "DELETE");
    loadPersonnel(selectedTenant);
  };

  const filtered = filter === "all" ? personnel : personnel.filter((p) => p.role === filter);
  const qcCount = personnel.filter((p) => p.role === "qc").length;
  const mgrCount = personnel.filter((p) => p.role === "manager").length;

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <p className="text-sm font-mono text-cyan-500">QC & Manajer per Store</p>

      {tenants.length === 0 ? (
        <EmptyState icon={UserCheck} text="Bikin store dulu di halaman Store" />
      ) : (
        <>
          <Card className="p-4 sm:p-5">
            <Select label="Pilih Store" value={selectedTenant} onChange={(e) => handleSelectTenant((e.target as HTMLSelectElement).value)}>
              <option value="">— Pilih store dulu —</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Card>

          {selectedTenant && (
            <>
              {/* Filters + Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                  {([["all", `Semua (${personnel.length})`, "default"], ["qc", `🔍 QC (${qcCount})`, "success"], ["manager", `👔 Manajer (${mgrCount})`, "purple"]] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setFilter(key as any)}
                      className={`shrink-0 px-3 py-2 rounded-xl font-mono text-xs transition-all border ${filter === key ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200" : "border-cyan-800/30 text-cyan-600 hover:text-cyan-400"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 shrink-0">
                  <RefreshBtn onClick={() => loadPersonnel(selectedTenant)} />
                  <Btn onClick={() => { setShowForm(true); setEditingId(null); setPreviewUrl(""); setForm({ name: "", full_name: "", role: "qc", signature_url: "", status: "active" }); }}>
                    <Plus className="h-4 w-4" /> Tambah
                  </Btn>
                </div>
              </div>

              {/* Form */}
              {showForm && (
                <Card className="p-4 sm:p-5 space-y-4">
                  <h3 className="text-sm font-mono font-bold text-cyan-300">{editingId ? "Edit Personil" : "Tambah Personil Baru"}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Nama Singkat (key)" value={form.name} onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} placeholder="PAJAR" hint="Nama pendek, huruf kapital" />
                    <Input label="Nama Lengkap" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: (e.target as HTMLInputElement).value })} placeholder="PAJAR HIDAYAT" />
                    <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: (e.target as HTMLSelectElement).value })}>
                      <option value="qc">🔍 QC</option>
                      <option value="manager">👔 Manajer</option>
                    </Select>
                    <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: (e.target as HTMLSelectElement).value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </Select>
                  </div>

                  {/* Signature Upload */}
                  <div>
                    <label className="block text-[11px] font-mono text-cyan-500 mb-2">Upload TTD / Tanda Tangan</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${uploading ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" : "border-cyan-800/30 bg-black/20 text-cyan-400 hover:border-cyan-500/40"}`}>
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        <span className="font-mono text-sm">{uploading ? "Uploading..." : "Pilih File"}</span>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                      </label>
                      {(previewUrl || form.signature_url) && (
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-12 rounded-lg border border-cyan-900/30 bg-white/5 overflow-hidden flex items-center justify-center">
                            <img src={previewUrl || `/api/proxy-image?url=${encodeURIComponent(form.signature_url)}&tenant_id=${selectedTenant}`}
                              alt="TTD" className="w-full h-full object-contain p-1"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          </div>
                          <p className="text-[11px] font-mono text-green-400">✅ TTD Ready</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-cyan-700 mt-1.5">Upload gambar TTD (JPG/PNG). Otomatis ke R2 bucket.</p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Btn onClick={handleSave} disabled={saving || !form.name || !form.role}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Menyimpan..." : "Simpan"}
                    </Btn>
                    <Btn variant="secondary" onClick={() => { setShowForm(false); setEditingId(null); }}><X className="h-4 w-4" /> Batal</Btn>
                  </div>
                </Card>
              )}

              {/* Personnel List */}
              {filtered.length === 0 ? (
                <EmptyState icon={UserCheck} text={personnel.length === 0 ? "Belum ada personil. Tambahin dulu!" : "Ga ada data untuk filter ini"} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map((p) => (
                    <Card key={p.id} className="p-4 hover:border-cyan-700/30 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Signature thumbnail */}
                          <div className="w-14 h-11 rounded-lg border border-cyan-800/20 bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                            {p.signature_url ? (
                              <img src={`/api/proxy-image?url=${encodeURIComponent(p.signature_url)}&tenant_id=${selectedTenant}`}
                                alt="TTD" className="w-full h-full object-contain p-0.5"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <span className="text-[9px] font-mono text-cyan-800">No TTD</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-mono text-cyan-200 font-medium truncate">{p.full_name || p.name}</p>
                            <p className="text-[10px] font-mono text-cyan-700">key: {p.name}</p>
                            <div className="flex gap-1.5 mt-1.5">
                              <Badge variant={p.role === "qc" ? "success" : "purple"}>{p.role === "qc" ? "🔍 QC" : "👔 MGR"}</Badge>
                              <Badge variant={p.status === "active" ? "default" : "danger"}>{p.status}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => handleEdit(p)} className="p-2 rounded-lg border border-cyan-800/30 hover:border-cyan-500/40 transition-all">
                            <Pencil className="h-3.5 w-3.5 text-cyan-400" />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg border border-red-800/30 hover:border-red-500/40 transition-all">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}


// ==========================================
// CONFIGS PAGE
// ==========================================
function ConfigsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [configs, setConfigs] = useState<TenantConfig[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    google_spreadsheet_id: "", google_sheets_credentials: "",
    r2_account_id: "", r2_access_key_id: "", r2_secret_access_key: "", r2_bucket_name: "", r2_public_url: "",
  });

  const load = async () => {
    setLoading(true);
    const [td, cd] = await Promise.all([api("/api/settings/tenants"), api("/api/settings/configs")]);
    setTenants(td.tenants || []); setConfigs(cd.configs || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSelectTenant = (tid: string) => {
    setSelectedTenant(tid);
    const existing = configs.find((c) => c.tenant_id === tid);
    if (existing) {
      setForm({
        google_spreadsheet_id: existing.google_spreadsheet_id || "", google_sheets_credentials: existing.google_sheets_credentials || "",
        r2_account_id: existing.r2_account_id || "", r2_access_key_id: existing.r2_access_key_id || "",
        r2_secret_access_key: existing.r2_secret_access_key || "", r2_bucket_name: existing.r2_bucket_name || "", r2_public_url: existing.r2_public_url || "",
      });
    } else {
      setForm({ google_spreadsheet_id: "", google_sheets_credentials: "", r2_account_id: "", r2_access_key_id: "", r2_secret_access_key: "", r2_bucket_name: "", r2_public_url: "" });
    }
  };

  const handleSave = async () => {
    if (!selectedTenant) return;
    setSaving(true);
    await api("/api/settings/configs", "POST", { tenant_id: selectedTenant, ...form });
    await load(); setSaving(false);
  };

  const toggleSecret = (key: string) => setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));

  const configSections = [
    {
      title: "📊 Google Sheets",
      desc: "Konfigurasi Google Sheets untuk penyimpanan data waste",
      fields: [
        { key: "google_spreadsheet_id", label: "Spreadsheet ID", placeholder: "1ABC...xyz", secret: false, hint: "ID dari Google Sheet khusus store ini" },
        { key: "google_sheets_credentials", label: "Service Account JSON", placeholder: "{...service account JSON...}", secret: true, hint: "Service Account JSON buat akses Google Sheets" },
      ]
    },
    {
      title: "☁️ Cloudflare R2",
      desc: "Konfigurasi R2 untuk penyimpanan foto & tanda tangan",
      fields: [
        { key: "r2_account_id", label: "Account ID", placeholder: "abc123...", secret: true, hint: "Cloudflare Account ID" },
        { key: "r2_access_key_id", label: "Access Key ID", placeholder: "abc123...", secret: true, hint: "R2 API Token Access Key" },
        { key: "r2_secret_access_key", label: "Secret Access Key", placeholder: "abc123...", secret: true, hint: "R2 API Token Secret" },
        { key: "r2_bucket_name", label: "Bucket Name", placeholder: "ba-waste", secret: false, hint: "Nama bucket R2" },
        { key: "r2_public_url", label: "Public URL", placeholder: "https://pub-xxx.r2.dev", secret: false, hint: "URL publik bucket R2" },
      ]
    }
  ];

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-mono text-cyan-500">Konfigurasi per-Store</p>
        <RefreshBtn onClick={load} />
      </div>

      {tenants.length === 0 ? (
        <EmptyState icon={Database} text="Bikin store dulu, baru bisa isi config" />
      ) : (
        <>
          <Card className="p-4 sm:p-5">
            <Select label="Pilih Store" value={selectedTenant} onChange={(e) => handleSelectTenant((e.target as HTMLSelectElement).value)}>
              <option value="">— Pilih store dulu —</option>
              {tenants.map((t) => {
                const hasConfig = configs.some((c) => c.tenant_id === t.id);
                return <option key={t.id} value={t.id}>{t.name} {hasConfig ? "✅" : "⚠️ belum"}</option>;
              })}
            </Select>
          </Card>

          {selectedTenant && (
            <div className="space-y-4">
              {configSections.map((section) => (
                <Card key={section.title} className="overflow-hidden">
                  <CardHeader>
                    <h3 className="text-sm font-mono font-bold text-cyan-300">{section.title}</h3>
                    <p className="text-[10px] font-mono text-cyan-700 mt-0.5">{section.desc}</p>
                  </CardHeader>
                  <div className="p-4 sm:p-5 space-y-4">
                    {section.fields.map((field) => (
                      <div key={field.key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-mono text-cyan-500">{field.label}</label>
                          {field.secret && (
                            <button onClick={() => toggleSecret(field.key)} className="text-[10px] font-mono text-cyan-600 hover:text-cyan-400 flex items-center gap-1">
                              {showSecrets[field.key] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              {showSecrets[field.key] ? "Hide" : "Show"}
                            </button>
                          )}
                        </div>
                        <input
                          type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                          value={(form as any)[field.key]}
                          onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                          className="w-full h-11 px-3.5 bg-black/30 border border-cyan-900/40 rounded-xl font-mono text-sm text-cyan-100 placeholder:text-cyan-800 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all"
                          placeholder={field.placeholder}
                        />
                        {field.hint && <p className="text-[10px] font-mono text-cyan-700 mt-1">{field.hint}</p>}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}

              <Btn onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Menyimpan..." : "Simpan Config"}
              </Btn>
            </div>
          )}

          {/* Config overview when no tenant selected */}
          {!selectedTenant && configs.length > 0 && (
            <>
              {/* Desktop: Table */}
              <Card className="hidden sm:block overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-mono">
                    <thead>
                      <tr className="border-b border-cyan-900/20 bg-cyan-500/[0.03]">
                        <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">RESTO</th>
                        <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">SHEET ID</th>
                        <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">R2 BUCKET</th>
                        <th className="text-left px-5 py-3 text-cyan-500 text-[11px] font-medium">UPDATED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configs.map((c) => {
                        const tenant = tenants.find((t) => t.id === c.tenant_id);
                        return (
                          <tr key={c.tenant_id} onClick={() => handleSelectTenant(c.tenant_id)}
                            className="border-b border-cyan-900/10 hover:bg-white/[0.01] cursor-pointer transition-colors">
                            <td className="px-5 py-3.5 text-cyan-200 font-medium">{tenant?.name || c.tenant_id}</td>
                            <td className="px-5 py-3.5 text-cyan-400 text-xs">{c.google_spreadsheet_id ? c.google_spreadsheet_id.substring(0, 15) + "..." : "—"}</td>
                            <td className="px-5 py-3.5 text-cyan-400 text-xs">{c.r2_bucket_name || "—"}</td>
                            <td className="px-5 py-3.5 text-cyan-600 text-xs">{c.updated_at ? new Date(c.updated_at).toLocaleDateString("id-ID") : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Mobile: Cards */}
              <div className="sm:hidden space-y-3">
                {configs.map((c) => {
                  const tenant = tenants.find((t) => t.id === c.tenant_id);
                  return (
                    <Card key={c.tenant_id} className="p-4 active:bg-cyan-500/5" onClick={() => handleSelectTenant(c.tenant_id)}>
                      <p className="text-sm font-mono text-cyan-200 font-medium">{tenant?.name || c.tenant_id}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] font-mono text-cyan-600">
                        <span>Sheet: {c.google_spreadsheet_id ? "✅" : "❌"}</span>
                        <span>R2: {c.r2_bucket_name ? "✅" : "❌"}</span>
                        {c.updated_at && <span>{new Date(c.updated_at).toLocaleDateString("id-ID")}</span>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}


// ==========================================
// DATABASE PAGE
// ==========================================
function DatabasePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      const td = await api("/api/settings/tenants");
      setTenants(td.tenants || []);
      setLoading(false);
    })();
  }, []);

  const handleSeedTenantDb = async () => {
    if (!selectedTenant) return;
    const tenant = tenants.find(t => t.id === selectedTenant);
    if (!tenant?.neon_database_url) {
      setSeedResult({ ok: false, message: "Store ini belum punya Neon Database URL. Isi dulu di halaman Store." });
      return;
    }
    if (!confirm(`Seed database untuk ${tenant.name}? Ini akan bikin tabel users, personnel, tenant_configs di database tenant.`)) return;
    setSeeding(true); setSeedResult(null);
    try {
      const result = await api("/api/settings/configs", "POST", { action: "seed-tenant-db", tenant_id: selectedTenant });
      setSeedResult(result);
    } catch (err: any) {
      setSeedResult({ ok: false, message: err.message });
    }
    setSeeding(false);
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-5">
      {/* Info Banner */}
      <div className="rounded-2xl border border-purple-500/15 bg-gradient-to-br from-purple-500/5 via-blue-500/3 to-transparent p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Server className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-blue-400">Database Management</h3>
            <p className="text-[11px] text-cyan-600 font-mono">Seed database untuk store baru</p>
          </div>
        </div>
      </div>

      {/* Seed Section */}
      <Card className="overflow-hidden">
        <CardHeader>
          <h4 className="text-sm font-mono font-bold text-cyan-300">Seed Tenant Database</h4>
          <p className="text-[10px] font-mono text-cyan-700 mt-0.5">Bikin tabel (users, personnel, tenant_configs) di database baru</p>
        </CardHeader>
        <div className="p-4 sm:p-5 space-y-4">
          <Select label="Pilih Store" value={selectedTenant} onChange={(e) => { setSelectedTenant((e.target as HTMLSelectElement).value); setSeedResult(null); }}>
            <option value="">— Pilih store —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name} {t.neon_database_url ? "🗄️" : "📦 (no own DB)"}</option>
            ))}
          </Select>

          {selectedTenant && (() => {
            const tenant = tenants.find(t => t.id === selectedTenant);
            return tenant ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-cyan-900/20 bg-black/20 p-3.5">
                  <p className="text-xs font-mono text-cyan-300">📍 {tenant.name}</p>
                  <p className="text-[11px] font-mono text-cyan-600 mt-0.5">
                    DB: {tenant.neon_database_url ? (
                      <span className="text-purple-300">🗄️ Own Database</span>
                    ) : (
                      <span className="text-yellow-300">📦 Master (belum ada own DB)</span>
                    )}
                  </p>
                </div>

                <Btn variant="purple" onClick={handleSeedTenantDb} disabled={seeding || !selectedTenant}>
                  {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {seeding ? "Seeding..." : "Seed Tenant DB"}
                </Btn>

                {seedResult && (
                  <div className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm font-mono ${seedResult.ok ? "bg-green-500/10 border border-green-500/15 text-green-400" : "bg-red-500/10 border border-red-500/15 text-red-400"}`}>
                    {seedResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                    <p className="text-xs">{seedResult.message}</p>
                  </div>
                )}
              </div>
            ) : null;
          })()}
        </div>
      </Card>

      {/* DB Status Overview */}
      <Card className="overflow-hidden">
        <CardHeader>
          <h4 className="text-sm font-mono font-bold text-cyan-300">Status per Store</h4>
        </CardHeader>
        <div className="divide-y divide-cyan-900/15">
          {tenants.map((t) => (
            <div key={t.id} className="px-4 sm:px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.neon_database_url ? "bg-purple-500/10 border border-purple-500/20" : "bg-yellow-500/10 border border-yellow-500/20"}`}>
                  <Server className={`h-4 w-4 ${t.neon_database_url ? "text-purple-400" : "text-yellow-400"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-mono text-cyan-200 truncate">{t.name}</p>
                  <p className="text-[10px] font-mono text-cyan-700">{t.id}</p>
                </div>
              </div>
              <Badge variant={t.neon_database_url ? "purple" : "warning"}>
                {t.neon_database_url ? "Isolated" : "Master"}
              </Badge>
            </div>
          ))}
          {tenants.length === 0 && (
            <div className="px-4 py-10 text-center text-sm font-mono text-cyan-700">Belum ada store</div>
          )}
        </div>
      </Card>

      {/* Tips */}
      <Card className="p-4 sm:p-5">
        <p className="text-xs font-mono text-cyan-500 font-bold mb-2">💡 Tips</p>
        <ul className="space-y-1.5 text-[11px] font-mono text-cyan-600">
          <li>• Bikin Neon project baru di <a href="https://neon.tech" target="_blank" className="text-purple-400 hover:underline">neon.tech</a> (gratis!)</li>
          <li>• Copy connection string → paste di halaman Store → Neon Database URL</li>
          <li>• Balik ke sini → pilih store → klik "Seed Tenant DB"</li>
          <li>• Pastikan pakai <code className="text-cyan-400 bg-cyan-500/5 px-1 rounded">?sslmode=require</code></li>
        </ul>
      </Card>
    </div>
  );
}

// ===== Activity Log Page =====
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
  SUBMIT_WASTE: { icon: FileText, color: "text-cyan-400", label: "Submit Waste" },
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

function ActivityLogPage() {
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
      const data = await api(`/api/activity-log?${params}`);
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

  const getActionConfig = (action: string) => ACTION_CONFIG[action] || { icon: Activity, color: "text-cyan-500", label: action };
  
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold font-mono text-cyan-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400" />
            Activity Log
          </h2>
          <p className="text-xs font-mono text-cyan-600 mt-0.5">
            Riwayat semua aktivitas sistem • {total} total log
          </p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Btn>
          <Btn variant="primary" size="sm" onClick={() => fetchLogs(1)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Btn>
        </div>
      </div>

      {/* Search */}
      <Card>
        <div className="p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cari username, action, atau store..."
              className="w-full h-11 pl-10 pr-4 bg-black/30 border border-cyan-900/40 rounded-xl font-mono text-sm text-cyan-100 placeholder:text-cyan-800 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all"
            />
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-cyan-900/20 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-cyan-600 mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 px-2.5 bg-black/30 border border-cyan-900/40 rounded-lg font-mono text-xs text-cyan-100 focus:border-cyan-500/60 focus:outline-none appearance-none"
                >
                  {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-gray-950">{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-cyan-600 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-9 px-2.5 bg-black/30 border border-cyan-900/40 rounded-lg font-mono text-xs text-cyan-100 focus:border-cyan-500/60 focus:outline-none appearance-none"
                >
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-gray-950">{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-cyan-600 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full h-9 px-2.5 bg-black/30 border border-cyan-900/40 rounded-lg font-mono text-xs text-cyan-100 focus:border-cyan-500/60 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-cyan-600 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full h-9 px-2.5 bg-black/30 border border-cyan-900/40 rounded-lg font-mono text-xs text-cyan-100 focus:border-cyan-500/60 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Log List */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
            <span className="text-sm font-mono text-cyan-500">Memuat activity log...</span>
          </div>
        ) : logs.length === 0 ? (
          <EmptyState icon={Activity} text="Belum ada activity log" />
        ) : (
          <div className="divide-y divide-cyan-900/15">
            {logs.map((log) => {
              const cfg = getActionConfig(log.action);
              const Icon = cfg.icon;
              const isExpanded = expandedId === log.id;
              return (
                <div
                  key={log.id}
                  className="px-4 py-3 sm:px-5 hover:bg-cyan-500/[0.02] transition-colors cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg border border-cyan-900/30 flex items-center justify-center ${
                      log.status === "failed" ? "bg-red-500/10" : log.status === "warning" ? "bg-yellow-500/10" : "bg-cyan-500/5"
                    }`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-medium text-cyan-100">{cfg.label}</span>
                        <Badge variant={getStatusBadge(log.status)}>{log.status}</Badge>
                        <Badge variant="default">{log.category}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {log.username && (
                          <span className="text-xs font-mono text-cyan-400 flex items-center gap-1">
                            <UserCog className="h-3 w-3" />
                            {log.username}
                          </span>
                        )}
                        {log.tenant_name && (
                          <span className="text-xs font-mono text-purple-400 flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {log.tenant_name}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-cyan-700 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(log.created_at)}
                        </span>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-3 p-3 rounded-lg bg-black/30 border border-cyan-900/20 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                            <div>
                              <span className="text-cyan-700">IP Address: </span>
                              <span className="text-cyan-300 flex items-center gap-1 inline-flex">
                                <Globe className="h-3 w-3" />
                                {log.ip_address || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-cyan-700">Device: </span>
                              <span className="text-cyan-300 flex items-center gap-1 inline-flex">
                                <Monitor className="h-3 w-3" />
                                {getDeviceInfo(log.user_agent)} • {getBrowserInfo(log.user_agent)}
                              </span>
                            </div>
                            <div>
                              <span className="text-cyan-700">Tenant ID: </span>
                              <span className="text-cyan-300">{log.tenant_id || "—"}</span>
                            </div>
                            <div>
                              <span className="text-cyan-700">User ID: </span>
                              <span className="text-cyan-300">{log.user_id ?? "—"}</span>
                            </div>
                            <div>
                              <span className="text-cyan-700">Waktu: </span>
                              <span className="text-cyan-300">{new Date(log.created_at).toLocaleString("id-ID")}</span>
                            </div>
                          </div>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div>
                              <span className="text-[10px] font-mono text-cyan-700 block mb-1">Detail:</span>
                              <pre className="text-[11px] font-mono text-cyan-400 bg-black/40 rounded-md p-2 overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expand indicator */}
                    <ChevronRight className={`h-4 w-4 text-cyan-700 flex-shrink-0 mt-1 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 sm:px-5 border-t border-cyan-900/20 flex items-center justify-between">
            <span className="text-xs font-mono text-cyan-600">
              Hal {page}/{totalPages} • {total} log
            </span>
            <div className="flex gap-2">
              <Btn
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => fetchLogs(page - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Btn>
              <Btn
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => fetchLogs(page + 1)}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
