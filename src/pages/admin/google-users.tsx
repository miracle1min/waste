import { useState, useEffect } from "react";
import { Trash2, Search, Globe, CheckCircle, XCircle, Clock, ShieldCheck, ShieldX, Filter, Database } from "lucide-react";
import { api } from "./types";
import { Card, Badge, EmptyState, SkeletonLoader, RefreshBtn, HeroBanner, PageHeader } from "./shared";

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
  status: string;
  linked_at: string;
  last_login: string;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function GoogleUsersPage() {
  const [googleUsers, setGoogleUsers] = useState<GoogleUser[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupDone, setSetupDone] = useState(false);

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

  const handleSetup = async () => {
    setSetupLoading(true);
    try {
      await api("/api/auth/google?action=setup");
      setSetupDone(true);
      await load();
    } catch (err) {
      console.error("Setup error:", err);
    }
    setSetupLoading(false);
  };

  const handleApprove = async (email: string) => {
    setActionLoading(email);
    try {
      await api("/api/auth/google", "POST", { action: "approve", google_email: email });
      await load();
    } catch (err) {
      console.error("Approve error:", err);
    }
    setActionLoading(null);
  };

  const handleReject = async (email: string) => {
    if (!confirm(`Yakin mau tolak akun "${email}"?`)) return;
    setActionLoading(email);
    try {
      await api("/api/auth/google", "POST", { action: "reject", google_email: email });
      await load();
    } catch (err) {
      console.error("Reject error:", err);
    }
    setActionLoading(null);
  };

  const handleUnlink = async (email: string) => {
    if (!confirm(`Yakin mau hapus & unlink akun Google "${email}"? User tidak bisa login Google lagi.`)) return;
    setActionLoading(email);
    try {
      await api("/api/auth/google", "DELETE", { google_email: email });
      await load();
    } catch (err) {
      console.error("Unlink error:", err);
    }
    setActionLoading(null);
  };

  const pendingCount = googleUsers.filter(g => (g.status || "approved") === "pending").length;
  const approvedCount = googleUsers.filter(g => (g.status || "approved") === "approved").length;
  const rejectedCount = googleUsers.filter(g => (g.status || "approved") === "rejected").length;

  const filtered = googleUsers.filter((g) => {
    const q = search.toLowerCase();
    const matchSearch = !q || g.google_email.toLowerCase().includes(q) || g.google_name?.toLowerCase().includes(q) || g.username.toLowerCase().includes(q);
    const status = g.status || "approved";
    const matchStatus = statusFilter === "all" || status === statusFilter;
    return matchSearch && matchStatus;
  });

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";

  const getStatusBadge = (status: string) => {
    const s = status || "approved";
    if (s === "pending") return <Badge variant="warning">⏳ Pending</Badge>;
    if (s === "approved") return <Badge variant="success">✅ Approved</Badge>;
    if (s === "rejected") return <Badge variant="danger">❌ Rejected</Badge>;
    return <Badge>{s}</Badge>;
  };

  const statusFilters: { key: StatusFilter; label: string; count: number; color: string }[] = [
    { key: "all", label: "Semua", count: googleUsers.length, color: "#4FD1FF" },
    { key: "pending", label: "Pending", count: pendingCount, color: "#F59E0B" },
    { key: "approved", label: "Approved", count: approvedCount, color: "#4ADE80" },
    { key: "rejected", label: "Rejected", count: rejectedCount, color: "#F87171" },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <HeroBanner
        icon={Globe}
        title="Google Users"
        subtitle={`${googleUsers.length} akun terhubung${pendingCount > 0 ? ` · ${pendingCount} menunggu approval` : ""}`}
      />

      {/* Pending Alert Banner */}
      {pendingCount > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-[#F59E0B]/10 via-[#F59E0B]/5 to-transparent border border-[#F59E0B]/20 p-4 flex items-center gap-3 animate-pulse-slow">
          <div className="h-10 w-10 rounded-xl bg-[#F59E0B]/15 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-[#F59E0B]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#F59E0B]">{pendingCount} Akun Menunggu Approval</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Ada user baru yang daftar via Google dan perlu persetujuan kamu.</p>
          </div>
          <button
            onClick={() => setStatusFilter("pending")}
            className="px-3 py-1.5 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-xs text-[#F59E0B] font-medium hover:bg-[#F59E0B]/25 transition-all shrink-0"
          >
            Lihat
          </button>
        </div>
      )}

      <PageHeader title="Daftar Google User" count={googleUsers.length}>
        <button
          onClick={handleSetup}
          disabled={setupLoading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 ${
            setupDone
              ? "bg-green-500/15 border-green-500/30 text-green-300"
              : "bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25"
          }`}
        >
          <Database className={`h-3.5 w-3.5 ${setupLoading ? "animate-spin" : ""}`} />
          {setupLoading ? "Migrating..." : setupDone ? "✓ Migrated" : "Setup / Migrate Table"}
        </button>
        <RefreshBtn onClick={load} />
      </PageHeader>

      {/* Status Filter Pills */}
      <div className="flex gap-2 flex-wrap">
        {statusFilters.map(sf => (
          <button
            key={sf.key}
            onClick={() => setStatusFilter(sf.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 ${
              statusFilter === sf.key
                ? "border-[rgba(79,209,255,0.3)] bg-[#4FD1FF]/10 text-[#E5E7EB] shadow-[0_0_8px_rgba(79,209,255,0.15)]"
                : "border-[rgba(79,209,255,0.08)] bg-[#23262F] text-[#9CA3AF] hover:border-[rgba(79,209,255,0.2)] hover:text-[#E5E7EB]"
            }`}
            style={statusFilter === sf.key ? { borderColor: `${sf.color}40`, backgroundColor: `${sf.color}15`, boxShadow: `0 0 8px ${sf.color}20` } : {}}
          >
            {sf.label} ({sf.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <Card className="p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4FD1FF]/60" />
          <input
            type="text"
            placeholder="Cari email, nama, atau username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1A1C22]/60 border border-[#4FD1FF]/15 text-sm font-sans text-[#E5E7EB] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#4FD1FF]/40 focus:ring-1 focus:ring-[#4FD1FF]/15 transition-all"
          />
        </div>
      </Card>

      {loading ? <SkeletonLoader rows={4} type="list" /> : filtered.length === 0 ? (
        <EmptyState icon={Globe} text={search ? "Tidak ada hasil pencarian." : statusFilter !== "all" ? `Tidak ada user dengan status ${statusFilter}.` : "Belum ada Google user terhubung."} />
      ) : (
        <>
          {/* Desktop: Table */}
          <Card className="hidden sm:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-sans">
                <thead>
                  <tr className="border-b border-[#4FD1FF]/10 bg-gradient-to-r from-[#4FD1FF]/[0.03] to-transparent">
                    <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">GOOGLE ACCOUNT</th>
                    <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">USERNAME</th>
                    <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">STATUS</th>
                    <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">ROLE</th>
                    <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">STORE</th>
                    <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">LINKED</th>
                    <th className="text-left px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">LAST LOGIN</th>
                    <th className="text-right px-5 py-3 text-[#4FD1FF]/80 text-[11px] font-medium">AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => {
                    const status = g.status || "approved";
                    const isPending = status === "pending";
                    const isLoading = actionLoading === g.google_email;
                    return (
                      <tr key={g.id} className={`border-b border-[#4FD1FF]/8 hover:bg-[#4FD1FF]/[0.02] transition-colors ${isPending ? "bg-[#F59E0B]/[0.03]" : ""}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img src={g.google_picture} alt="" className="w-7 h-7 rounded-full ring-1 ring-[#4FD1FF]/10" referrerPolicy="no-referrer" />
                              {isPending && (
                                <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#F59E0B] border border-[#1A1C22] animate-pulse" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[#E5E7EB] font-medium text-xs truncate">{g.google_name}</p>
                              <p className="text-[#4FD1FF]/60 text-[11px] truncate">{g.google_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[#4FD1FF] text-xs">{g.username}</td>
                        <td className="px-5 py-3.5">{getStatusBadge(status)}</td>
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
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleApprove(g.google_email)}
                                  disabled={isLoading}
                                  className="p-2 rounded-lg border border-green-800/30 hover:border-green-500/40 hover:bg-green-500/10 transition-all disabled:opacity-50"
                                  title="Approve"
                                >
                                  <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                                </button>
                                <button
                                  onClick={() => handleReject(g.google_email)}
                                  disabled={isLoading}
                                  className="p-2 rounded-lg border border-red-800/30 hover:border-red-500/40 hover:bg-red-500/10 transition-all disabled:opacity-50"
                                  title="Reject"
                                >
                                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                                </button>
                              </>
                            )}
                            {status === "rejected" && (
                              <button
                                onClick={() => handleApprove(g.google_email)}
                                disabled={isLoading}
                                className="p-2 rounded-lg border border-green-800/30 hover:border-green-500/40 hover:bg-green-500/10 transition-all disabled:opacity-50"
                                title="Approve ulang"
                              >
                                <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
                              </button>
                            )}
                            {status === "approved" && (
                              <button
                                onClick={() => handleReject(g.google_email)}
                                disabled={isLoading}
                                className="p-2 rounded-lg border border-yellow-800/30 hover:border-yellow-500/40 hover:bg-yellow-500/10 transition-all disabled:opacity-50"
                                title="Revoke akses"
                              >
                                <ShieldX className="h-3.5 w-3.5 text-yellow-400" />
                              </button>
                            )}
                            <button
                              onClick={() => handleUnlink(g.google_email)}
                              disabled={isLoading}
                              className="p-2 rounded-lg border border-red-800/30 hover:border-red-500/40 hover:bg-red-500/5 transition-all disabled:opacity-50"
                              title="Hapus & Unlink"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile: Cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map((g) => {
              const status = g.status || "approved";
              const isPending = status === "pending";
              const isLoading = actionLoading === g.google_email;
              return (
                <Card key={g.id} hover className={`p-4 ${isPending ? "border-[#F59E0B]/20" : ""}`}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <img src={g.google_picture} alt="" className="w-9 h-9 rounded-full ring-1 ring-[#4FD1FF]/10" referrerPolicy="no-referrer" />
                          {isPending && (
                            <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#F59E0B] border border-[#1A1C22] animate-pulse" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-sans text-[#E5E7EB] font-medium truncate">{g.google_name}</p>
                          <p className="text-[11px] font-sans text-[#4FD1FF]/60 truncate">{g.google_email}</p>
                          <p className="text-[11px] font-sans text-[#4FD1FF]/80 mt-0.5">@{g.username} · {getTenantName(g.tenant_id)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(status)}
                      <Badge variant={g.role === "super_admin" ? "purple" : "blue"}>
                        {g.role === "super_admin" ? "👑 Super Admin" : "🔍 QC"}
                      </Badge>
                      <span className="text-[10px] font-sans text-[#4FD1FF]/60">Linked {fmtDate(g.linked_at)}</span>
                      <span className="text-[10px] font-sans text-[#4FD1FF]/60">Login {fmtDate(g.last_login)}</span>
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      {isPending && (
                        <>
                          <button
                            onClick={() => handleApprove(g.google_email)}
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-green-800/30 hover:border-green-500/40 hover:bg-green-500/10 text-green-400 text-xs font-medium transition-all disabled:opacity-50"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleReject(g.google_email)}
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-800/30 hover:border-red-500/40 hover:bg-red-500/10 text-red-400 text-xs font-medium transition-all disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {status === "rejected" && (
                        <button
                          onClick={() => handleApprove(g.google_email)}
                          disabled={isLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-green-800/30 hover:border-green-500/40 hover:bg-green-500/10 text-green-400 text-xs font-medium transition-all disabled:opacity-50"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Approve Ulang
                        </button>
                      )}
                      {status === "approved" && (
                        <button
                          onClick={() => handleReject(g.google_email)}
                          disabled={isLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-yellow-800/30 hover:border-yellow-500/40 hover:bg-yellow-500/10 text-yellow-400 text-xs font-medium transition-all disabled:opacity-50"
                        >
                          <ShieldX className="h-3.5 w-3.5" /> Revoke
                        </button>
                      )}
                      <button
                        onClick={() => handleUnlink(g.google_email)}
                        disabled={isLoading}
                        className="py-2 px-3 rounded-xl border border-red-800/30 hover:border-red-500/40 hover:bg-red-500/5 transition-all disabled:opacity-50"
                        title="Hapus"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
