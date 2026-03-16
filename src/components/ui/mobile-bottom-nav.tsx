import { useLocation } from "wouter";
import { Zap, BarChart3, FileDown, User } from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Auto Waste", path: "/", icon: Zap },
  { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
  { label: "PDF", path: "/pdf", icon: FileDown },
  { label: "Profil", path: "/profile", icon: User },
];

export function MobileBottomNav() {
  const [currentPath] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/" || currentPath === "/auto-waste";
    return currentPath === path;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-cyan-900/30 bg-[hsl(220,45%,6%)]/95 backdrop-blur-xl safe-area-bottom">
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
                  ? "text-cyan-400"
                  : "text-slate-500 active:text-slate-300"
              }`}
            >
              <div className={`relative p-1.5 rounded-2xl transition-all duration-300 ${
                active ? "bg-cyan-500/15" : ""
              }`}>
                <Icon className={`w-5 h-5 transition-all ${active ? "text-cyan-400" : ""}`} strokeWidth={active ? 2.5 : 1.8} />
                {active && (
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400" />
                )}
              </div>
              <span className={`text-[10px] font-medium transition-all ${
                active ? "text-cyan-400" : ""
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
