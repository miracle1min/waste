import { useLocation } from "wouter";
import { Zap, BarChart3, FileDown, User, Shield, LogOut } from "lucide-react";
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
    { label: "PDF Download", path: "/pdf", icon: FileDown },
    { label: "Profil", path: "/profile", icon: User },
  ];

  const adminNavItems: NavItem[] = [
    { label: "Admin Panel", path: "/", icon: Shield },
    { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
  ];

  const navItems = isSuperAdmin ? adminNavItems : userNavItems;

  return (
    <aside className="hidden lg:flex lg:flex-col fixed left-0 top-0 h-screen w-[240px] z-40 bg-[#1A1C22] border-r border-[rgba(79,209,255,0.06)]">
      {/* App Logo & Branding */}
      <div className="px-5 pt-5 pb-4 border-b border-[rgba(79,209,255,0.06)]">
        <div className="flex items-center gap-3">
          <img src={wasteLogo} alt="AWAS Logo" className="w-10 h-10 rounded-xl shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)]" />
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] bg-clip-text text-transparent leading-tight">
              AWAS
            </h1>
            <p className="text-[9px] text-[#9CA3AF] font-mono leading-tight">Aplikasi Waste Always Simple</p>
          </div>
        </div>
        {tenantName && (
          <p className="text-[10px] text-[#4FD1FF]/60 font-mono mt-2 truncate">{tenantName}</p>
        )}
      </div>

      {/* User Info Section */}
      <div className="px-4 py-3 border-b border-[rgba(79,209,255,0.06)]">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-[12px] bg-[#23262F]/60 border border-[rgba(79,209,255,0.06)] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)]">
          <div className="w-7 h-7 rounded-full bg-[#23262F] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-[#4FD1FF]">
              {qcName ? qcName.charAt(0).toUpperCase() : "?"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-mono text-[#E5E7EB] truncate">{qcName || "User"}</p>
            {isSuperAdmin ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#9F7AEA]/20 text-[#9F7AEA] font-mono inline-flex items-center gap-0.5">
                👑 Super Admin
              </span>
            ) : (
              <span className="text-[9px] text-[#9CA3AF] font-mono">QC Staff</span>
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
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-left transition-all duration-200 ${
                isActive
                  ? "bg-[#23262F] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.02)] text-[#E5E7EB]"
                  : "text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-[#23262F]/40"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-[#4FD1FF] to-[#9F7AEA] shadow-[0_0_6px_rgba(79,209,255,0.3)]" />
              )}
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#4FD1FF]" : "text-[#9CA3AF]"}`} />
              <span className={`text-sm font-medium ${isActive ? "text-[#E5E7EB]" : ""}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="px-3 pb-4 pt-2 border-t border-[rgba(79,209,255,0.06)] space-y-2">
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-sm font-mono text-red-400/60 hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-900/20 transition-all disabled:opacity-40"
        >
          {isLoggingOut ? (
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {isLoggingOut ? "Keluar..." : "Logout"}
        </button>
        <div className="text-center space-y-0.5 pt-1">
          <p className="text-[9px] font-mono text-[#9CA3AF]">v3.3.0</p>
          <p className="text-[9px] text-[#9CA3AF]">Made with ☕ By ~/DirgaX</p>
        </div>
      </div>
    </aside>
  );
}
