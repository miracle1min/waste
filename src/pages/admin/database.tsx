import { useState, useEffect } from "react";
import { Loader2, Zap, CheckCircle, AlertCircle, Server } from "lucide-react";
import { api, Tenant } from "./types";
import { Card, CardHeader, Badge, Select, Btn, LoadingState } from "./shared";

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
