import { useLocation } from "wouter";
import { BarChart3, FileDown, Sparkles, User, Zap } from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Waste", path: "/", icon: Zap },
  { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
  { label: "PDF", path: "/pdf", icon: FileDown },
  { label: "AI", path: "/ai", icon: Sparkles },
  { label: "Profil", path: "/profile", icon: User },
];

export function MobileBottomNav() {
  const [currentPath, navigate] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/" || currentPath === "/auto-waste";
    return currentPath === path;
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 lg:hidden pointer-events-none">
      <div className="mx-auto flex max-w-lg items-center justify-between rounded-[24px] border border-white/10 bg-[#12161D]/92 px-2 py-2 shadow-[0_22px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl pointer-events-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => {
                e.preventDefault();
                // FIX #39: Use wouter navigate instead of window.history.pushState
                navigate(item.path);
              }}
              className={`flex min-w-[60px] flex-col items-center gap-1 rounded-2xl px-2 py-2 transition ${
                active ? "text-[#6FBDE7]" : "text-[#7D8C9F]"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl transition ${
                  active ? "bg-[#1D2633] shadow-[inset_0_0_0_1px_rgba(79,209,255,0.14)]" : "bg-transparent"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.9} />
              </div>
              <span className="text-[11px] font-medium">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
