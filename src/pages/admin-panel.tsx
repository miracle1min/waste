import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Building2, UserCog, Globe, UserCheck, KeyRound, Server,
  Activity, Shield, LogOut, Menu, MoreHorizontal, Loader2
} from "lucide-react";
import wasteLogo from "@assets/waste-logo_1753322218969.webp";

// Lazy load page components
const OverviewPage = lazy(() => import("./admin/overview"));
const TenantsPage = lazy(() => import("./admin/tenants"));
const UsersPage = lazy(() => import("./admin/users"));
const GoogleUsersPage = lazy(() => import("./admin/google-users"));
const PersonnelPage = lazy(() => import("./admin/personnel"));
const ConfigsPage = lazy(() => import("./admin/configs"));
const DatabasePage = lazy(() => import("./admin/database"));
const ActivityLogPage = lazy(() => import("./admin/activity"));

type PageKey = "overview" | "tenants" | "users" | "google-users" | "personnel" | "configs" | "database" | "activity";

// ===== Menu Items =====
const MENU_ITEMS: { key: PageKey; label: string; shortLabel: string; icon: any; desc: string }[] = [
  { key: "overview", label: "Overview", shortLabel: "Home", icon: LayoutDashboard, desc: "Ringkasan sistem" },
  { key: "tenants", label: "Store", shortLabel: "Store", icon: Building2, desc: "Kelola resto/store" },
  { key: "users", label: "Users", shortLabel: "Users", icon: UserCog, desc: "Manajemen user" },
  { key: "google-users", label: "Google Users", shortLabel: "Google", icon: Globe, desc: "Akun Google OAuth" },
  { key: "personnel", label: "QC & Manager", shortLabel: "QC", icon: UserCheck, desc: "Personil & TTD" },
  { key: "configs", label: "Config", shortLabel: "Config", icon: KeyRound, desc: "Env & kredensial" },
  { key: "database", label: "Database", shortLabel: "DB", icon: Server, desc: "DB management" },
  { key: "activity", label: "Activity Log", shortLabel: "Log", icon: Activity, desc: "Riwayat aktivitas" },
];

// Mobile bottom nav shows first 4, rest in "More" menu
const MOBILE_NAV = MENU_ITEMS.slice(0, 4);
const MORE_NAV = MENU_ITEMS.slice(4);

