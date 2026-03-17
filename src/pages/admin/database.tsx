import { useState, useEffect } from "react";
import { Loader2, Zap, CheckCircle, AlertCircle, Server, Database as DatabaseIcon, ExternalLink } from "lucide-react";
import { api, Tenant } from "./types";
import { Card, Badge, Select, Btn, SkeletonLoader, HeroBanner, CollapsibleSection, AnimatedCounter, PageHeader } from "./shared";

export default function DatabasePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      const td = await api("/api/settings?entity=tenants");
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
      const result = await api("/api/settings?entity=configs", "POST", { action: "seed-tenant-db", tenant_id: selectedTenant });
      setSeedResult(result);
    } catch (err: any) {
      setSeedResult({ ok: false, message: err.message });
    }
    setSeeding(false);
  };

  const isolatedCount = tenants.filter(t => t.neon_database_url).length;
  const masterCount = tenants.length - isolatedCount;

  if (loading) return (
    <div className="space-y-5">
      <div className="h-24 rounded-2xl bg-purple-500/5 border border-purple-500/10 animate-pulse" />
      <SkeletonLoader rows={3} type="list" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Hero */}
      <HeroBanner icon={Server} title="Database Management" subtitle={`${isolatedCount} isolated DB, ${masterCount} pakai master`} variant="purple" />

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Store", value: tenants.length, color: "text-[#4FD1FF]", bg: "bg-[#4FD1FF]/8 border-[#4FD1FF]/20" },
          { label: "Isolated", value: isolatedCount, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
          { label: "Master", value: masterCount, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
        ].map((item) => (
          <div key={item.label} className={`rounded-xl border p-3 text-center ${item.bg}`}>
            <p className={`text-xl font-bold font-sans ${item.color}`}><AnimatedCounter value={item.value} /></p>
            <p className="text-[10px] font-sans text-[#4FD1FF]/60 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Seed Section */}
      <CollapsibleSection title="Seed Tenant Database" icon={Zap} defaultOpen={true}>
        <div className="p-4 sm:p-5 space-y-4">
          <p className="text-[11px] font-sans text-[#4FD1FF]/60">Bikin tabel (users, personnel, tenant_configs) di database baru</p>
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
                <div className="rounded-xl border border-[#4FD1FF]/10 bg-[#1A1C22]/40 p-3.5">
                  <p className="text-xs font-sans text-[#4FD1FF]">📍 {tenant.name}</p>
                  <p className="text-[11px] font-sans text-[#4FD1FF]/60 mt-0.5">
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
                  <div className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm font-sans ${seedResult.ok ? "bg-green-500/10 border border-green-500/15 text-green-400" : "bg-red-500/10 border border-red-500/15 text-red-400"}`}>
                    {seedResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                    <p className="text-xs">{seedResult.message}</p>
                  </div>
                )}
              </div>
            ) : null;
          })()}
        </div>
      </CollapsibleSection>

      {/* DB Status Overview */}
      <CollapsibleSection title="Status per Store" icon={DatabaseIcon} badge={`${tenants.length}`}>
        <div className="divide-y divide-[rgba(79,209,255,0.08)]">
          {tenants.map((t) => (
            <div key={t.id} className="px-4 sm:px-5 py-3.5 flex items-center justify-between hover:bg-[#4FD1FF]/[0.02] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${t.neon_database_url ? "bg-gradient-to-br from-purple-500/10 to-purple-900/10 border border-purple-500/20" : "bg-gradient-to-br from-yellow-500/10 to-yellow-900/10 border border-yellow-500/20"}`}>
                  <Server className={`h-4 w-4 ${t.neon_database_url ? "text-purple-400" : "text-yellow-400"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-sans text-[#E5E7EB] truncate">{t.name}</p>
                  <p className="text-[10px] font-sans text-[#4FD1FF]/60">{t.id}</p>
                </div>
              </div>
              <Badge variant={t.neon_database_url ? "purple" : "warning"}>
                {t.neon_database_url ? "Isolated" : "Master"}
              </Badge>
            </div>
          ))}
          {tenants.length === 0 && (
            <div className="px-4 py-10 text-center text-sm font-sans text-[#4FD1FF]/60">Belum ada store</div>
          )}
        </div>
      </CollapsibleSection>

      {/* Tips */}
      <Card className="p-4 sm:p-5">
        <p className="text-xs font-sans text-[#4FD1FF]/80 font-bold mb-2">💡 Tips</p>
        <ul className="space-y-1.5 text-[11px] font-sans text-[#4FD1FF]/60">
          <li className="flex items-start gap-2">
            <span className="shrink-0">•</span>
            <span>Bikin Neon project baru di <a href="https://neon.tech" target="_blank" className="text-purple-400 hover:underline inline-flex items-center gap-0.5">neon.tech <ExternalLink className="h-2.5 w-2.5" /></a> (gratis!)</span>
          </li>
          <li className="flex items-start gap-2"><span className="shrink-0">•</span><span>Copy connection string → paste di halaman Store → Neon Database URL</span></li>
          <li className="flex items-start gap-2"><span className="shrink-0">•</span><span>Balik ke sini → pilih store → klik "Seed Tenant DB"</span></li>
          <li className="flex items-start gap-2"><span className="shrink-0">•</span><span>Pastikan pakai <code className="text-[#4FD1FF] bg-[#4FD1FF]/8 px-1 rounded">?sslmode=require</code></span></li>
        </ul>
      </Card>
    </div>
  );
}
