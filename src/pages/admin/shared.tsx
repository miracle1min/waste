import React, { useState, useEffect, useRef } from "react";
import { Loader2, RefreshCw, ChevronDown } from "lucide-react";

/* ─── Animated Counter ─── */
export function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + diff * ease));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prev.current = value;
  }, [value, duration]);
  return <>{display.toLocaleString("id-ID")}</>;
}

/* ─── Collapsible Section ─── */
export function CollapsibleSection({
  title, icon: Icon, defaultOpen = true, badge, children, className = ""
}: {
  title: string; icon?: any; defaultOpen?: boolean; badge?: string; children: React.ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl border border-[#4FD1FF]/10 bg-[#1A1C22]/40 backdrop-blur-sm overflow-hidden transition-all ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 sm:px-5 sm:py-4 hover:bg-[#4FD1FF]/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4FD1FF]/10 to-[#9F7AEA]/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-[#4FD1FF]" />
            </div>
          )}
          <span className="text-sm font-sans font-bold text-[#E5E7EB]">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-sans font-medium bg-[#4FD1FF]/8 text-[#4FD1FF] border border-[#4FD1FF]/20">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-[#4FD1FF]/60 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: open ? "5000px" : "0", opacity: open ? 1 : 0 }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── Skeleton Loader ─── */
export function SkeletonLoader({ rows = 3, type = "list" }: { rows?: number; type?: "list" | "cards" | "stats" }) {
  if (type === "stats") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[#4FD1FF]/10 bg-[#1A1C22]/40 p-4 sm:p-5 space-y-3 animate-pulse">
            <div className="w-9 h-9 rounded-xl bg-[#4FD1FF]/8" />
            <div className="h-7 w-16 rounded-lg bg-[#4FD1FF]/8" />
            <div className="h-3 w-20 rounded bg-[#4FD1FF]/5" />
          </div>
        ))}
      </div>
    );
  }
  if (type === "cards") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[#4FD1FF]/10 bg-[#1A1C22]/40 p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-14 h-11 rounded-lg bg-[#4FD1FF]/8" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-[#4FD1FF]/8" />
                <div className="h-3 w-1/2 rounded bg-[#4FD1FF]/5" />
                <div className="flex gap-2"><div className="h-5 w-14 rounded-md bg-[#4FD1FF]/5" /><div className="h-5 w-14 rounded-md bg-[#4FD1FF]/5" /></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2 py-4 px-4 sm:px-5 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="w-9 h-9 rounded-xl bg-[#4FD1FF]/8" />
          <div className="flex-1 space-y-2">
            <div className="h-4 rounded bg-[#4FD1FF]/8" style={{ width: `${60 + Math.random() * 30}%` }} />
            <div className="h-3 rounded bg-[#4FD1FF]/5" style={{ width: `${40 + Math.random() * 20}%` }} />
          </div>
          <div className="h-5 w-16 rounded-md bg-[#4FD1FF]/5" />
        </div>
      ))}
    </div>
  );
}

