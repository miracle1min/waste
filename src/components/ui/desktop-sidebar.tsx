import { useLocation } from "wouter";
import { Zap, BarChart3, Shield, LogOut } from "lucide-react";
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
  ];

  const adminNavItems: NavItem[] = [
    { label: "Admin Panel", path: "/", icon: Shield },
    { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
  ];

  const navItems = isSuperAdmin ? adminNavItems : userNavItems;

  return (
    <aside className="hidden lg:flex lg:flex-col fixed left-0 top-0 h-screen w-[240px] z-40 bg-[hsl(220,45%,8%)] border-r border-cyan-900/30">
      {/* App Logo & Branding */}
      <div className="px-5 pt-5 pb-4 border-b border-cyan-900/20">
        <div className="flex items-center gap-3">
          <img src={wasteLogo} alt="AWAS Logo" className="w-10 h-10 rounded-xl shadow-lg shadow-cyan-500/10" />
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent leading-tight">
              AWAS
            </h1>
            <p className="text-[9px] text-slate-500 font-mono leading-tight">Aplikasi Waste Always Simple</p>
          </div>
        </div>
        {tenantName && (
          <p className="text-[10px] text-cyan-500/70 font-mono mt-2 truncate">{tenantName}</p>
        )}
      </div>

      {/* User Info Section */}
      <div className="px-4 py-3 border-b border-cyan-900/20">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-cyan-500/5 border border-cyan-900/30">
          <div className="w-7 h-7 rounded-full bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-cyan-400">
              {qcName ? qcName.charAt(0).toUpperCase() : "?"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-mono text-cyan-300 truncate">{qcName || "User"}</p>
            {isSuperAdmin ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono inline-flex items-center gap-0.5">
                👑 Super Admin
              </span>
            ) : (
              <span className="text-[9px] text-slate-500 font-mono">QC Staff</span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path + item.label}
              onClick={() => setLocation(item.path)}
              className={`sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                isActive
                  ? "active text-cyan-300"
                  : "text-slate-400 hover:text-cyan-300"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
              <span className={`text-sm font-medium ${isActive ? "text-cyan-300" : ""}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="px-3 pb-4 pt-2 border-t border-cyan-900/20 space-y-2">
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-mono text-red-400/60 hover:text-red-300 hover:bg-red-500/5 border border-transparent hover:border-red-900/20 transition-all disabled:opacity-40"
        >
          {isLoggingOut ? (
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {isLoggingOut ? "Keluar..." : "Logout"}
        </button>
        <div className="text-center space-y-0.5 pt-1">
          <p className="text-[9px] font-mono text-slate-600">v3.3.0</p>
          <p className="text-[9px] text-slate-700">Made with ☕ By ~/DirgaX</p>
        </div>
      </div>
    </aside>
  );
}