// ===== Main Admin Panel =====
export default function AdminPanel() {
  const { qcName, logout, isLoggingOut } = useAuth();
  const [activePage, setActivePage] = useState<PageKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => { logout(); setTimeout(() => window.location.reload(), 800); };
  const handleNav = (key: PageKey) => { setActivePage(key); setSidebarOpen(false); setMoreOpen(false); };

  // Close "more" popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-cyan-100">
      {/* ====== Mobile overlay ====== */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      <div className="flex">
        {/* ====== Sidebar (desktop + mobile drawer) ====== */}
        <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-gray-950 border-r border-cyan-900/20 flex flex-col transition-transform duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} shrink-0`}>
          {/* Logo area */}
          <div className="p-5 border-b border-cyan-900/20">
            <div className="flex items-center gap-3">
              <img src={wasteLogo} alt="AWAS" className="w-10 h-10 rounded-xl shadow-lg shadow-cyan-500/10" />
              <div>
                <h1 className="text-base font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent leading-tight">AWAS</h1>
                <p className="text-[10px] text-cyan-700 font-mono">Control Panel</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNav(item.key)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all duration-200 group ${
                    isActive
                      ? "bg-cyan-500/10 border border-cyan-500/25 text-cyan-100"
                      : "border border-transparent text-cyan-500 hover:text-cyan-200 hover:bg-white/[0.02]"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    isActive ? "bg-cyan-500/15" : "bg-white/[0.02] group-hover:bg-cyan-500/5"
                  }`}>
                    <Icon className={`h-[18px] w-[18px] ${isActive ? "text-cyan-400" : "text-cyan-600 group-hover:text-cyan-400"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-mono font-medium ${isActive ? "text-cyan-100" : ""}`}>{item.label}</p>
                    <p className={`text-[10px] font-mono ${isActive ? "text-cyan-500" : "text-cyan-800"}`}>{item.desc}</p>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.5)] shrink-0" />}
                </button>
              );
            })}
          </nav>

          {/* User / Logout */}
          <div className="p-3 border-t border-cyan-900/20 space-y-2">
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-purple-500/5 border border-purple-900/20">
              <Shield className="h-4 w-4 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-mono text-purple-300 truncate">{qcName}</p>
                <p className="text-[10px] font-mono text-purple-600">Super Admin</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-mono text-red-400/60 hover:text-red-300 hover:bg-red-500/5 border border-transparent hover:border-red-900/20 transition-all"
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              {isLoggingOut ? "Keluar..." : "Logout"}
            </button>
          </div>
        </aside>

        {/* ====== Main Content ====== */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b border-cyan-900/20 bg-gray-950/90 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16">
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-1 rounded-xl border border-cyan-800/30 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all">
                  <Menu className="h-5 w-5 text-cyan-400" />
                </button>
                {/* Mobile logo */}
                <img src={wasteLogo} alt="" className="w-7 h-7 rounded-lg lg:hidden" />
                <div>
                  <h2 className="text-sm sm:text-base font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
                    {MENU_ITEMS.find(m => m.key === activePage)?.label || "Admin"}
                  </h2>
                  <p className="text-[10px] font-mono text-cyan-700 hidden sm:block">
                    {MENU_ITEMS.find(m => m.key === activePage)?.desc}
                  </p>
                </div>
              </div>
              <div className="lg:hidden flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/5 border border-purple-900/20">
                  <Shield className="h-3 w-3 text-purple-400" />
                  <span className="text-[10px] font-mono text-purple-300 max-w-[80px] truncate">{qcName}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-6 overflow-y-auto">
            <div className="max-w-5xl mx-auto">
              <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>}>
                {activePage === "overview" && <OverviewPage onNavigate={handleNav} />}
                {activePage === "tenants" && <TenantsPage />}
                {activePage === "users" && <UsersPage />}
                {activePage === "google-users" && <GoogleUsersPage />}
                {activePage === "personnel" && <PersonnelPage />}
                {activePage === "configs" && <ConfigsPage />}
                {activePage === "database" && <DatabasePage />}
                {activePage === "activity" && <ActivityLogPage />}
              </Suspense>
            </div>
          </main>

          {/* ====== Mobile Bottom Nav ====== */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-cyan-900/20 bg-gray-950/95 backdrop-blur-xl safe-area-bottom">
            <div className="flex items-stretch">
              {MOBILE_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNav(item.key)}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all ${isActive ? "text-cyan-300" : "text-cyan-700 active:text-cyan-400"}`}
                  >
                    <div className={`p-1 rounded-lg transition-all ${isActive ? "bg-cyan-500/10" : ""}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] font-mono font-medium">{item.shortLabel}</span>
                    {isActive && <div className="w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,255,255,0.6)]" />}
                  </button>
                );
              })}
              {/* More button */}
              <div className="flex-1 relative" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`w-full flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all ${MORE_NAV.some(m => m.key === activePage) ? "text-cyan-300" : "text-cyan-700 active:text-cyan-400"}`}
                >
                  <div className={`p-1 rounded-lg transition-all ${MORE_NAV.some(m => m.key === activePage) ? "bg-cyan-500/10" : ""}`}>
                    <MoreHorizontal className="h-5 w-5" />
                  </div>
                  <span className="text-[9px] font-mono font-medium">More</span>
                  {MORE_NAV.some(m => m.key === activePage) && <div className="w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,255,255,0.6)]" />}
                </button>
                {/* More popup */}
                {moreOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border border-cyan-900/30 bg-gray-900/95 backdrop-blur-xl shadow-xl overflow-hidden">
                    {MORE_NAV.map((item) => {
                      const Icon = item.icon;
                      const isActive = activePage === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => handleNav(item.key)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${isActive ? "bg-cyan-500/10 text-cyan-200" : "text-cyan-500 hover:bg-cyan-500/5"}`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="text-sm font-mono">{item.label}</span>
                        </button>
                      );
                    })}
                    {/* Logout in more menu */}
                    <div className="border-t border-cyan-900/20">
                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-400/70 hover:bg-red-500/5 transition-all"
                      >
                        {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                        <span className="text-sm font-mono">{isLoggingOut ? "Keluar..." : "Logout"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
