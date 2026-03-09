import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, Pencil, Trash2, Save, X, Store, Users, Database, Loader2, Eye, EyeOff, RefreshCw, UserCheck, Shield, HardDrive, CheckCircle, AlertCircle, Zap, Upload } from "lucide-react";

// ===== Types =====
interface Tenant { id: string; name: string; address: string; phone: string; status: string; created_at: string; }
interface UserItem { id: string; tenant_id: string; username: string; role: string; created_at: string; }
interface Personnel { id: number; tenant_id: string; name: string; full_name: string; role: string; signature_url: string; status: string; created_at: string; }
interface TenantConfig { tenant_id: string; google_spreadsheet_id: string; google_sheets_credentials: string; r2_account_id: string; r2_access_key_id: string; r2_secret_access_key: string; r2_bucket_name: string; r2_public_url: string; updated_at: string; }

// ===== API Helpers =====
async function api(url: string, method = "GET", body?: any) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", "x-user-role": "super_admin" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

// ===== Tabs =====
type TabKey = "tenants" | "users" | "configs" | "personnel" | "database";
const TABS: { key: TabKey; label: string; shortLabel: string; icon: any }[] = [
  { key: "tenants", label: "Store / Tenant", shortLabel: "Store", icon: Store },
  { key: "users", label: "User Management", shortLabel: "User", icon: Users },
  { key: "configs", label: "Config & Env", shortLabel: "Config", icon: Database },
  { key: "personnel", label: "QC & Manajer", shortLabel: "QC", icon: UserCheck },
  { key: "database", label: "Database", shortLabel: "DB", icon: HardDrive },
];

