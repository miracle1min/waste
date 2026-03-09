import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Store, Users, Database, UserCheck, HardDrive, LayoutDashboard,
  Plus, Pencil, Trash2, Save, X, Loader2, Eye, EyeOff, RefreshCw,
  Shield, CheckCircle, AlertCircle, Zap, Upload, LogOut, Menu, ChevronLeft,
  Building2, UserCog, KeyRound, Server
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

// ===== Menu Items =====
type PageKey = "overview" | "tenants" | "users" | "personnel" | "configs" | "database";
const MENU_ITEMS: { key: PageKey; label: string; icon: any; desc: string }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, desc: "Ringkasan sistem" },
  { key: "tenants", label: "Store", icon: Building2, desc: "Kelola resto/store" },
  { key: "users", label: "Users", icon: UserCog, desc: "Manajemen user" },
  { key: "personnel", label: "QC & Manager", icon: UserCheck, desc: "Personil & TTD" },
  { key: "configs", label: "Config", icon: KeyRound, desc: "Env & kredensial" },
  { key: "database", label: "Database", icon: Server, desc: "DB management" },
];

// ===== Main Admin Panel =====
export default function AdminPanel() {
  const { qcName, logout, isLoggingOut } = useAuth();
  const [activePage, setActivePage] = useState<PageKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setTimeout(() => window.location.reload(), 800);
  };

  const handleNav = (key: PageKey) => {
    setActivePage(key);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-cyan-100 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-[hsl(220,50%,6%)] border-r border-cyan-900/30 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Logo */}
        <div className="p-4 border-b border-cyan-900/30">
          <div className="flex items-center gap-3">
            <img src={wasteLogo} alt="AWAS" className="w-10 h-10 rounded-lg" />
            <div>
              <h1 className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">AWAS</h1>
              <p className="text-[10px] text-slate-600 font-mono">Control Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group ${
                  isActive
                    ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-200"
                    : "border border-transparent text-cyan-600 hover:text-cyan-300 hover:bg-cyan-500/5"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? "text-cyan-400" : "text-cyan-700 group-hover:text-cyan-400"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-mono font-medium truncate">{item.label}</p>
                  <p className={`text-[10px] font-mono truncate ${isActive ? "text-cyan-500" : "text-cyan-800"}`}>{item.desc}</p>
                </div>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,255,255,0.6)]" />}
              </button>
            );
          })}
        </nav>

        {/* User / Logout */}
        <div className="p-3 border-t border-cyan-900/30 space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/5 border border-purple-900/30">
            <Shield className="h-4 w-4 text-purple-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-mono text-purple-300 truncate">{qcName}</p>
              <p className="text-[10px] font-mono text-purple-600">👑 Super Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono text-red-400/70 hover:text-red-300 hover:bg-red-500/5 border border-transparent hover:border-red-900/30 transition-all"
          >
            {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            {isLoggingOut ? "Keluar..." : "Logout"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-cyan-900/30 bg-[hsl(220,45%,8%)]/95 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-lg border border-cyan-800/40 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
                <Menu className="h-4 w-4 text-cyan-400" />
              </button>
              <div>
                <h2 className="text-base font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
                  {MENU_ITEMS.find(m => m.key === activePage)?.label || "Admin"}
                </h2>
                <p className="text-[10px] font-mono text-cyan-700">
                  {MENU_ITEMS.find(m => m.key === activePage)?.desc}
                </p>
              </div>
            </div>
            {/* Mobile user badge */}
            <div className="lg:hidden flex items-center gap-2 px-2 py-1 rounded-lg bg-purple-500/5 border border-purple-900/30">
              <Shield className="h-3 w-3 text-purple-400" />
              <span className="text-[10px] font-mono text-purple-300">{qcName}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {activePage === "overview" && <OverviewPage />}
            {activePage === "tenants" && <TenantsPage />}
            {activePage === "users" && <UsersPage />}
            {activePage === "personnel" && <PersonnelPage />}
            {activePage === "configs" && <ConfigsPage />}
            {activePage === "database" && <DatabasePage />}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden sticky bottom-0 border-t border-cyan-900/30 bg-[hsl(220,45%,8%)]/95 backdrop-blur-md">
          <div className="flex justify-around py-1.5">
            {MENU_ITEMS.slice(0, 5).map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNav(item.key)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all ${isActive ? "text-cyan-300" : "text-cyan-700"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[9px] font-mono">{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => handleNav("database")}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all ${activePage === "database" ? "text-cyan-300" : "text-cyan-700"}`}
            >
              <Server className="h-4 w-4" />
              <span className="text-[9px] font-mono">DB</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}

// ==========================================
// OVERVIEW PAGE
// ==========================================
function OverviewPage() {
  const [stats, setStats] = useState({ tenants: 0, users: 0, personnel: 0, configs: 0, tenantsWithDb: 0 });
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
          personnel: 0, // loaded per-tenant
          configs: (cd.configs || []).length,
          tenantsWithDb: tList.filter((t: Tenant) => t.neon_database_url).length,
        });
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  const cards = [
    { label: "Total Store", value: stats.tenants, icon: Building2, color: "cyan", sub: `${stats.tenantsWithDb} punya DB sendiri` },
    { label: "Total Users", value: stats.users, icon: UserCog, color: "blue", sub: "Semua store" },
    { label: "Configs", value: stats.configs, icon: KeyRound, color: "green", sub: `dari ${stats.tenants} store` },
    { label: "DB Isolated", value: stats.tenantsWithDb, icon: Server, color: "purple", sub: `dari ${stats.tenants} store` },
  ];

  const colorMap: Record<string, string> = {
    cyan: "border-cyan-500/30 bg-cyan-500/5 text-cyan-400",
    blue: "border-blue-500/30 bg-blue-500/5 text-blue-400",
    green: "border-green-500/30 bg-green-500/5 text-green-400",
    purple: "border-purple-500/30 bg-purple-500/5 text-purple-400",
  };

  const iconColorMap: Record<string, string> = {
    cyan: "text-cyan-400",
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5 p-6">
        <h2 className="text-xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
          Selamat datang, Admin! 👑
        </h2>
        <p className="text-sm text-cyan-600 font-mono mt-1">
          Semua kontrol ada di tangan lo. Kelola store, user, dan konfigurasi dari sini.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`rounded-xl border p-4 ${colorMap[card.color]}`}>
              <div className="flex items-center justify-between mb-3">
                <Icon className={`h-5 w-5 ${iconColorMap[card.color]}`} />
              </div>
              <p className="text-2xl sm:text-3xl font-bold font-mono">{card.value}</p>
              <p className="text-xs font-mono mt-1 opacity-80">{card.label}</p>
              <p className="text-[10px] font-mono mt-0.5 opacity-50">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Store List Quick View */}
      <div className="rounded-xl border border-cyan-900/30 bg-gray-900/30">
        <div className="px-4 py-3 border-b border-cyan-900/30">
          <h3 className="text-sm font-mono font-bold text-cyan-400">Daftar Store</h3>
        </div>
        <div className="divide-y divide-cyan-900/20">
          {tenants.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between hover:bg-cyan-500/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${t.status === "active" ? "bg-green-400 shadow-[0_0_4px_rgba(0,255,128,0.6)]" : "bg-red-400"}`} />
                <div>
                  <p className="text-sm font-mono text-cyan-200">{t.name}</p>
                  <p className="text-[10px] font-mono text-cyan-700">{t.address || "Alamat belum diisi"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${t.neon_database_url ? "bg-purple-500/10 text-purple-300" : "bg-yellow-500/10 text-yellow-300"}`}>
                  {t.neon_database_url ? "🗄️ Own DB" : "📦 Master"}
                </span>
              </div>
            </div>
          ))}
          {tenants.length === 0 && (
            <div className="px-4 py-8 text-center text-sm font-mono text-cyan-700">Belum ada store</div>
          )}
        </div>
      </div>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-mono text-cyan-500">Daftar Store ({tenants.length})</h2>
        <div className="flex gap-2">
          <button onClick={loadTenants} className="p-2 rounded-lg border border-cyan-800/40 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
            <RefreshCw className="h-4 w-4 text-cyan-400" />
          </button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: "", address: "", phone: "", status: "active", neon_database_url: "" }); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-400/50 bg-cyan-500/10 text-cyan-200 font-mono text-sm hover:bg-cyan-500/20 transition-all">
            <Plus className="h-4 w-4" /> Tambah Store
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-cyan-500/30 bg-gray-900/50 p-4 space-y-3">
          <h3 className="text-sm font-mono text-cyan-300">{editingId ? "Edit Store" : "Tambah Store Baru"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono text-cyan-600 uppercase">Nama Store</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none" placeholder="GCK Bekasi Kp Bulu" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-cyan-600 uppercase">Alamat</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none" placeholder="Jl. Raya Bekasi No. 123" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-cyan-600 uppercase">No. Telp</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none" placeholder="08123456789" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-cyan-600 uppercase">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono text-cyan-600 uppercase">🗄️ Neon Database URL (Per-Resto)</label>
            <input value={form.neon_database_url} onChange={(e) => setForm({ ...form, neon_database_url: e.target.value })}
              className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-[11px] text-cyan-100 focus:border-cyan-400 focus:outline-none" placeholder="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require" />
            <p className="text-[9px] font-mono text-cyan-700 mt-1">Kosongkan jika masih pakai database utama (master)</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving || !form.name}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-400/50 bg-green-500/10 text-green-200 font-mono text-sm hover:bg-green-500/20 disabled:opacity-50 transition-all">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Nyimpen..." : "Simpan"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-800/40 text-cyan-400 font-mono text-sm hover:bg-cyan-500/5 transition-all">
              <X className="h-4 w-4" /> Batal
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" /><p className="text-xs font-mono text-cyan-600 mt-2">Loading...</p></div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-cyan-900/30 rounded-xl">
          <Store className="h-8 w-8 text-cyan-800 mx-auto" /><p className="text-sm font-mono text-cyan-700 mt-2">Belum ada store. Tambahin dulu yuk!</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cyan-900/30">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-cyan-900/30 bg-cyan-500/5">
                <th className="text-left px-4 py-3 text-cyan-500 text-xs">NAMA</th>
                <th className="text-left px-4 py-3 text-cyan-500 text-xs hidden sm:table-cell">ALAMAT</th>
                <th className="text-left px-4 py-3 text-cyan-500 text-xs hidden sm:table-cell">TELP</th>
                <th className="text-left px-4 py-3 text-cyan-500 text-xs">DB</th>
                <th className="text-left px-4 py-3 text-cyan-500 text-xs">STATUS</th>
                <th className="text-right px-4 py-3 text-cyan-500 text-xs">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-cyan-900/20 hover:bg-cyan-500/5 transition-colors">
                  <td className="px-4 py-3 text-cyan-200">{t.name}</td>
                  <td className="px-4 py-3 text-cyan-300 text-xs hidden sm:table-cell">{t.address || "—"}</td>
                  <td className="px-4 py-3 text-cyan-300 text-xs hidden sm:table-cell">{t.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${t.neon_database_url ? "bg-purple-500/10 text-purple-300" : "bg-yellow-500/10 text-yellow-300"}`}>
                      {t.neon_database_url ? "🗄️ Own" : "📦 Master"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.status === "active" ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => handleEdit(t)} className="p-1.5 rounded border border-cyan-800/40 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
                        <Pencil className="h-3.5 w-3.5 text-cyan-400" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded border border-red-800/40 hover:border-red-500/50 hover:bg-red-500/5 transition-all">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <h2 className="text-sm font-mono text-cyan-500">Daftar User ({users.length})</h2>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-cyan-800/40 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
            <RefreshCw className="h-4 w-4 text-cyan-400" />
          </button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ tenant_id: "", username: "", password: "", role: "admin" }); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-400/50 bg-cyan-500/10 text-cyan-200 font-mono text-sm hover:bg-cyan-500/20 transition-all">
            <Plus className="h-4 w-4" /> Tambah User
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-cyan-500/30 bg-gray-900/50 p-4 space-y-3">
          <h3 className="text-sm font-mono text-cyan-300">{editingId ? "Edit User" : "Tambah User Baru"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono text-cyan-600 uppercase">Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none" placeholder="johndoe" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-cyan-600 uppercase">Password {editingId && "(kosongkan kalau ga mau ganti)"}</label>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password"
                className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none" placeholder="••••••••" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-cyan-600 uppercase">Store</label>
              <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none">
                <option value="">— Pilih Resto —</option>
                <option value="ALL">Semua Resto (Super Admin)</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-cyan-600 uppercase">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none">
                <option value="admin">QC / Quality Control</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving || !form.username || (!editingId && !form.password) || !form.tenant_id}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-400/50 bg-green-500/10 text-green-200 font-mono text-sm hover:bg-green-500/20 disabled:opacity-50 transition-all">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Nyimpen..." : "Simpan"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-800/40 text-cyan-400 font-mono text-sm hover:bg-cyan-500/5 transition-all">
              <X className="h-4 w-4" /> Batal
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" /><p className="text-xs font-mono text-cyan-600 mt-2">Loading...</p></div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-cyan-900/30 rounded-xl">
          <Users className="h-8 w-8 text-cyan-800 mx-auto" /><p className="text-sm font-mono text-cyan-700 mt-2">Belum ada user.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cyan-900/30">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-cyan-900/30 bg-cyan-500/5">
                <th className="text-left px-4 py-3 text-cyan-500 text-xs">USERNAME</th>
                <th className="text-left px-4 py-3 text-cyan-500 text-xs">RESTO</th>
                <th className="text-left px-4 py-3 text-cyan-500 text-xs">ROLE</th>
                <th className="text-left px-4 py-3 text-cyan-500 text-xs hidden sm:table-cell">DIBUAT</th>
                <th className="text-right px-4 py-3 text-cyan-500 text-xs">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-cyan-900/20 hover:bg-cyan-500/5 transition-colors">
                  <td className="px-4 py-3 text-cyan-200">{u.username}</td>
                  <td className="px-4 py-3 text-cyan-300 text-xs">{getTenantName(u.tenant_id)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${u.role === "super_admin" ? "bg-purple-500/10 text-purple-300" : "bg-blue-500/10 text-blue-300"}`}>
                      {u.role === "super_admin" ? "👑 Super Admin" : "🔍 QC"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cyan-600 text-xs hidden sm:table-cell">{new Date(u.created_at).toLocaleDateString("id-ID")}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => handleEdit(u)} className="p-1.5 rounded border border-cyan-800/40 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
                        <Pencil className="h-3.5 w-3.5 text-cyan-400" />
                      </button>
                      <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded border border-red-800/40 hover:border-red-500/50 hover:bg-red-500/5 transition-all">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await api("/api/settings/configs", "POST", {
          action: "upload-signature", tenant_id: selectedTenant,
          file_base64: base64, file_name: file.name, mime_type: file.type,
        });
        if (result.signature_url) { setForm((prev: any) => ({ ...prev, signature_url: result.signature_url })); }
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

  if (loading) return <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-mono text-cyan-500">QC & Manajer per Store</h2>
      </div>

      {tenants.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-cyan-900/30 rounded-xl">
          <UserCheck className="h-8 w-8 text-cyan-800 mx-auto" />
          <p className="text-sm font-mono text-cyan-700 mt-2">Bikin store dulu di halaman Store</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-cyan-500/30 bg-gray-900/50 p-4">
            <label className="text-[10px] font-mono text-cyan-600 uppercase">Pilih Store</label>
            <select value={selectedTenant} onChange={(e) => handleSelectTenant(e.target.value)}
              className="w-full h-10 px-3 mt-1 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none">
              <option value="">— Pilih store dulu —</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {selectedTenant && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button onClick={() => setFilter("all")}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all border ${filter === "all" ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-200" : "border-cyan-800/40 text-cyan-600 hover:text-cyan-400"}`}>
                    Semua ({personnel.length})
                  </button>
                  <button onClick={() => setFilter("qc")}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all border ${filter === "qc" ? "border-green-400/50 bg-green-500/10 text-green-200" : "border-cyan-800/40 text-cyan-600 hover:text-cyan-400"}`}>
                    🔍 QC ({qcCount})
                  </button>
                  <button onClick={() => setFilter("manager")}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all border ${filter === "manager" ? "border-purple-400/50 bg-purple-500/10 text-purple-200" : "border-cyan-800/40 text-cyan-600 hover:text-cyan-400"}`}>
                    👔 Manajer ({mgrCount})
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadPersonnel(selectedTenant)} className="p-2 rounded-lg border border-cyan-800/40 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
                    <RefreshCw className="h-4 w-4 text-cyan-400" />
                  </button>
                  <button onClick={() => { setShowForm(true); setEditingId(null); setPreviewUrl(""); setForm({ name: "", full_name: "", role: "qc", signature_url: "", status: "active" }); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-400/50 bg-cyan-500/10 text-cyan-200 font-mono text-sm hover:bg-cyan-500/20 transition-all">
                    <Plus className="h-4 w-4" /> Tambah Personil
                  </button>
                </div>
              </div>

              {showForm && (
                <div className="rounded-xl border border-cyan-500/30 bg-gray-900/50 p-4 space-y-3">
                  <h3 className="text-sm font-mono text-cyan-300">{editingId ? "Edit Personil" : "Tambah Personil Baru"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono text-cyan-600 uppercase">Nama Singkat (key)</label>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none" placeholder="PAJAR" />
                      <p className="text-[10px] font-mono text-cyan-800 mt-0.5">Nama pendek, huruf kapital</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-cyan-600 uppercase">Nama Lengkap</label>
                      <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none" placeholder="PAJAR HIDAYAT" />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-cyan-600 uppercase">Role</label>
                      <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                        className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none">
                        <option value="qc">🔍 QC</option>
                        <option value="manager">👔 Manajer</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-cyan-600 uppercase">Status</label>
                      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-mono text-cyan-600 uppercase">Upload TTD / Tanda Tangan</label>
                      <div className="flex items-center gap-3 mt-1">
                        <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${uploading ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-300" : "border-cyan-800/50 bg-black/40 text-cyan-300 hover:border-cyan-500/50 hover:bg-cyan-500/5"}`}>
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          <span className="font-mono text-sm">{uploading ? "Uploading..." : "Pilih File"}</span>
                          <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                        </label>
                        {(previewUrl || form.signature_url) && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-16 rounded-lg border border-cyan-900/50 bg-black/40 overflow-hidden flex items-center justify-center">
                              <img src={previewUrl || `/api/proxy-image?url=${encodeURIComponent(form.signature_url)}&tenant_id=${selectedTenant}`}
                                alt="Preview TTD" className="w-full h-full object-contain p-1"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            </div>
                            <div>
                              <p className="text-[10px] font-mono text-green-400">✅ TTD Ready</p>
                              <p className="text-[10px] font-mono text-cyan-800 truncate max-w-[200px]">{form.signature_url}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-cyan-800 mt-1">Upload gambar TTD (JPG/PNG). Otomatis ke R2 bucket.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSave} disabled={saving || !form.name || !form.role}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-400/50 bg-green-500/10 text-green-200 font-mono text-sm hover:bg-green-500/20 disabled:opacity-50 transition-all">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Nyimpen..." : "Simpan"}
                    </button>
                    <button onClick={() => { setShowForm(false); setEditingId(null); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-800/40 text-cyan-400 font-mono text-sm hover:bg-cyan-500/5 transition-all">
                      <X className="h-4 w-4" /> Batal
                    </button>
                  </div>
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-cyan-900/30 rounded-xl">
                  <UserCheck className="h-8 w-8 text-cyan-800 mx-auto" />
                  <p className="text-sm font-mono text-cyan-700 mt-2">{personnel.length === 0 ? "Belum ada personil. Tambahin dulu!" : "Ga ada data untuk filter ini"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filtered.map((p) => (
                    <div key={p.id} className="rounded-xl border border-cyan-900/30 bg-gray-900/40 p-4 hover:border-cyan-500/30 transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-12 rounded-lg border border-cyan-800/30 bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {p.signature_url ? (
                              <img src={`/api/proxy-image?url=${encodeURIComponent(p.signature_url)}&tenant_id=${selectedTenant}`}
                                alt="TTD" className="w-full h-full object-contain p-1"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <span className="text-[10px] font-mono text-cyan-800">No TTD</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${p.role === "qc" ? "bg-green-500/10 text-green-300" : "bg-purple-500/10 text-purple-300"}`}>
                                {p.role === "qc" ? "🔍 QC" : "👔 MGR"}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${p.status === "active" ? "bg-cyan-500/10 text-cyan-300" : "bg-red-500/10 text-red-300"}`}>
                                {p.status}
                              </span>
                            </div>
                            <p className="text-sm font-mono text-cyan-200 mt-1 font-bold">{p.full_name || p.name}</p>
                            <p className="text-[10px] font-mono text-cyan-600">key: {p.name}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleEdit(p)} className="p-1.5 rounded border border-cyan-800/40 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
                            <Pencil className="h-3.5 w-3.5 text-cyan-400" />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded border border-red-800/40 hover:border-red-500/50 hover:bg-red-500/5 transition-all">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
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

  const configFields = [
    { key: "google_spreadsheet_id", label: "Google Spreadsheet ID", placeholder: "1ABC...xyz", secret: false, desc: "ID dari Google Sheet khusus store ini" },
    { key: "google_sheets_credentials", label: "Google Sheets Credentials (JSON)", placeholder: "{...service account JSON...}", secret: true, desc: "Service Account JSON buat akses Google Sheets" },
    { key: "r2_account_id", label: "R2 Account ID", placeholder: "abc123...", secret: true, desc: "Cloudflare Account ID" },
    { key: "r2_access_key_id", label: "R2 Access Key ID", placeholder: "abc123...", secret: true, desc: "R2 API Token Access Key" },
    { key: "r2_secret_access_key", label: "R2 Secret Access Key", placeholder: "abc123...", secret: true, desc: "R2 API Token Secret" },
    { key: "r2_bucket_name", label: "R2 Bucket Name", placeholder: "ba-waste", secret: false, desc: "Nama bucket R2" },
    { key: "r2_public_url", label: "R2 Public URL", placeholder: "https://pub-xxx.r2.dev", secret: false, desc: "URL publik bucket R2" },
  ];

  if (loading) return <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-mono text-cyan-500">Konfigurasi per-Store</h2>
        <button onClick={load} className="p-2 rounded-lg border border-cyan-800/40 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
          <RefreshCw className="h-4 w-4 text-cyan-400" />
        </button>
      </div>

      {tenants.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-cyan-900/30 rounded-xl">
          <Database className="h-8 w-8 text-cyan-800 mx-auto" />
          <p className="text-sm font-mono text-cyan-700 mt-2">Bikin store dulu, baru bisa isi config</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-cyan-500/30 bg-gray-900/50 p-4">
            <label className="text-[10px] font-mono text-cyan-600 uppercase">Pilih Store</label>
            <select value={selectedTenant} onChange={(e) => handleSelectTenant(e.target.value)}
              className="w-full h-10 px-3 mt-1 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none">
              <option value="">— Pilih store dulu —</option>
              {tenants.map((t) => {
                const hasConfig = configs.some((c) => c.tenant_id === t.id);
                return <option key={t.id} value={t.id}>{t.name} {hasConfig ? "✅" : "⚠️ belum"}</option>;
              })}
            </select>
          </div>

          {selectedTenant && (
            <div className="rounded-xl border border-cyan-500/30 bg-gray-900/50 p-4 space-y-4">
              <h3 className="text-sm font-mono text-cyan-300">
                Config: {tenants.find((t) => t.id === selectedTenant)?.name}
              </h3>
              <div className="space-y-3">
                {configFields.map((field) => (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-mono text-cyan-600 uppercase">{field.label}</label>
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
                      className="w-full h-10 px-3 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none"
                      placeholder={field.placeholder}
                    />
                    <p className="text-[10px] font-mono text-cyan-800 mt-0.5">{field.desc}</p>
                  </div>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-400/50 bg-green-500/10 text-green-200 font-mono text-sm hover:bg-green-500/20 disabled:opacity-50 transition-all">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Nyimpen..." : "Simpan Config"}
              </button>
            </div>
          )}

          {!selectedTenant && configs.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-cyan-900/30">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-cyan-900/30 bg-cyan-500/5">
                    <th className="text-left px-4 py-3 text-cyan-500 text-xs">RESTO</th>
                    <th className="text-left px-4 py-3 text-cyan-500 text-xs">SHEET ID</th>
                    <th className="text-left px-4 py-3 text-cyan-500 text-xs">R2 BUCKET</th>
                    <th className="text-left px-4 py-3 text-cyan-500 text-xs hidden sm:table-cell">UPDATED</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((c) => {
                    const tenant = tenants.find((t) => t.id === c.tenant_id);
                    return (
                      <tr key={c.tenant_id} onClick={() => handleSelectTenant(c.tenant_id)}
                        className="border-b border-cyan-900/20 hover:bg-cyan-500/5 cursor-pointer transition-colors">
                        <td className="px-4 py-3 text-cyan-200">{tenant?.name || c.tenant_id}</td>
                        <td className="px-4 py-3 text-cyan-400 text-xs">{c.google_spreadsheet_id ? c.google_spreadsheet_id.substring(0, 15) + "..." : "—"}</td>
                        <td className="px-4 py-3 text-cyan-400 text-xs">{c.r2_bucket_name || "—"}</td>
                        <td className="px-4 py-3 text-cyan-600 text-xs hidden sm:table-cell">{c.updated_at ? new Date(c.updated_at).toLocaleDateString("id-ID") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
      const result = await api("/api/settings/configs", "POST", {
        action: "seed-tenant-db",
        tenant_id: selectedTenant,
      });
      setSeedResult(result);
    } catch (err: any) {
      setSeedResult({ ok: false, message: err.message });
    }
    setSeeding(false);
  };

  if (loading) return <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" /></div>;

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-blue-500/5 p-5">
        <h3 className="text-base font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-blue-400 flex items-center gap-2">
          <Server className="w-5 h-5 text-purple-400" /> Database Management
        </h3>
        <p className="text-sm text-cyan-600 font-mono mt-1">
          Seed database untuk store baru yang udah punya Neon DB URL sendiri.
        </p>
      </div>

      {/* Seed Tenant DB */}
      <div className="rounded-xl border border-cyan-900/30 bg-gray-900/30 p-5 space-y-4">
        <h4 className="text-sm font-mono font-bold text-cyan-300">Seed Tenant Database</h4>
        <p className="text-xs font-mono text-cyan-700">Bikin tabel (users, personnel, tenant_configs) di database tenant yang baru.</p>

        <div>
          <label className="text-[10px] font-mono text-cyan-600 uppercase">Pilih Store</label>
          <select value={selectedTenant} onChange={(e) => { setSelectedTenant(e.target.value); setSeedResult(null); }}
            className="w-full h-10 px-3 mt-1 bg-black/40 border border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 focus:border-cyan-400 focus:outline-none">
            <option value="">— Pilih store —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name} {t.neon_database_url ? "🗄️" : "📦 (no own DB)"}</option>
            ))}
          </select>
        </div>

        {selectedTenant && (
          <div className="space-y-3">
            {(() => {
              const tenant = tenants.find(t => t.id === selectedTenant);
              return tenant ? (
                <div className="rounded-lg border border-cyan-900/30 bg-black/20 p-3 space-y-1">
                  <p className="text-xs font-mono text-cyan-400">📍 {tenant.name}</p>
                  <p className="text-[10px] font-mono text-cyan-700">
                    DB: {tenant.neon_database_url ? (
                      <span className="text-purple-300">🗄️ Own Database</span>
                    ) : (
                      <span className="text-yellow-300">📦 Master (belum ada own DB)</span>
                    )}
                  </p>
                </div>
              ) : null;
            })()}

            <button
              onClick={handleSeedTenantDb}
              disabled={seeding || !selectedTenant}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-purple-400/50 bg-purple-500/10 text-purple-200 font-mono text-sm hover:bg-purple-500/20 disabled:opacity-50 transition-all"
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {seeding ? "Seeding..." : "Seed Tenant DB"}
            </button>

            {seedResult && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm font-mono ${seedResult.ok ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                {seedResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <p className="text-xs">{seedResult.message}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DB Status Overview */}
      <div className="rounded-xl border border-cyan-900/30 bg-gray-900/30">
        <div className="px-4 py-3 border-b border-cyan-900/30">
          <h4 className="text-sm font-mono font-bold text-cyan-400">Status Database per Store</h4>
        </div>
        <div className="divide-y divide-cyan-900/20">
          {tenants.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.neon_database_url ? "bg-purple-500/10 border border-purple-500/30" : "bg-yellow-500/10 border border-yellow-500/30"}`}>
                  <Server className={`h-4 w-4 ${t.neon_database_url ? "text-purple-400" : "text-yellow-400"}`} />
                </div>
                <div>
                  <p className="text-sm font-mono text-cyan-200">{t.name}</p>
                  <p className="text-[10px] font-mono text-cyan-700">{t.id}</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold ${t.neon_database_url ? "bg-purple-500/10 text-purple-300 border border-purple-500/20" : "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20"}`}>
                {t.neon_database_url ? "🗄️ Isolated" : "📦 Master"}
              </span>
            </div>
          ))}
          {tenants.length === 0 && (
            <div className="px-4 py-8 text-center text-sm font-mono text-cyan-700">Belum ada store</div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-cyan-900/20 bg-gray-900/20 p-4 text-xs font-mono text-cyan-700 space-y-1">
        <p>💡 <strong className="text-cyan-500">Tips:</strong></p>
        <p>• Bikin Neon project baru di <a href="https://neon.tech" target="_blank" className="text-purple-400 hover:underline">neon.tech</a> (gratis!)</p>
        <p>• Copy connection string → paste di halaman Store → Neon Database URL</p>
        <p>• Balik ke sini → pilih store → klik "Seed Tenant DB"</p>
        <p>• Pastikan pake <code className="text-cyan-500">?sslmode=require</code></p>
      </div>
    </div>
  );
}
