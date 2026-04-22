import { useLocation } from "wouter";
import { Zap, BarChart3, FileDown, User, Shield, LogOut, Sparkles } from "lucide-react";
import wasteLogo from "@assets/waste-logo_1753322218969.webp";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

interface DesktopSidebarProps {
  qcName: string;
  tenantName: string;
  isSuperAdmin: boolean;
  onLogout: () => void;
  isLoggingOut: boolean;
}

export function DesktopSidebar({ qcName, tenantName, isSuperAdmin, onLogout, isLoggingOut }: DesktopSidebarProps) {
  const [currentPath, setLocation] = useLocation();

  const userNavItems: NavItem[] = [
    { label: "Auto Waste", path: "/", icon: Zap },
    { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
    { label: "PDF", path: "/pdf", icon: FileDown },
    { label: "AWAS AI", path: "/ai", icon: Sparkles },
    { label: "Profil", path: "/profile", icon: User },
  ];

  const adminNavItems: NavItem[] = [
    { label: "Admin", path: "/", icon: Shield },
    { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
  ];

  const navItems = isSuperAdmin ? adminNavItems : userNavItems;

  return (
    <aside className="hidden lg:flex lg:flex-col fixed left-0 top-0 h-screen w-[248px] z-40 bg-white/90 backdrop-blur-xl border-r border-slate-200/80">
      <div className="px-5 pt-5 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <img src={wasteLogo} alt="AWAS Logo" className="w-10 h-10 rounded-2xl shadow-sm ring-1 ring-slate-200" />
          <div>
            <h1 className="text-base font-bold text-slate-950 leading-tight">AWAS</h1>
            <p className="text-[10px] text-slate-500 leading-tight">Waste Always Simple</p>
          </div>
        </div>
        {tenantName && (
          <p className="text-[11px] text-sky-700 mt-3 truncate rounded-full bg-sky-50 px-3 py-1">{tenantName}</p>
        )}
      </div>

      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-sky-700">
              {qcName ? qcName.charAt(0).toUpperCase() : "?"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-950 truncate">{qcName || "User"}</p>
            <span className={`text-[11px] ${isSuperAdmin ? "text-violet-700" : "text-slate-500"}`}>
              {isSuperAdmin ? "Super Admin" : "QC Staff"}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path + item.label}
              onClick={() => setLocation(item.path)}
              className={`relative w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all duration-200 ${
                isActive
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-sky-500" />
              )}
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-sky-600" : "text-slate-500"}`} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-4 pt-2 border-t border-slate-200 space-y-2">
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm font-medium text-red-600 hover:bg-red-50 border border-transparent transition-all disabled:opacity-40"
        >
          {isLoggingOut ? (
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {isLoggingOut ? "Keluar..." : "Logout"}
        </button>
        <div className="text-center space-y-0.5 pt-1">
          <p className="text-[10px] text-slate-400">v3.3.0</p>
          <p className="text-[10px] text-slate-400">By ~/DirgaX</p>
        </div>
      </div>
    </aside>
  );
}
