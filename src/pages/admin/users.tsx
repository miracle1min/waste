import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X, Loader2, Users } from "lucide-react";
import { api, Tenant, UserItem } from "./types";
import { Card, Badge, Input, Select, Btn, EmptyState, LoadingState, RefreshBtn } from "./shared";

export default function UsersPage() {
 const [users, setUsers] = useState<UserItem[]>([]);
 const [tenants, setTenants] = useState<Tenant[]>([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form, setForm] = useState({ tenant_id: "", username: "", password: "", role: "admin" });
 const [saving, setSaving] = useState(false);

 const load = async () => {
 setLoading(true);
 const [ud, td] = await Promise.all([api("/api/settings?entity=users"), api("/api/settings?entity=tenants")]);
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
 await api("/api/settings?entity=users", "PUT", payload);
 } else {
 await api("/api/settings?entity=users", "POST", form);
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
 await api(`/api/settings?entity=users&id=${id}`, "DELETE");
 load();
 };

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <p className="text-sm font-sans text-[#4FD1FF]/80">{users.length} User</p>
 <div className="flex gap-2">
 <RefreshBtn onClick={load} />
 <Btn onClick={() => { setShowForm(true); setEditingId(null); setForm({ tenant_id: "", username: "", password: "", role: "admin" }); }}>
 <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Tambah User</span><span className="sm:hidden">Tambah</span>
 </Btn>
 </div>
 </div>

 {showForm && (
 <Card className="p-4 sm:p-5 space-y-4">
 <h3 className="text-sm font-sans font-bold text-[#4FD1FF]">{editingId ? "Edit User" : "Tambah User Baru"}</h3>
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
 <table className="w-full text-sm font-sans">
 <thead>
 <tr className="border-b border-[#4FD1FF]/10 bg-[#4FD1FF]/[0.03]">
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">USERNAME</th>
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">RESTO</th>
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">ROLE</th>
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">DIBUAT</th>
 <th className="text-right px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">AKSI</th>
 </tr>
 </thead>
 <tbody>
 {users.map((u) => (
 <tr key={u.id} className="border-b border-[#4FD1FF]/8 hover:bg-white/[0.01] transition-colors">
 <td className="px-5 py-3.5 text-[#E5E7EB] font-medium">{u.username}</td>
 <td className="px-5 py-3.5 text-[#4FD1FF] text-xs">{getTenantName(u.tenant_id)}</td>
 <td className="px-5 py-3.5">
 <Badge variant={u.role === "super_admin" ? "purple" : "blue"}>
 {u.role === "super_admin" ? "👑 Super Admin" : "🔍 QC"}
 </Badge>
 </td>
 <td className="px-5 py-3.5 text-[#4FD1FF]/60 text-xs">{new Date(u.created_at).toLocaleDateString("id-ID")}</td>
 <td className="px-5 py-3.5">
 <div className="flex gap-1.5 justify-end">
 <button onClick={() => handleEdit(u)} className="p-2 rounded-lg border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/30 hover:bg-[#4FD1FF]/8 transition-all">
 <Pencil className="h-3.5 w-3.5 text-[#4FD1FF]" />
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
 <p className="text-sm font-sans text-[#E5E7EB] font-medium">{u.username}</p>
 <p className="text-[11px] font-sans text-[#4FD1FF]/60 mt-0.5 truncate">{getTenantName(u.tenant_id)}</p>
 <div className="flex gap-2 mt-2">
 <Badge variant={u.role === "super_admin" ? "purple" : "blue"}>
 {u.role === "super_admin" ? "👑 Super Admin" : "🔍 QC"}
 </Badge>
 <span className="text-[10px] font-sans text-[#4FD1FF]/60 self-center">{new Date(u.created_at).toLocaleDateString("id-ID")}</span>
 </div>
 </div>
 <div className="flex gap-1.5 shrink-0">
 <button onClick={() => handleEdit(u)} className="p-2 rounded-lg border border-[#4FD1FF]/10 transition-all">
 <Pencil className="h-3.5 w-3.5 text-[#4FD1FF]" />
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
