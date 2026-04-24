import { useLocation } from "wouter";
import { BarChart3, FileDown, LogOut, Shield, Sparkles, User, Zap } from "lucide-react";
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
    { label: "Input Waste", path: "/", icon: Zap },
    { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
    { label: "PDF Download", path: "/pdf", icon: FileDown },
    { label: "AWAS AI", path: "/ai", icon: Sparkles },
    { label: "Profil", path: "/profile", icon: User },
  ];

  const adminNavItems: NavItem[] = [
    { label: "Admin Panel", path: "/", icon: Shield },
    { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
  ];

  const navItems = isSuperAdmin ? adminNavItems : userNavItems;
  const initial = qcName ? qcName.charAt(0).toUpperCase() : "U";

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-[240px] flex-col border-r-2 border-[#222] bg-[#0f0f0f] lg:flex">
      {/* Logo */}
      <div className="border-b-2 border-[#222] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[#333] bg-[#1a1a1a] shadow-nb-sm">
            <img src={wasteLogo} alt="AWAS" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest text-white uppercase">AWAS</h1>
            <p className="text-[10px] text-[#555] font-medium">Waste Control System</p>
          </div>
        </div>
      </div>

      {/* User card */}
      <div className="border-b-2 border-[#222] px-4 py-4">
        <div className="rounded-lg border-2 border-[#2a2a2a] bg-[#141414] p-3 shadow-nb-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#FFE500] bg-[#1a1a00] text-sm font-black text-[#FFE500] shadow-nb-yellow">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{qcName || "User"}</p>
              <p className="truncate text-[10px] text-[#666]">
                {isSuperAdmin ? "Super Admin" : tenantName || "Admin Store"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          return (
            <button
              key={`${item.path}-${item.label}`}
              onClick={() => setLocation(item.path)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-semibold text-sm transition-all ${
                isActive
                  ? "border-2 border-[#FFE500] bg-[#1a1a00] text-[#FFE500] shadow-nb-yellow"
                  : "border-2 border-transparent text-[#777] hover:border-[#333] hover:text-white hover:bg-[#161616]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t-2 border-[#222] px-3 py-4 space-y-3">
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-3 rounded-lg border-2 border-transparent px-3 py-2.5 text-left text-sm font-semibold text-[#666] transition hover:border-[#ef4444]/40 hover:text-[#ef4444] disabled:opacity-50"
        >
          {isLoggingOut
            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            : <LogOut className="h-4 w-4" />
          }
          <span>{isLoggingOut ? "Keluar..." : "Logout"}</span>
        </button>
        <div className="flex items-center justify-between px-1 text-[10px] text-[#444] font-mono">
          <span>v4.0.0</span>
          <span className="text-[#FFE500]/60">NEO BRUTALISM</span>
        </div>
      </div>
    </aside>
  );
}
