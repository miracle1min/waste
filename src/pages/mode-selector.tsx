import { useLocation } from "wouter";
import { Zap, ClipboardEdit, LogOut, BarChart3, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Footer } from "@/components/ui/footer";
import wasteLogo from "@assets/waste-logo_1753322218969.webp";

export default function ModeSelector() {
  const [, setLocation] = useLocation();
  const { logout, isLoggingOut, isSuperAdmin, tenantName, qcName } = useAuth();

  const handleLogout = () => {
    logout();
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/95 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-cyan-900/30 bg-[hsl(220,45%,8%)]/95 backdrop-blur-md">
        <div className="w-full px-4 py-2 flex items-center justify-between desktop-header-container">
          <div className="flex items-center gap-2">
            <img src={wasteLogo} alt="AWAS Logo" className="w-8 h-8 rounded" />
            <div>
              <h1 className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                AWAS
              </h1>
              <p className="text-[10px] text-slate-500">Aplikasi Waste Always Simple</p>
              {tenantName && <p className="text-[10px] text-cyan-500/70 font-mono truncate">{tenantName}</p>}
            </div>
            {/* User info */}
            <div className="hidden sm:flex items-center gap-2 ml-3 px-2 py-1 rounded-lg bg-cyan-500/5 border border-cyan-900/30">
              <span className="text-[10px] font-mono text-cyan-500">{qcName}</span>
              {tenantName && <span className="text-[10px] font-mono text-cyan-700">| {tenantName}</span>}
              {isSuperAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">👑</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/settings")}
              className="p-2 w-10 h-10 text-slate-400 hover:text-yellow-400 border border-transparent hover:border-yellow-800/50"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/dashboard")}
              className="p-2 w-10 h-10 text-slate-400 hover:text-cyan-400 border border-transparent hover:border-cyan-800/50"
              title="Dashboard"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="p-2 w-10 h-10 text-slate-400 hover:text-cyan-400 border border-transparent hover:border-cyan-800/50"
              title="Keluar"
            >
              {isLoggingOut ? (
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Sapaan */}
        <div className="text-center mb-6 lg:mb-10">
          <h2 className="text-xl font-bold text-cyan-400">
            Halo, {qcName || 'Kawan'}! 👋
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Kamu akan buat BA Waste untuk Resto <span className="font-semibold text-cyan-300">{tenantName || '-'}</span>. Semangat! 💪
          </p>
        </div>

        <div className="text-center mb-8">
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg lg:max-w-3xl px-4">
          {/* Waste Otomatis */}
          <button
            onClick={() => setLocation("/auto-waste")}
            className="group relative p-6 lg:p-8 rounded-xl border-2 border-cyan-800/50 bg-gradient-to-br from-cyan-950/40 to-blue-950/40 hover:border-cyan-500 hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 text-left"
          >
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-wider">
              Fast Mode
            </div>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-cyan-400 mb-2">
              Waste Otomatis
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Paste format teks langsung → data otomatis ter-record. TTD otomatis dari database. Pas banget buat QC yang udah hafal formatnya.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-cyan-500/70">
              <Zap className="w-3 h-3" />
              <span>~30 detik per station, ngebut!</span>
            </div>
          </button>

          {/* Waste Manual */}
          <button
            onClick={() => setLocation("/manual-waste")}
            className="group relative p-6 lg:p-8 rounded-xl border-2 border-purple-800/50 bg-gradient-to-br from-purple-950/40 to-pink-950/40 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 text-left"
          >
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-wider">
              Full Control
            </div>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ClipboardEdit className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-purple-400 mb-2">
              Waste Manual
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Input step-by-step pakai form lengkap. TTD gambar tangan. Buat yang baru belajar atau butuh kontrol penuh.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-purple-500/70">
              <ClipboardEdit className="w-3 h-3" />
              <span>Full wizard 5 langkah, telaten ya</span>
            </div>
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