/* ─── Card ─── */
export function Card({ children, className = "", hover = false, onClick }: { children: React.ReactNode; className?: string; hover?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-[#4FD1FF]/10 bg-[#1A1C22]/40 backdrop-blur-sm transition-all duration-200 ${
        hover ? "hover:border-[#4FD1FF]/20 hover:shadow-[0_4px_16px_rgba(79,209,255,0.06)] hover:translate-y-[-1px] cursor-pointer" : ""
      } ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Card Header ─── */
export function CardHeader({ children, className = "", action }: { children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={`px-4 py-3 sm:px-5 sm:py-4 border-b border-[#4FD1FF]/10 flex items-center justify-between ${className}`}>
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

/* ─── Badge ─── */
export function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "purple" | "blue" }) {
  const styles = {
    default: "bg-[#4FD1FF]/8 text-[#4FD1FF] border-[#4FD1FF]/20",
    success: "bg-green-500/10 text-green-300 border-green-500/20",
    warning: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    danger: "bg-red-500/10 text-red-300 border-red-500/20",
    purple: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-sans font-medium border ${styles[variant]}`}>{children}</span>;
}

/* ─── Input ─── */
export function Input({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-[11px] font-sans text-[#4FD1FF]/80 mb-1.5">{label}</label>
      <input {...props} className={`w-full h-11 px-3.5 bg-[#1A1C22]/60 border border-[#4FD1FF]/15 rounded-xl font-sans text-sm text-[#E5E7EB] placeholder:text-[#9CA3AF] focus:border-[#4FD1FF]/40 focus:ring-1 focus:ring-[#4FD1FF]/15 focus:outline-none transition-all ${props.className || ""}`} />
      {hint && <p className="text-[10px] font-sans text-[#4FD1FF]/60 mt-1">{hint}</p>}
    </div>
  );
}

/* ─── Select ─── */
export function Select({ label, hint, children, ...props }: { label: string; hint?: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-[11px] font-sans text-[#4FD1FF]/80 mb-1.5">{label}</label>
      <select {...props} className={`w-full h-11 px-3.5 bg-[#1A1C22]/60 border border-[#4FD1FF]/15 rounded-xl font-sans text-sm text-[#E5E7EB] focus:border-[#4FD1FF]/40 focus:ring-1 focus:ring-[#4FD1FF]/15 focus:outline-none transition-all appearance-none ${props.className || ""}`}>
        {children}
      </select>
      {hint && <p className="text-[10px] font-sans text-[#4FD1FF]/60 mt-1">{hint}</p>}
    </div>
  );
}

/* ─── Button ─── */
export function Btn({ children, variant = "primary", size = "md", ...props }: { children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost" | "purple"; size?: "sm" | "md" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex items-center justify-center gap-2 font-sans font-medium rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm" };
  const variants = {
    primary: "border border-[#4FD1FF]/30 bg-[#4FD1FF]/8 text-[#E5E7EB] hover:bg-[#4FD1FF]/15 hover:border-[#4FD1FF]/40 hover:shadow-[0_2px_12px_rgba(79,209,255,0.1)]",
    secondary: "border border-[#4FD1FF]/15 bg-transparent text-[#4FD1FF] hover:bg-[#4FD1FF]/8 hover:border-[#4FD1FF]/30",
    danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:shadow-[0_2px_12px_rgba(239,68,68,0.1)]",
    ghost: "border border-transparent text-[#4FD1FF]/80 hover:bg-[#4FD1FF]/8",
    purple: "border border-purple-400/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:border-purple-400/60 hover:shadow-[0_2px_12px_rgba(147,51,234,0.1)]",
  };
  return <button {...props} className={`${base} ${sizes[size]} ${variants[variant]} ${props.className || ""}`}>{children}</button>;
}

/* ─── Empty State ─── */
export function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl border border-[#4FD1FF]/10 bg-gradient-to-br from-[#4FD1FF]/8 to-[#9F7AEA]/8 flex items-center justify-center mx-auto mb-3">
        <Icon className="h-6 w-6 text-[#4FD1FF]/60" />
      </div>
      <p className="text-sm font-sans text-[#4FD1FF]/60">{text}</p>
    </div>
  );
}

/* ─── Loading State ─── */
export function LoadingState() {
  return <SkeletonLoader rows={4} type="list" />;
}

/* ─── Refresh Button ─── */
export function RefreshBtn({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="p-2 rounded-xl border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/30 hover:bg-[#4FD1FF]/8 transition-all disabled:opacity-40"
    >
      <RefreshCw className={`h-4 w-4 text-[#4FD1FF]/80 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}

/* ─── Hero Banner ─── */
export function HeroBanner({ title, subtitle, icon: Icon, variant = "cyan" }: {
  title: string; subtitle: string; icon?: any; variant?: "cyan" | "purple" | "green";
}) {
  const gradients = {
    cyan: "from-[#4FD1FF]/5 via-[#9F7AEA]/[0.03] to-[#9F7AEA]/5 border-[#4FD1FF]/15",
    purple: "from-purple-500/5 via-[#9F7AEA]/[0.03] to-transparent border-purple-500/15",
    green: "from-green-500/5 via-[#4FD1FF]/[0.03] to-transparent border-green-500/15",
  };
  const iconBg = {
    cyan: "bg-[#4FD1FF]/10",
    purple: "bg-purple-500/10",
    green: "bg-green-500/10",
  };
  const iconColor = {
    cyan: "text-[#4FD1FF]",
    purple: "text-purple-400",
    green: "text-green-400",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 sm:p-6 ${gradients[variant]}`}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl ${iconBg[variant]} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor[variant]}`} />
          </div>
        )}
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-sans text-transparent bg-clip-text bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA]">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-[#4FD1FF]/60 font-sans mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
export function StatCard({ label, value, icon: Icon, color, sub, onClick }: {
  label: string; value: number; icon: any; color: "cyan" | "blue" | "green" | "purple" | "red" | "yellow"; sub: string; onClick?: () => void;
}) {
  const colorStyles: Record<string, { card: string; icon: string; value: string }> = {
    cyan: { card: "border-[#4FD1FF]/20 bg-gradient-to-br from-[#4FD1FF]/5 to-transparent hover:border-[#4FD1FF]/30", icon: "text-[#4FD1FF] bg-[#4FD1FF]/8", value: "text-[#E5E7EB]" },
    blue: { card: "border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent hover:border-blue-500/30", icon: "text-blue-400 bg-blue-500/10", value: "text-blue-200" },
    green: { card: "border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent hover:border-green-500/30", icon: "text-green-400 bg-green-500/10", value: "text-green-200" },
    purple: { card: "border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent hover:border-purple-500/30", icon: "text-purple-400 bg-purple-500/10", value: "text-purple-200" },
    red: { card: "border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent hover:border-red-500/30", icon: "text-red-400 bg-red-500/10", value: "text-red-200" },
    yellow: { card: "border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-transparent hover:border-yellow-500/30", icon: "text-yellow-400 bg-yellow-500/10", value: "text-yellow-200" },
  };
  const style = colorStyles[color];
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 sm:p-5 text-left transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_4px_16px_rgba(79,209,255,0.06)] active:scale-[0.99] ${style.card}`}
    >
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-3 ${style.icon}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <p className={`text-2xl sm:text-3xl font-bold font-sans ${style.value}`}>
        <AnimatedCounter value={value} />
      </p>
      <p className="text-xs font-sans mt-1 text-[#4FD1FF]">{label}</p>
      <p className="text-[10px] font-sans mt-0.5 text-[#4FD1FF]/60">{sub}</p>
    </button>
  );
}

/* ─── Page Header ─── */
export function PageHeader({ title, subtitle, count, children }: {
  title: string; subtitle?: string; count?: number; children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-sans font-bold text-[#E5E7EB]">{title}</p>
          {count !== undefined && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-sans font-medium bg-[#4FD1FF]/8 text-[#4FD1FF] border border-[#4FD1FF]/20">
              {count}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] font-sans text-[#4FD1FF]/60 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex gap-2 shrink-0">{children}</div>}
    </div>
  );
}
