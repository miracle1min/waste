import { useState, useEffect } from "react";
import { Building2, UserCog, KeyRound, Server, ChevronRight } from "lucide-react";
import { api, Tenant, PageKey } from "./types";
import { Card, CardHeader, Badge, Btn, LoadingState } from "./shared";

export default function OverviewPage({ onNavigate }: { onNavigate: (key: PageKey) => void }) {
 const [stats, setStats] = useState({ tenants: 0, users: 0, configs: 0, tenantsWithDb: 0 });
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
 setTenants(tList);
 setStats({
 tenants: tList.length,
 users: (ud.users || []).length,
 configs: (cd.configs || []).length,
 tenantsWithDb: tList.filter((t: Tenant) => t.neon_database_url).length,
 });
 } catch {}
 setLoading(false);
 })();
 }, []);

 if (loading) return <LoadingState />;

 const cards = [
 { label: "Store", value: stats.tenants, icon: Building2, color: "cyan" as const, sub: `${stats.tenantsWithDb} punya own DB`, page: "tenants" as PageKey },
 { label: "Users", value: stats.users, icon: UserCog, color: "blue" as const, sub: "Semua store", page: "users" as PageKey },
 { label: "Config", value: stats.configs, icon: KeyRound, color: "green" as const, sub: `dari ${stats.tenants} store`, page: "configs" as PageKey },
 { label: "DB Isolated", value: stats.tenantsWithDb, icon: Server, color: "purple" as const, sub: `dari ${stats.tenants} store`, page: "database" as PageKey },
 ];

 const colorStyles: Record<string, { card: string; icon: string; value: string }> = {
 cyan: { card: "border-[#4FD1FF]/20 bg-gradient-to-br from-[#4FD1FF]/5 to-transparent", icon: "text-[#4FD1FF] bg-[#4FD1FF]/8", value: "text-[#E5E7EB]" },
 blue: { card: "border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent", icon: "text-blue-400 bg-blue-500/10", value: "text-blue-200" },
 green: { card: "border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent", icon: "text-green-400 bg-green-500/10", value: "text-green-200" },
 purple: { card: "border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent", icon: "text-purple-400 bg-purple-500/10", value: "text-purple-200" },
 };

 return (
 <div className="space-y-6">
 {/* Welcome Banner */}
 <div className="rounded-2xl border border-[#4FD1FF]/15 bg-gradient-to-br from-[#4FD1FF]/5 via-[#9F7AEA]/[0.03] to-[#9F7AEA]/5 p-5 sm:p-6">
 <h2 className="text-lg sm:text-xl font-bold font-sans text-transparent bg-clip-text bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA]">
 Selamat datang, Admin! 👑
 </h2>
 <p className="text-xs sm:text-sm text-[#4FD1FF]/60 font-sans mt-1">
 Semua kontrol ada di tangan lo. Kelola store, user, dan konfigurasi dari sini.
 </p>
 </div>

 {/* Stats Grid */}
 <div className="grid grid-cols-2 gap-3 sm:gap-4">
 {cards.map((card) => {
 const Icon = card.icon;
 const style = colorStyles[card.color];
 return (
 <button
 key={card.label}
 onClick={() => onNavigate(card.page)}
 className={`rounded-2xl border p-4 sm:p-5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${style.card}`}
 >
 <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-3 ${style.icon}`}>
 <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
 </div>
 <p className={`text-2xl sm:text-3xl font-bold font-sans ${style.value}`}>{card.value}</p>
 <p className="text-xs font-sans mt-1 text-[#4FD1FF]">{card.label}</p>
 <p className="text-[10px] font-sans mt-0.5 text-[#4FD1FF]/60">{card.sub}</p>
 </button>
 );
 })}
 </div>

 {/* Store List */}
 <Card>
 <CardHeader action={
 <Btn variant="ghost" size="sm" onClick={() => onNavigate("tenants")}>
 Lihat Semua <ChevronRight className="h-3 w-3" />
 </Btn>
 }>
 <h3 className="text-sm font-sans font-bold text-[#4FD1FF]">Daftar Store</h3>
 </CardHeader>
 <div className="divide-y divide-[rgba(79,209,255,0.08)]">
 {tenants.map((t) => (
 <div key={t.id} className="px-4 sm:px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
 <div className="flex items-center gap-3 min-w-0">
 <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.status === "active" ? "bg-green-400 " : "bg-red-400"}`} />
 <div className="min-w-0">
 <p className="text-sm font-sans text-[#E5E7EB] truncate">{t.name}</p>
 <p className="text-[10px] font-sans text-[#4FD1FF]/60 truncate">{t.address || "Alamat belum diisi"}</p>
 </div>
 </div>
 <Badge variant={t.neon_database_url ? "purple" : "warning"}>
 {t.neon_database_url ? "Own DB" : "Master"}
 </Badge>
 </div>
 ))}
 {tenants.length === 0 && (
 <div className="px-4 py-10 text-center text-sm font-sans text-[#4FD1FF]/60">Belum ada store</div>
 )}
 </div>
 </Card>
 </div>
 );
}
