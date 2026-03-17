import { useState, useEffect } from "react";
import { Save, Loader2, Eye, EyeOff, Database, KeyRound, FileSpreadsheet, Cloud } from "lucide-react";
import { api, Tenant, TenantConfig } from "./types";
import { Card, CardHeader, Select, Btn, EmptyState, SkeletonLoader, RefreshBtn, CollapsibleSection, HeroBanner, Badge, PageHeader } from "./shared";

export default function ConfigsPage() {
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
    const [td, cd] = await Promise.all([api("/api/settings?entity=tenants"), api("/api/settings?entity=configs")]);
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
    await api("/api/settings?entity=configs", "POST", { tenant_id: selectedTenant, ...form });
    await load(); setSaving(false);
  };

  const toggleSecret = (key: string) => setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));

  const configSections = [
    {
      title: "Google Sheets", icon: FileSpreadsheet,
      desc: "Konfigurasi Google Sheets untuk penyimpanan data waste",
      fields: [
        { key: "google_spreadsheet_id", label: "Spreadsheet ID", placeholder: "1ABC...xyz", secret: false, hint: "ID dari Google Sheet khusus store ini" },
        { key: "google_sheets_credentials", label: "Service Account JSON", placeholder: "{...service account JSON...}", secret: true, hint: "Service Account JSON buat akses Google Sheets" },
      ]
    },
    {
      title: "Cloudflare R2", icon: Cloud,
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

  if (loading) return (
    <div className="space-y-5">
      <div className="h-24 rounded-2xl bg-[#4FD1FF]/5 border border-[#4FD1FF]/10 animate-pulse" />
      <SkeletonLoader rows={3} type="list" />
    </div>
  );

  const configuredCount = configs.length;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <HeroBanner icon={KeyRound} title="Config Management" subtitle={`${configuredCount} store terkonfigurasi dari ${tenants.length} total`} />

      <PageHeader title="Konfigurasi per-Store" subtitle="Pilih store untuk edit config">
        <RefreshBtn onClick={load} />
      </PageHeader>

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
                <CollapsibleSection key={section.title} title={section.title} icon={section.icon} defaultOpen={true}>
                  <div className="px-1 pb-1">
                    <p className="text-[10px] font-sans text-[#4FD1FF]/60 px-4 sm:px-5 pt-2 pb-3">{section.desc}</p>
                    <div className="p-4 sm:p-5 pt-0 space-y-4">
                      {section.fields.map((field) => (
                        <div key={field.key}>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-sans text-[#4FD1FF]/80">{field.label}</label>
                            {field.secret && (
                              <button onClick={() => toggleSecret(field.key)} className="text-[10px] font-sans text-[#4FD1FF]/60 hover:text-[#4FD1FF] flex items-center gap-1 transition-colors">
                                {showSecrets[field.key] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                {showSecrets[field.key] ? "Hide" : "Show"}
                              </button>
                            )}
                          </div>
                          <input
                            type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                            value={(form as any)[field.key]}
                            onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                            className="w-full h-11 px-3.5 bg-[#1A1C22]/60 border border-[#4FD1FF]/15 rounded-xl font-sans text-sm text-[#E5E7EB] placeholder:text-[#6B7280] focus:border-[#4FD1FF]/40 focus:ring-1 focus:ring-[#4FD1FF]/15 focus:outline-none transition-all"
                            placeholder={field.placeholder}
                          />
                          {field.hint && <p className="text-[10px] font-sans text-[#4FD1FF]/60 mt-1">{field.hint}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleSection>
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
                  <table className="w-full text-sm font-sans">
                    <thead>
                      <tr className="border-b border-[#4FD1FF]/10 bg-gradient-to-r from-[#4FD1FF]/[0.03] to-transparent">
                        <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">RESTO</th>
                        <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">SHEET ID</th>
                        <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">R2 BUCKET</th>
                        <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">UPDATED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configs.map((c) => {
                        const tenant = tenants.find((t) => t.id === c.tenant_id);
                        return (
                          <tr key={c.tenant_id} onClick={() => handleSelectTenant(c.tenant_id)}
                            className="border-b border-[#4FD1FF]/8 hover:bg-[#4FD1FF]/[0.02] cursor-pointer transition-colors">
                            <td className="px-5 py-3.5 text-[#E5E7EB] font-medium">{tenant?.name || c.tenant_id}</td>
                            <td className="px-5 py-3.5 text-[#4FD1FF] text-xs">{c.google_spreadsheet_id ? c.google_spreadsheet_id.substring(0, 15) + "..." : "—"}</td>
                            <td className="px-5 py-3.5 text-[#4FD1FF] text-xs">{c.r2_bucket_name || "—"}</td>
                            <td className="px-5 py-3.5 text-[#4FD1FF]/60 text-xs">{c.updated_at ? new Date(c.updated_at).toLocaleDateString("id-ID") : "—"}</td>
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
                    <Card key={c.tenant_id} hover className="p-4" onClick={() => handleSelectTenant(c.tenant_id)}>
                      <p className="text-sm font-sans text-[#E5E7EB] font-medium">{tenant?.name || c.tenant_id}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] font-sans text-[#4FD1FF]/60">
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
