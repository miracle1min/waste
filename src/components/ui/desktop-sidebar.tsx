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

export function DesktopSidebar({
  qcName,
  tenantName,
  isSuperAdmin,
  onLogout,
  isLoggingOut,
}: DesktopSidebarProps) {
  const [currentPath, setLocation] = useLocation();

  const userNavItems: NavItem[] = [
    { label: "Auto Waste", path: "/", icon: Zap },
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
    <aside className="fixed left-0 top-0 hidden h-screen w-[248px] flex-col border-r border-white/6 bg-[#11141A] lg:flex">
      <div className="border-b border-white/6 px-5 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-[#181C23]">
            <img src={wasteLogo} alt="AWAS Logo" className="h-9 w-9 object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-[0.16em] text-white">AWAS</h1>
            <p className="truncate text-[11px] text-[#8291A6]">Aplikasi Waste Always Simple</p>
          </div>
        </div>
      </div>

      <div className="border-b border-white/6 px-4 py-4">
        <div className="rounded-2xl border border-white/6 bg-[#171B22] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#202631] text-sm font-semibold text-[#6FBDE7]">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{qcName || "User"}</p>
              <p className="truncate text-xs text-[#8694A8]">
                {isSuperAdmin ? "Super Admin" : tenantName || "Admin Store"}
              </p>
            </div>
          </div>
          {tenantName && !isSuperAdmin && (
            <div className="mt-3 rounded-xl border border-white/6 bg-[#12161D] px-3 py-2 text-[11px] text-[#90A0B6]">
              {tenantName}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;

          return (
            <button
              key={`${item.path}-${item.label}`}
              onClick={() => setLocation(item.path)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                isActive
                  ? "bg-[#1B212B] text-white shadow-[inset_0_0_0_1px_rgba(79,209,255,0.14)]"
                  : "text-[#8D9AAF] hover:bg-white/[0.03] hover:text-white"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  isActive ? "bg-[#202938] text-[#6FBDE7]" : "bg-[#171B22] text-[#7E8DA2]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/6 px-3 py-4">
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[#D5DDE8] transition hover:bg-white/[0.03] disabled:opacity-60"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#171B22] text-[#E58989]">
            {isLoggingOut ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
          </div>
          <span className="text-sm font-medium">{isLoggingOut ? "Keluar..." : "Logout"}</span>
        </button>

        <div className="mt-4 flex items-center justify-between px-1 text-[11px] text-[#6F7C8F]">
          <span>v4.0.0</span>
          <span>dark mode</span>
        </div>
      </div>
    </aside>
  );
}
