import { useLocation } from "wouter";
import { Zap, BarChart3, FileDown, User, Sparkles } from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Auto Waste", path: "/", icon: Zap },
  { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
  { label: "PDF", path: "/pdf", icon: FileDown },
  { label: "AI", path: "/ai", icon: Sparkles },
  { label: "Profil", path: "/profile", icon: User },
];

export function MobileBottomNav() {
  const [currentPath] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/" || currentPath === "/auto-waste";
    return currentPath === path;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[rgba(79,209,255,0.06)] bg-[#1A1C22] safe-area-bottom">
      <div className="flex items-center justify-around px-1 pt-2 pb-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, "", item.path);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 ${
                active
                  ? "text-[#4FD1FF]"
                  : "text-[#9CA3AF] active:text-[#9CA3AF]"
              }`}
            >
              <div className={`relative p-1.5 rounded-[12px] transition-all duration-300 ${
                active ? "bg-[#23262F] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.02)]" : ""
              }`}>
                <Icon className={`w-5 h-5 transition-all ${active ? "text-[#4FD1FF]" : ""}`} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span className={`text-[10px] font-medium transition-all ${
                active ? "text-[#4FD1FF]" : ""
              }`}>
                {item.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
