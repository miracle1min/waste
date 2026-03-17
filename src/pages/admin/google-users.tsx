import { useState, useEffect } from "react";
import { Trash2, Search, Globe } from "lucide-react";
import { api } from "./types";
import { Card, Badge, EmptyState, LoadingState, RefreshBtn } from "./shared";

interface GoogleUser {
 id: number;
 google_email: string;
 google_name: string;
 google_picture: string;
 user_id: number;
 username: string;
 display_name: string;
 role: string;
 tenant_id: string;
 linked_at: string;
 last_login: string;
}

export default function GoogleUsersPage() {
 const [googleUsers, setGoogleUsers] = useState<GoogleUser[]>([]);
 const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState("");

 const load = async () => {
 setLoading(true);
 const [gd, td] = await Promise.all([
 api("/api/auth/google?action=list"),
 api("/api/settings?entity=tenants"),
 ]);
 setGoogleUsers(gd.data || []);
 setTenants(td.tenants || []);
 setLoading(false);
 };
 useEffect(() => { load(); }, []);

 const getTenantName = (tid: string) => {
 if (tid === "ALL") return "Semua Store";
 return tenants.find((t) => t.id === tid)?.name || tid;
 };

 const handleUnlink = async (email: string) => {
 if (!confirm(`Yakin mau unlink akun Google "${email}"?`)) return;
 await api("/api/auth/google", "DELETE", { google_email: email });
 load();
 };

 const filtered = googleUsers.filter((g) => {
 const q = search.toLowerCase();
 return !q || g.google_email.toLowerCase().includes(q) || g.google_name.toLowerCase().includes(q) || g.username.toLowerCase().includes(q);
 });

 const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between gap-3">
 <p className="text-sm font-sans text-[#4FD1FF]/80">{googleUsers.length} Google User</p>
 <div className="flex gap-2">
 <RefreshBtn onClick={load} />
 </div>
 </div>

 <Card className="p-3 sm:p-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4FD1FF]/60" />
 <input
 type="text"
 placeholder="Cari email, nama, atau username..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#2A2D37]/[0.15] border border-[#4FD1FF]/10 text-sm font-sans text-[#E5E7EB] placeholder:text-[#6B7280] focus:outline-none focus:border-[#4FD1FF]/30/40 focus:ring-1 focus:ring-[#4FD1FF]/15 transition-all"
 />
 </div>
 </Card>

 {loading ? <LoadingState /> : filtered.length === 0 ? (
 <EmptyState icon={Globe} text={search ? "Tidak ada hasil pencarian." : "Belum ada Google user terhubung."} />
 ) : (
 <>
 {/* Desktop: Table */}
 <Card className="hidden sm:block overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-sm font-sans">
 <thead>
 <tr className="border-b border-[#4FD1FF]/10 bg-[#4FD1FF]/[0.03]">
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">GOOGLE ACCOUNT</th>
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">USERNAME</th>
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">ROLE</th>
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">STORE</th>
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">LINKED</th>
 <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">LAST LOGIN</th>
 <th className="text-right px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">AKSI</th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((g) => (
 <tr key={g.id} className="border-b border-[#4FD1FF]/8 hover:bg-[#2A2D37]/[0.08] transition-colors">
 <td className="px-5 py-3.5">
 <div className="flex items-center gap-3">
 <img src={g.google_picture} alt="" className="w-7 h-7 rounded-full ring-1 ring-[#4FD1FF]/10" referrerPolicy="no-referrer" />
 <div className="min-w-0">
 <p className="text-[#E5E7EB] font-medium text-xs truncate">{g.google_name}</p>
 <p className="text-[#4FD1FF]/60 text-[11px] truncate">{g.google_email}</p>
 </div>
 </div>
 </td>
 <td className="px-5 py-3.5 text-[#4FD1FF] text-xs">{g.username}</td>
 <td className="px-5 py-3.5">
 <Badge variant={g.role === "super_admin" ? "purple" : "blue"}>
 {g.role === "super_admin" ? "👑 Super Admin" : "🔍 QC"}
 </Badge>
 </td>
 <td className="px-5 py-3.5 text-[#4FD1FF] text-xs">{getTenantName(g.tenant_id)}</td>
 <td className="px-5 py-3.5 text-[#4FD1FF]/60 text-xs">{fmtDate(g.linked_at)}</td>
 <td className="px-5 py-3.5 text-[#4FD1FF]/60 text-xs">{fmtDate(g.last_login)}</td>
 <td className="px-5 py-3.5">
 <div className="flex gap-1.5 justify-end">
 <button onClick={() => handleUnlink(g.google_email)} className="p-2 rounded-lg border border-red-800/30 hover:border-red-500/40 hover:bg-red-500/5 transition-all" title="Unlink Google">
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
 {filtered.map((g) => (
 <Card key={g.id} className="p-4">
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-start gap-3 min-w-0 flex-1">
 <img src={g.google_picture} alt="" className="w-9 h-9 rounded-full ring-1 ring-[#4FD1FF]/10 shrink-0" referrerPolicy="no-referrer" />
 <div className="min-w-0 flex-1">
 <p className="text-sm font-sans text-[#E5E7EB] font-medium truncate">{g.google_name}</p>
 <p className="text-[11px] font-sans text-[#4FD1FF]/60 truncate">{g.google_email}</p>
 <p className="text-[11px] font-sans text-[#4FD1FF]/80 mt-0.5">@{g.username} · {getTenantName(g.tenant_id)}</p>
 <div className="flex flex-wrap items-center gap-2 mt-2">
 <Badge variant={g.role === "super_admin" ? "purple" : "blue"}>
 {g.role === "super_admin" ? "👑 Super Admin" : "🔍 QC"}
 </Badge>
 <span className="text-[10px] font-sans text-[#4FD1FF]/60">Linked {fmtDate(g.linked_at)}</span>
 <span className="text-[10px] font-sans text-[#4FD1FF]/60">Login {fmtDate(g.last_login)}</span>
 </div>
 </div>
 </div>
 <div className="shrink-0">
 <button onClick={() => handleUnlink(g.google_email)} className="p-2 rounded-lg border border-red-800/30 transition-all" title="Unlink Google">
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
