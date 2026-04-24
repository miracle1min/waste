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
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 lg:hidden pointer-events-none">
      <div className="mx-auto flex max-w-lg items-center justify-between rounded-xl border-2 border-[#2a2a2a] bg-[#0f0f0f] px-1 py-1.5 shadow-nb pointer-events-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => { e.preventDefault(); navigate(item.path); }}
              className={`flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-all ${
                active
                  ? "bg-[#1a1a00] border-2 border-[#FFE500] shadow-nb-yellow"
                  : "border-2 border-transparent text-[#555] hover:text-[#aaa]"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-[#FFE500]" : ""}`}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span className={`text-[10px] font-bold ${active ? "text-[#FFE500]" : "text-[#555]"}`}>
                {item.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
