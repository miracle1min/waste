import { useState, useEffect } from "react";
import { Building2, UserCog, KeyRound, Server, ChevronRight, Crown, Activity, Globe } from "lucide-react";
import { api, Tenant, PageKey } from "./types";
import { Card, Badge, Btn, StatCard, HeroBanner, CollapsibleSection, SkeletonLoader, PageHeader } from "./shared";

export default function OverviewPage({ onNavigate }: { onNavigate: (key: PageKey) => void }) {
  const [stats, setStats] = useState({ tenants: 0, users: 0, configs: 0, tenantsWithDb: 0, googleUsers: 0, activeStores: 0 });
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [td, ud, cd] = await Promise.all([
          api("/api/settings?entity=tenants"),
          api("/api/settings?entity=users"),
          api("/api/settings?entity=configs"),
        ]);
        const tList = td.tenants || [];
        const uList = ud.users || [];
        const cList = cd.configs || [];
        setTenants(tList);
        setStats({
          tenants: tList.length,
          users: uList.length,
          configs: cList.length,
          tenantsWithDb: tList.filter((t: Tenant) => t.neon_database_url).length,
          googleUsers: 0,
          activeStores: tList.filter((t: Tenant) => t.status === "active").length,
        });
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#4FD1FF]/10 bg-[#1A1C22]/40 p-6 animate-pulse">
          <div className="h-6 w-48 rounded-lg bg-[#4FD1FF]/8 mb-2" />
          <div className="h-4 w-72 rounded bg-[#4FD1FF]/5" />
        </div>
        <SkeletonLoader type="stats" />
        <SkeletonLoader rows={4} type="list" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <HeroBanner
        icon={Crown}
        title="Selamat datang, Admin! 👑"
        subtitle="Semua kontrol ada di tangan lo. Kelola store, user, dan konfigurasi dari sini."
      />

      {/* Quick Stats Strip */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {[
          { label: "Active", value: stats.activeStores, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          { label: "Isolated DB", value: stats.tenantsWithDb, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
          { label: "Configured", value: stats.configs, color: "text-[#4FD1FF]", bg: "bg-[#4FD1FF]/8 border-[#4FD1FF]/20" },
        ].map((item) => (
          <div key={item.label} className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border ${item.bg}`}>
            <span className={`text-lg font-bold font-sans ${item.color}`}>{item.value}</span>
            <span className="text-[10px] font-sans text-[#4FD1FF]/60">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Store" value={stats.tenants} icon={Building2} color="cyan" sub={`${stats.activeStores} aktif`} onClick={() => onNavigate("tenants")} />
        <StatCard label="Users" value={stats.users} icon={UserCog} color="blue" sub="Semua store" onClick={() => onNavigate("users")} />
        <StatCard label="Config" value={stats.configs} icon={KeyRound} color="green" sub={`dari ${stats.tenants} store`} onClick={() => onNavigate("configs")} />
        <StatCard label="DB Isolated" value={stats.tenantsWithDb} icon={Server} color="purple" sub={`dari ${stats.tenants} store`} onClick={() => onNavigate("database")} />
      </div>

      {/* Store List */}
      <CollapsibleSection title="Daftar Store" icon={Building2} badge={`${tenants.length}`}>
        <div className="px-1 pb-1">
          {/* Quick action */}
          <div className="px-4 sm:px-5 pt-2 pb-3 flex justify-end">
            <Btn variant="ghost" size="sm" onClick={() => onNavigate("tenants")}>
              Kelola Store <ChevronRight className="h-3 w-3" />
            </Btn>
          </div>
          <div className="divide-y divide-[rgba(79,209,255,0.08)]">
            {tenants.map((t) => (
              <div key={t.id} className="px-4 sm:px-5 py-3.5 flex items-center justify-between hover:bg-[#4FD1FF]/[0.02] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.status === "active" ? "bg-green-400" : "bg-red-400"}`} />
                    {t.status === "active" && (
                      <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-30" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-sans text-[#E5E7EB] truncate">{t.name}</p>
                    <p className="text-[10px] font-sans text-[#4FD1FF]/60 truncate">{t.address || "Alamat belum diisi"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={t.neon_database_url ? "purple" : "warning"}>
                    {t.neon_database_url ? "Own DB" : "Master"}
                  </Badge>
                  <Badge variant={t.status === "active" ? "success" : "danger"}>
                    {t.status}
                  </Badge>
                </div>
              </div>
            ))}
            {tenants.length === 0 && (
              <div className="px-4 py-10 text-center text-sm font-sans text-[#4FD1FF]/60">Belum ada store</div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Activity Log", icon: Activity, page: "activity" as PageKey, desc: "Riwayat aktivitas" },
          { label: "Google Users", icon: Globe, page: "google-users" as PageKey, desc: "Akun OAuth" },
          { label: "QC & Manager", icon: UserCog, page: "personnel" as PageKey, desc: "Personil & TTD" },
          { label: "Database", icon: Server, page: "database" as PageKey, desc: "DB management" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} hover onClick={() => onNavigate(item.page)} className="p-3.5 sm:p-4">
              <div className="w-8 h-8 rounded-lg bg-[#4FD1FF]/8 flex items-center justify-center mb-2">
                <Icon className="h-4 w-4 text-[#4FD1FF]/80" />
              </div>
              <p className="text-xs font-sans font-medium text-[#E5E7EB]">{item.label}</p>
              <p className="text-[10px] font-sans text-[#4FD1FF]/60 mt-0.5">{item.desc}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
