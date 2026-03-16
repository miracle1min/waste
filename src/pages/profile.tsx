import { useAuth } from "@/hooks/useAuth";
import { LogOut, User, Building2, Shield, Clock, Smartphone } from "lucide-react";
import wasteLogo from "@assets/waste-logo_1753322218969.webp";

export default function Profile() {
  const { qcName, tenantName, storeCode, userRole, isSuperAdmin, logout, isLoggingOut } = useAuth();

  const handleLogout = () => {
    logout();
    setTimeout(() => window.location.reload(), 800);
  };

  const loginTime = localStorage.getItem("waste_app_login_time");
  const sessionStart = loginTime ? new Date(parseInt(loginTime)) : null;

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 border-b border-cyan-900/30 bg-[hsl(220,45%,8%)]/95 backdrop-blur-md lg:hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <User className="w-5 h-5 text-cyan-400" />
          <h1 className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Profil</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 lg:p-8 space-y-5">
        {/* Desktop title */}
        <div className="hidden lg:flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Profil</h2>
        </div>

        {/* Avatar card */}
        <div className="bg-[hsl(220,40%,10%)] border border-cyan-900/30 rounded-2xl p-6 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/30 flex items-center justify-center">
            <span className="text-3xl font-bold text-cyan-400">
              {qcName ? qcName.charAt(0).toUpperCase() : "?"}
            </span>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-white">{qcName || "User"}</h3>
            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-mono mt-1.5 ${
              isSuperAdmin 
                ? "bg-purple-500/15 text-purple-300 border border-purple-500/30" 
                : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
            }`}>
              <Shield className="w-3 h-3" />
              {isSuperAdmin ? "Super Admin" : "QC Staff"}
            </span>
          </div>
        </div>

        {/* Info cards */}
        <div className="space-y-3">
          {tenantName && (
            <div className="bg-[hsl(220,40%,10%)] border border-cyan-900/30 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 font-mono uppercase">Tenant / Resto</p>
                <p className="text-sm text-white font-medium truncate">{tenantName}</p>
                {storeCode && <p className="text-xs text-slate-400 font-mono">{storeCode}</p>}
              </div>
            </div>
          )}

          {sessionStart && (
            <div className="bg-[hsl(220,40%,10%)] border border-cyan-900/30 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 font-mono uppercase">Sesi Login</p>
                <p className="text-sm text-white font-medium">
                  {sessionStart.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
                  {" "}{sessionStart.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-xs text-slate-400">Otomatis expire setelah 8 jam</p>
              </div>
            </div>
          )}
        </div>

        {/* App info */}
        <div className="bg-[hsl(220,40%,10%)] border border-cyan-900/30 rounded-xl p-4 flex items-center gap-3">
          <img src={wasteLogo} alt="AWAS" className="w-10 h-10 rounded-xl" />
          <div>
            <p className="text-sm font-bold text-white">AWAS</p>
            <p className="text-[10px] text-slate-500 font-mono">Aplikasi Waste Always Simple</p>
            <p className="text-[10px] text-slate-600 font-mono">v3.4.0 • Made with ☕ By ~/DirgaX</p>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:bg-red-500/30 transition-all disabled:opacity-40"
        >
          {isLoggingOut ? (
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {isLoggingOut ? "Keluar..." : "Logout"}
        </button>
      </div>
    </div>
  );
}
