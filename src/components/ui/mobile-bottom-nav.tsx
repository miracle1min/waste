import { useLocation } from "wouter";
import { Zap, BarChart3, FileDown, User, Sparkles } from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Input", path: "/", icon: Zap },
  { label: "Data", path: "/dashboard", icon: BarChart3 },
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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/80 bg-white/90 backdrop-blur-xl safe-area-bottom max-h-[76px]">
      <div className="flex items-center justify-around px-1.5 pt-2 pb-2">
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
              className={`flex min-w-[56px] flex-col items-center gap-1 rounded-2xl px-2 py-1.5 transition-all duration-200 ${
                active ? "text-sky-700" : "text-slate-500 active:text-slate-700"
              }`}
            >
              <div className={`relative rounded-2xl p-1.5 transition-all duration-200 ${active ? "bg-sky-50" : ""}`}>
                <Icon className={`w-5 h-5 transition-all ${active ? "text-sky-600" : ""}`} strokeWidth={active ? 2.4 : 1.8} />
              </div>
              <span className={`text-[10px] font-medium ${active ? "text-sky-700" : ""}`}>
                {item.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
