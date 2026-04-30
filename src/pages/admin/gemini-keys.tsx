import { useState, useEffect } from "react";
import { Plus, Trash2, Save, X, Loader2, Key, Eye, EyeOff, ToggleLeft, ToggleRight, Sparkles } from "lucide-react";
import { api } from "./types";
import { Card, Btn, EmptyState, SkeletonLoader, RefreshBtn, CollapsibleSection, HeroBanner, PageHeader } from "./shared";

interface GeminiKey {
  id: number;
  key_name: string;
  api_key_masked: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function GeminiKeysPage() {
  const [keys, setKeys] = useState<GeminiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key_name: "", api_key: "" });
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await api("/api/settings?entity=gemini-keys");
    setKeys(data.keys || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.key_name.trim() || !form.api_key.trim()) return;
    setSaving(true);
    await api("/api/settings?entity=gemini-keys", "POST", form);
    setSaving(false);
    setShowForm(false);
    setForm({ key_name: "", api_key: "" });
    load();
  };

  const handleToggle = async (k: GeminiKey) => {
    await api(`/api/settings?entity=gemini-keys&id=${k.id}`, "PUT", { is_active: !k.is_active });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin mau hapus API key ini?")) return;
    await api(`/api/settings?entity=gemini-keys&id=${id}`, "DELETE");
    load();
  };

  const activeCount = keys.filter(k => k.is_active).length;

  return (
    <div className="space-y-5">
      <HeroBanner
        icon={Sparkles}
        title="Gemini API Keys"
        subtitle={`${keys.length} key — ${activeCount} aktif · Sticky Pool Rotation`}
      />

      <PageHeader
        title="API Key Pool"
        count={keys.length}
        subtitle="Kelola API key Gemini untuk rotasi otomatis"
      >
        <Btn onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Tambah Key</span>
          <span className="sm:hidden">Tambah</span>
        </Btn>
        <RefreshBtn onClick={load} loading={loading} />
      </PageHeader>

      {/* Info Banner */}
      <div className="rounded-xl border border-[#4FD1FF]/15 bg-[#4FD1FF]/5 px-4 py-3 text-xs text-[#4FD1FF]/80 space-y-1">
        <p className="font-bold text-[#4FD1FF]">🔄 Sticky Pool Strategy</p>
        <p>Setiap user selalu dapat API key yang sama (berdasarkan userId + tenantId + tanggal). Kalau key gagal/quota habis, otomatis fallback ke key berikutnya.</p>
        <p className="text-[#9CA3AF]">Key disimpan terenkripsi di database. Hanya tampil sebagian (masked).</p>
      </div>

      {/* Add Form */}
      {showForm && (
        <CollapsibleSection title="Tambah API Key Baru" icon={Key} defaultOpen={true}>
          <div className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-[#9CA3AF]">Nama Key</label>
                <input
                  type="text"
                  value={form.key_name}
                  onChange={e => setForm(f => ({ ...f, key_name: e.target.value }))}
                  placeholder="contoh: akun-gmail-1"
                  className="w-full rounded-xl border border-[#4FD1FF]/20 bg-[#23262F] px-3 py-2 text-sm font-sans text-[#E5E7EB] outline-none focus:border-[#4FD1FF]/50 placeholder:text-[#4B5563]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-[#9CA3AF]">API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={form.api_key}
                    onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                    placeholder="AIzaSy..."
                    className="w-full rounded-xl border border-[#4FD1FF]/20 bg-[#23262F] px-3 py-2 pr-10 text-sm font-sans text-[#E5E7EB] outline-none focus:border-[#4FD1FF]/50 placeholder:text-[#4B5563]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-[#9CA3AF]"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Btn onClick={() => { setShowForm(false); setForm({ key_name: "", api_key: "" }); }}>
                <X className="h-4 w-4" /> Batal
              </Btn>
              <Btn onClick={handleSave} disabled={saving || !form.key_name.trim() || !form.api_key.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan
              </Btn>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Keys List */}
      {loading ? (
        <SkeletonLoader rows={3} />
      ) : keys.length === 0 ? (
        <EmptyState icon={Key} text="Belum ada API key. Tambah dulu!" />
      ) : (
        <div className="space-y-2">
          {keys.map((k, idx) => (
            <Card key={k.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Index badge */}
                  <div className="w-7 h-7 rounded-lg bg-[#4FD1FF]/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-[#4FD1FF]">#{idx + 1}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-sans font-bold text-[#E5E7EB] truncate">{k.key_name}</p>
                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                        k.is_active
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-[#374151] text-[#6B7280] border border-[#374151]"
                      }`}>
                        {k.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-[#6B7280] mt-0.5">{k.api_key_masked}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Toggle active */}
                  <button
                    onClick={() => handleToggle(k)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      k.is_active
                        ? "text-green-400 hover:bg-green-500/10"
                        : "text-[#6B7280] hover:bg-[#374151]"
                    }`}
                    title={k.is_active ? "Nonaktifkan" : "Aktifkan"}
                  >
                    {k.is_active
                      ? <ToggleRight className="h-5 w-5" />
                      : <ToggleLeft className="h-5 w-5" />
                    }
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(k.id)}
                    className="p-1.5 rounded-lg text-[#6B7280] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