export default function Settings() {
  const [, navigate] = useLocation();
  const { isSuperAdmin, userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("tenants");

  // Redirect kalo bukan super admin
  useEffect(() => {
    if (userRole && !isSuperAdmin) navigate("/");
  }, [userRole, isSuperAdmin]);

  return (
    <div className="min-h-screen bg-gray-950 text-cyan-100">
      {/* Header */}
      <div className="border-b border-cyan-900/30 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-4">
          <button onClick={() => navigate("/")} className="p-1.5 sm:p-2 rounded-lg border border-cyan-800/40 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all flex-shrink-0">
            <ArrowLeft className="h-4 w-4 text-cyan-400" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400 truncate">
              ⚙️ Settings — Control Panel
            </h1>
            <p className="text-[10px] sm:text-xs font-mono text-cyan-600">Kelola store, user, dan konfigurasi</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-2 sm:px-4 pt-3 sm:pt-4">
        <div className="flex overflow-x-auto scrollbar-hide gap-1 sm:gap-2 border-b border-cyan-900/30 pb-0 -mx-2 px-2 sm:mx-0 sm:px-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 font-mono text-xs sm:text-sm rounded-t-lg border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? "border-cyan-400 text-cyan-200 bg-cyan-500/10"
                    : "border-transparent text-cyan-600 hover:text-cyan-400 hover:bg-cyan-500/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {activeTab === "tenants" && <TenantsTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "configs" && <ConfigsTab />}
        {activeTab === "personnel" && <PersonnelTab />}
        {activeTab === "database" && <DatabaseTab />}
      </div>
    </div>
  );
}

// ==========================================
// TENANTS TAB
// ==========================================
function TenantsTab() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", status: "active" });
  const [saving, setSaving] = useState(false);

  const loadTenants = async () => {
    setLoading(true);
    const data = await api("/api/settings/tenants");
    setTenants(data.tenants || []);
    setLoading(false);
  };

  useEffect(() => { loadTenants(); }, []);

  const handleSave = async () => {
    setSaving(true);
    if (editingId) {
      await api("/api/settings/tenants", "PUT", { id: editingId, ...form });
    } else {
      const autoId = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      await api("/api/settings/tenants", "POST", { id: autoId, ...form });
    }
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", address: "", phone: "", status: "active" });
    loadTenants();
  };

  const handleEdit = (t: Tenant) => {
    setEditingId(t.id);
    setForm({ name: t.name, address: t.address || "", phone: t.phone || "", status: t.status });
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
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: "", address: "", phone: "", status: "active" }); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-400/50 bg-cyan-500/10 text-cyan-200 font-mono text-sm hover:bg-cyan-500/20 transition-all"
          >
            <Plus className="h-4 w-4" /> Tambah Store
          </button>
        </div>
      </div>

      {/* Form */}
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

      {/* Table */}
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
                <th className="text-left px-4 py-3 text-cyan-500 text-xs">ALAMAT</th>
                <th className="text-left px-4 py-3 text-cyan-500 text-xs">TELP</th>
                <th className="text-left px-4 py-3 text-cyan-500 text-xs">STATUS</th>
                <th className="text-left px-4 py-3 text-cyan-500 text-xs">DIBUAT</th>
                <th className="text-right px-4 py-3 text-cyan-500 text-xs">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-cyan-900/20 hover:bg-cyan-500/5 transition-colors">
                  <td className="px-4 py-3 text-cyan-200">{t.name}</td>
                  <td className="px-4 py-3 text-cyan-300 text-xs">{t.address || "—"}</td>
                  <td className="px-4 py-3 text-cyan-300 text-xs">{t.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.status === "active" ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cyan-600 text-xs">{new Date(t.created_at).toLocaleDateString("id-ID")}</td>
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
// USERS TAB
// ==========================================
function UsersTab() {
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
    setUsers(ud.users || []);
    setTenants(td.tenants || []);
    setLoading(false);
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
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
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
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ tenant_id: "", username: "", password: "", role: "admin" }); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-400/50 bg-cyan-500/10 text-cyan-200 font-mono text-sm hover:bg-cyan-500/20 transition-all"
          >
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
                <th className="text-left px-4 py-3 text-cyan-500 text-xs">DIBUAT</th>
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
                  <td className="px-4 py-3 text-cyan-600 text-xs">{new Date(u.created_at).toLocaleDateString("id-ID")}</td>
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
// PERSONNEL TAB (QC & Manager + TTD)
// ==========================================
function PersonnelTab() {
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

  const load = async () => {
    setLoading(true);
    const td = await api("/api/settings/tenants");
    setTenants(td.tenants || []);
    setLoading(false);
  };

  const loadPersonnel = async (tid: string) => {
    if (!tid) { setPersonnel([]); return; }
    const data = await api(`/api/settings/personnel?tenant_id=${tid}`);
    setPersonnel(data.personnel || []);
  };

  useEffect(() => { load(); }, []);

  const handleSelectTenant = (tid: string) => {
    setSelectedTenant(tid);
    setShowForm(false);
    setEditingId(null);
    loadPersonnel(tid);
  };

  const handleSave = async () => {
    if (!selectedTenant) return;
    setSaving(true);
    if (editingId) {
      await api(`/api/settings/personnel?id=${editingId}`, "PUT", form);
    } else {
      await api("/api/settings/personnel", "POST", { tenant_id: selectedTenant, ...form });
    }
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", full_name: "", role: "qc", signature_url: "", status: "active" });
    loadPersonnel(selectedTenant);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTenant) return;
    // Show local preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    // Convert to base64 and upload
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await api("/api/settings/configs", "POST", {
          action: "upload-signature",
          tenant_id: selectedTenant,
          file_base64: base64,
          file_name: file.name,
          mime_type: file.type,
        });
        if (result.signature_url) {
          setForm((prev: any) => ({ ...prev, signature_url: result.signature_url }));
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  const handleEdit = (p: Personnel) => {
    setEditingId(p.id);
    setForm({ name: p.name, full_name: p.full_name || "", role: p.role, signature_url: p.signature_url || "", status: p.status });
    setPreviewUrl("");
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin mau hapus personil ini?")) return;
    await api(`/api/settings/personnel?id=${id}`, "DELETE");
    loadPersonnel(selectedTenant);
  };

  const filtered = filter === "all" ? personnel : personnel.filter((p) => p.role === filter);
  const qcCount = personnel.filter((p) => p.role === "qc").length;
  const mgrCount = personnel.filter((p) => p.role === "manager").length;

  if (loading) {
    return <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" /><p className="text-xs font-mono text-cyan-600 mt-2">Loading...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-mono text-cyan-500">QC & Manajer per Store</h2>
      </div>

      {tenants.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-cyan-900/30 rounded-xl">
          <UserCheck className="h-8 w-8 text-cyan-800 mx-auto" />
          <p className="text-sm font-mono text-cyan-700 mt-2">Bikin store dulu di tab Tenant</p>
        </div>
      ) : (
        <>
          {/* Tenant Selector */}
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
              {/* Stats + Actions */}
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

              {/* Form */}
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
                              <img
                                src={previewUrl || `/api/proxy-image?url=${encodeURIComponent(form.signature_url)}&tenant_id=${selectedTenant}`}
                                alt="Preview TTD"
                                className="w-full h-full object-contain p-1"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
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

              {/* Personnel List */}
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
                          {/* TTD Preview */}
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
                      {p.signature_url && (
                        <p className="text-[10px] font-mono text-cyan-800 mt-2 truncate">📎 {p.signature_url}</p>
                      )}
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
// CONFIGS TAB
// ==========================================
function ConfigsTab() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [configs, setConfigs] = useState<TenantConfig[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    google_spreadsheet_id: "", google_sheets_credentials: "",
    r2_account_id: "",
    r2_access_key_id: "",
    r2_secret_access_key: "",
    r2_bucket_name: "",
    r2_public_url: "",
  });

  const load = async () => {
    setLoading(true);
    const [td, cd] = await Promise.all([api("/api/settings/tenants"), api("/api/settings/configs")]);
    setTenants(td.tenants || []);
    setConfigs(cd.configs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSelectTenant = (tid: string) => {
    setSelectedTenant(tid);
    const existing = configs.find((c) => c.tenant_id === tid);
    if (existing) {
      setForm({
        google_spreadsheet_id: existing.google_spreadsheet_id || "", google_sheets_credentials: existing.google_sheets_credentials || "",
        r2_account_id: existing.r2_account_id || "",
        r2_access_key_id: existing.r2_access_key_id || "",
        r2_secret_access_key: existing.r2_secret_access_key || "",
        r2_bucket_name: existing.r2_bucket_name || "",
        r2_public_url: existing.r2_public_url || "",
      });
    } else {
      setForm({ google_spreadsheet_id: "", google_sheets_credentials: "", r2_account_id: "", r2_access_key_id: "", r2_secret_access_key: "", r2_bucket_name: "", r2_public_url: "" });
    }
  };

  const handleSave = async () => {
    if (!selectedTenant) return;
    setSaving(true);
    await api("/api/settings/configs", "POST", { tenant_id: selectedTenant, ...form });
    await load();
    setSaving(false);
  };

  const toggleSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const configFields = [
    { key: "google_spreadsheet_id", label: "Google Spreadsheet ID", placeholder: "1ABC...xyz", secret: false, desc: "ID dari Google Sheet khusus store ini" },
    { key: "google_sheets_credentials", label: "Google Sheets Credentials (JSON)", placeholder: "{...service account JSON...}", secret: true, desc: "Service Account JSON buat akses Google Sheets" },
    { key: "r2_account_id", label: "R2 Account ID", placeholder: "abc123...", secret: true, desc: "Cloudflare Account ID" },
    { key: "r2_access_key_id", label: "R2 Access Key ID", placeholder: "abc123...", secret: true, desc: "R2 API Token Access Key" },
    { key: "r2_secret_access_key", label: "R2 Secret Access Key", placeholder: "abc123...", secret: true, desc: "R2 API Token Secret" },
    { key: "r2_bucket_name", label: "R2 Bucket Name", placeholder: "ba-waste", secret: false, desc: "Nama bucket R2" },
    { key: "r2_public_url", label: "R2 Public URL", placeholder: "https://pub-xxx.r2.dev", secret: false, desc: "URL publik bucket R2" },
  ];

  if (loading) {
    return <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" /><p className="text-xs font-mono text-cyan-600 mt-2">Loading...</p></div>;
  }

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
          <p className="text-sm font-mono text-cyan-700 mt-2">Bikin store dulu di tab Tenant, baru bisa isi config</p>
        </div>
      ) : (
        <>
          {/* Tenant Selector */}
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

          {/* Config Form */}
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

          {/* Overview configs */}
          {!selectedTenant && configs.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-cyan-900/30">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-cyan-900/30 bg-cyan-500/5">
                    <th className="text-left px-4 py-3 text-cyan-500 text-xs">RESTO</th>
                    <th className="text-left px-4 py-3 text-cyan-500 text-xs">SHEET ID</th>
                    <th className="text-left px-4 py-3 text-cyan-500 text-xs">R2 BUCKET</th>
                    <th className="text-left px-4 py-3 text-cyan-500 text-xs">UPDATED</th>
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
                        <td className="px-4 py-3 text-cyan-600 text-xs">{c.updated_at ? new Date(c.updated_at).toLocaleDateString("id-ID") : "—"}</td>
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


// ===== DATABASE TAB =====
function DatabaseTab() {
  const [newDbUrl, setNewDbUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [testing, setTesting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; tables?: string[] } | null>(null);
  const [seedResult, setSeedResult] = useState<{ ok: boolean; message: string; details?: any } | null>(null);
  const [switchResult, setSwitchResult] = useState<{ ok: boolean; message: string } | null>(null);
  const { token } = useAuth();

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-user-role": "super_admin",
  };

  async function handleTest() {
    if (!newDbUrl.trim()) return alert("URL database wajib diisi dulu!");
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/configs", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "db-test", db_url: newDbUrl }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSeed() {
    if (!newDbUrl.trim()) return alert("URL database wajib diisi dulu!");
    if (!testResult?.ok) return alert("Test koneksi dulu sebelum seed!");
    if (!confirm("Yakin mau transfer SEMUA data ke database baru? Data lama di target bakal di-replace.")) return;
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/settings/configs", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "db-seed", target_url: newDbUrl }),
      });
      const data = await res.json();
      setSeedResult(data);
    } catch (err: any) {
      setSeedResult({ ok: false, message: err.message });
    } finally {
      setSeeding(false);
    }
  }

  async function handleSwitch() {
    if (!newDbUrl.trim()) return alert("URL database wajib diisi dulu!");
    if (!seedResult?.ok) return alert("Seed data dulu sebelum switch!");
    if (!confirm("⚠️ PERHATIAN! Ini bakal ganti database utama aplikasi.\n\nPastikan seed udah berhasil sebelum switch.\n\nLanjut?")) return;
    setSwitching(true);
    setSwitchResult(null);
    try {
      const res = await fetch("/api/settings/configs", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "db-switch", new_url: newDbUrl }),
      });
      const data = await res.json();
      setSwitchResult(data);
    } catch (err: any) {
      setSwitchResult({ ok: false, message: err.message });
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-purple-400" /> Database Failover
        </h3>
        <p className="text-sm text-zinc-400 mt-1">
          Kalo Neon utama lagi tidur atau limit, pindahin data ke database baru biar app tetep jalan! 💪
        </p>
      </div>

      {/* Step 1: Input URL */}
      <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 space-y-3">
        <h4 className="font-semibold text-white flex items-center gap-2">
          <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
          Masukkan URL Database Baru
        </h4>
        <div className="relative">
          <input
            type={showUrl ? "text" : "password"}
            className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white pr-10 font-mono"
            placeholder="postgresql://user:pass@host/dbname?sslmode=require"
            value={newDbUrl}
            onChange={(e) => { setNewDbUrl(e.target.value); setTestResult(null); setSeedResult(null); setSwitchResult(null); }}
          />
          <button onClick={() => setShowUrl(!showUrl)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white">
            {showUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-zinc-500">Format: postgresql://user:password@host/database?sslmode=require</p>
      </div>

      {/* Step 2: Test Connection */}
      <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 space-y-3">
        <h4 className="font-semibold text-white flex items-center gap-2">
          <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
          Test Koneksi
        </h4>
        <button
          onClick={handleTest}
          disabled={testing || !newDbUrl.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {testing ? "Testing..." : "Test Koneksi"}
        </button>
        {testResult && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${testResult.ok ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
            {testResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <div>
              <p>{testResult.message}</p>
              {testResult.tables && testResult.tables.length > 0 && (
                <p className="text-xs mt-1 opacity-70">Tables: {testResult.tables.join(", ")}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Seed Data */}
      <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 space-y-3">
        <h4 className="font-semibold text-white flex items-center gap-2">
          <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
          Seed / Transfer Data
        </h4>
        <p className="text-xs text-zinc-400">Transfer semua data (tenants, users, configs, personnel) dari DB aktif ke DB baru.</p>
        <button
          onClick={handleSeed}
          disabled={seeding || !testResult?.ok}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {seeding ? "Seeding..." : "Seed Data"}
        </button>
        {seedResult && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${seedResult.ok ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
            {seedResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <div>
              <p>{seedResult.message}</p>
              {seedResult.details && (
                <div className="text-xs mt-1 opacity-70 space-y-0.5">
                  {Object.entries(seedResult.details).map(([table, count]) => (
                    <p key={table}>• {table}: {count as number} records</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 4: Switch */}
      <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 space-y-3">
        <h4 className="font-semibold text-white flex items-center gap-2">
          <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">4</span>
          Switch Database
        </h4>
        <p className="text-xs text-zinc-400">⚠️ Ini bakal ganti database utama dan trigger redeploy. Pastikan seed udah berhasil!</p>
        <button
          onClick={handleSwitch}
          disabled={switching || !seedResult?.ok}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {switching ? "Switching..." : "Switch ke DB Baru"}
        </button>
        {switchResult && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${switchResult.ok ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
            {switchResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <p>{switchResult.message}</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/30 text-xs text-zinc-500 space-y-1">
        <p>💡 <strong>Tips:</strong></p>
        <p>• Bikin Neon project baru di <a href="https://neon.tech" target="_blank" className="text-purple-400 hover:underline">neon.tech</a> (gratis!)</p>
        <p>• Copy connection string dari Neon dashboard</p>
        <p>• Pastikan pake <code>?sslmode=require</code> dan JANGAN pake <code>channel_binding=require</code></p>
        <p>• Setelah switch, app bakal redeploy otomatis (~30 detik)</p>
      </div>
    </div>
  );
}
