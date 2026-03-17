import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X, Loader2, Store } from "lucide-react";
import { api, Tenant } from "./types";
import { Card, Badge, Input, Select, Btn, EmptyState, LoadingState, RefreshBtn } from "./shared";

export default function TenantsPage() {
 const [tenants, setTenants] = useState<Tenant[]>([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form, setForm] = useState({ name: "", address: "", phone: "", status: "active", neon_database_url: "" });
 const [saving, setSaving] = useState(false);

 const loadTenants = async () => { setLoading(true); const data = await api("/api/settings?entity=tenants"); setTenants(data.tenants || []); setLoading(false); };
 useEffect(() => { loadTenants(); }, []);

 const handleSave = async () => {
 setSaving(true);
 if (editingId) {
 await api("/api/settings?entity=tenants", "PUT", { id: editingId, ...form });
 } else {
 const autoId = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
 await api("/api/settings?entity=tenants", "POST", { id: autoId, ...form });
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
 await api(`/api/settings?entity=tenants&id=${id}`, "DELETE");
 loadTenants();
 };

 const openNewForm = () => {
 setShowForm(true); setEditingId(null);
 setForm({ name: "", address: "", phone: "", status: "active", neon_database_url: "" });
 };

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <p className="text-sm font-sans text-[#4FD1FF]/80">{tenants.length} Store</p>
 <div className="flex gap-2">
 <RefreshBtn onClick={loadTenants} />
 <Btn onClick={openNewForm}><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Tambah Store</span><span className="sm:hidden">Tambah</span></Btn>
 </div>
 </div>

 {/* Form */}
 {showForm && (
 <Card className="p-4 sm:p-5 space-y-4">
 <h3 className="text-sm font-sans font-bold text-[#4FD1FF]">{editingId ? "Edit Store" : "Tambah Store Baru"}</h3>
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
 <table className="w-full text-sm font-sans">
 <thead>
 <tr className="border-b border-[#4FD1FF]/10 bg-[#4FD1FF]/[0.03]">
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">NAMA</th>
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">ALAMAT</th>
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">DB</th>
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">STATUS</th>
 <th className="text-right px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">AKSI</th>
 </tr>
 </thead>
 <tbody>
 {tenants.map((t) => (
 <tr key={t.id} className="border-b border-[#4FD1FF]/8 hover:bg-white/[0.01] transition-colors">
 <td className="px-5 py-3.5">
 <p className="text-[#E5E7EB] font-medium">{t.name}</p>
 <p className="text-[10px] text-[#4FD1FF]/60">{t.id}</p>
 </td>
 <td className="px-5 py-3.5 text-[#4FD1FF] text-xs">{t.address || "—"}</td>
 <td className="px-5 py-3.5"><Badge variant={t.neon_database_url ? "purple" : "warning"}>{t.neon_database_url ? "Own DB" : "Master"}</Badge></td>
 <td className="px-5 py-3.5"><Badge variant={t.status === "active" ? "success" : "danger"}>{t.status}</Badge></td>
 <td className="px-5 py-3.5">
 <div className="flex gap-1.5 justify-end">
 <button onClick={() => handleEdit(t)} className="p-2 rounded-lg border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/30 hover:bg-[#4FD1FF]/8 transition-all">
 <Pencil className="h-3.5 w-3.5 text-[#4FD1FF]" />
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
 <p className="text-sm font-sans text-[#E5E7EB] font-medium truncate">{t.name}</p>
 </div>
 {t.address && <p className="text-[11px] font-sans text-[#4FD1FF]/60 mb-2 truncate">{t.address}</p>}
 <div className="flex gap-2">
 <Badge variant={t.neon_database_url ? "purple" : "warning"}>{t.neon_database_url ? "Own DB" : "Master"}</Badge>
 <Badge variant={t.status === "active" ? "success" : "danger"}>{t.status}</Badge>
 </div>
 </div>
 <div className="flex gap-1.5 shrink-0">
 <button onClick={() => handleEdit(t)} className="p-2 rounded-lg border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/30 transition-all">
 <Pencil className="h-3.5 w-3.5 text-[#4FD1FF]" />
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
