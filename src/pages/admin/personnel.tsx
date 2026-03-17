import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X, Loader2, Upload, UserCheck } from "lucide-react";
import { api, Tenant, Personnel } from "./types";
import { Card, Badge, Input, Select, Btn, EmptyState, LoadingState, RefreshBtn } from "./shared";

export default function PersonnelPage() {
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

 const load = async () => { setLoading(true); const td = await api("/api/settings?entity=tenants"); setTenants(td.tenants || []); setLoading(false); };
 const loadPersonnel = async (tid: string) => {
 if (!tid) { setPersonnel([]); return; }
 const data = await api(`/api/settings?entity=personnel&tenant_id=${tid}`);
 setPersonnel(data.personnel || []);
 };
 useEffect(() => { load(); }, []);

 const handleSelectTenant = (tid: string) => { setSelectedTenant(tid); setShowForm(false); setEditingId(null); loadPersonnel(tid); };

 const handleSave = async () => {
 if (!selectedTenant) return;
 setSaving(true);
 if (editingId) { await api(`/api/settings?entity=personnel&id=${editingId}`, "PUT", form); }
 else { await api("/api/settings?entity=personnel", "POST", { tenant_id: selectedTenant, ...form }); }
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
 const result = await api("/api/settings?entity=configs", "POST", {
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
 await api(`/api/settings?entity=personnel&id=${id}`, "DELETE");
 loadPersonnel(selectedTenant);
 };

 const filtered = filter === "all" ? personnel : personnel.filter((p) => p.role === filter);
 const qcCount = personnel.filter((p) => p.role === "qc").length;
 const mgrCount = personnel.filter((p) => p.role === "manager").length;

 if (loading) return <LoadingState />;

 return (
 <div className="space-y-4">
 <p className="text-sm font-sans text-[#4FD1FF]/80">QC & Manajer per Store</p>

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
 className={`shrink-0 px-3 py-2 rounded-xl font-sans text-xs transition-all border ${filter === key ? "border-[#4FD1FF]/30 bg-[#4FD1FF]/8 text-[#E5E7EB]" : "border-[#4FD1FF]/10 text-[#4FD1FF]/60 hover:text-[#4FD1FF]"}`}>
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
 <h3 className="text-sm font-sans font-bold text-[#4FD1FF]">{editingId ? "Edit Personil" : "Tambah Personil Baru"}</h3>
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
 <label className="block text-[11px] font-sans text-[#4FD1FF]/80 mb-2">Upload TTD / Tanda Tangan</label>
 <div className="flex flex-wrap items-center gap-3">
 <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${uploading ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" : "border-[#4FD1FF]/10 bg-[#1A1C22]/40 text-[#4FD1FF] hover:border-[#4FD1FF]/30"}`}>
 {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
 <span className="font-sans text-sm">{uploading ? "Uploading..." : "Pilih File"}</span>
 <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={uploading} />
 </label>
 {(previewUrl || form.signature_url) && (
 <div className="flex items-center gap-3">
 <div className="w-16 h-12 rounded-lg border border-[#4FD1FF]/10 bg-[#2A2D37]/30 overflow-hidden flex items-center justify-center">
 <img src={previewUrl || `/api/proxy-image?url=${encodeURIComponent(form.signature_url)}&tenant_id=${selectedTenant}`}
 alt="TTD" className="w-full h-full object-contain p-1"
 onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
 </div>
 <p className="text-[11px] font-sans text-green-400">✅ TTD Ready</p>
 </div>
 )}
 </div>
 <p className="text-[10px] font-sans text-[#4FD1FF]/60 mt-1.5">Upload gambar TTD (JPG/PNG). Otomatis ke R2 bucket.</p>
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
 <Card key={p.id} className="p-4 hover:border-[#4FD1FF]/15 transition-all">
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0">
 {/* Signature thumbnail */}
 <div className="w-14 h-11 rounded-lg border border-[#4FD1FF]/10 bg-[#2A2D37]/30 flex items-center justify-center overflow-hidden shrink-0">
 {p.signature_url ? (
 <img src={`/api/proxy-image?url=${encodeURIComponent(p.signature_url)}&tenant_id=${selectedTenant}`}
 alt="TTD" className="w-full h-full object-contain p-0.5"
 onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
 ) : (
 <span className="text-[9px] font-sans text-[#6B7280]">No TTD</span>
 )}
 </div>
 <div className="min-w-0">
 <p className="text-sm font-sans text-[#E5E7EB] font-medium truncate">{p.full_name || p.name}</p>
 <p className="text-[10px] font-sans text-[#4FD1FF]/60">key: {p.name}</p>
 <div className="flex gap-1.5 mt-1.5">
 <Badge variant={p.role === "qc" ? "success" : "purple"}>{p.role === "qc" ? "🔍 QC" : "👔 MGR"}</Badge>
 <Badge variant={p.status === "active" ? "default" : "danger"}>{p.status}</Badge>
 </div>
 </div>
 </div>
 <div className="flex gap-1.5 shrink-0">
 <button onClick={() => handleEdit(p)} className="p-2 rounded-lg border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/30 transition-all">
 <Pencil className="h-3.5 w-3.5 text-[#4FD1FF]" />
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
