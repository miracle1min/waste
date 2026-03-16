import React from "react";
import { Loader2, RefreshCw } from "lucide-react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-cyan-900/30 bg-gray-900/40 backdrop-blur-sm ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = "", action }: { children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={`px-4 py-3 sm:px-5 sm:py-4 border-b border-cyan-900/20 flex items-center justify-between ${className}`}>
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "purple" | "blue" }) {
  const styles = {
    default: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    success: "bg-green-500/10 text-green-300 border-green-500/20",
    warning: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    danger: "bg-red-500/10 text-red-300 border-red-500/20",
    purple: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border ${styles[variant]}`}>{children}</span>;
}

export function Input({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-[11px] font-mono text-cyan-500 mb-1.5">{label}</label>
      <input {...props} className={`w-full h-11 px-3.5 bg-black/30 border border-cyan-900/40 rounded-xl font-mono text-sm text-cyan-100 placeholder:text-cyan-800 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all ${props.className || ""}`} />
      {hint && <p className="text-[10px] font-mono text-cyan-700 mt-1">{hint}</p>}
    </div>
  );
}

export function Select({ label, hint, children, ...props }: { label: string; hint?: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-[11px] font-mono text-cyan-500 mb-1.5">{label}</label>
      <select {...props} className={`w-full h-11 px-3.5 bg-black/30 border border-cyan-900/40 rounded-xl font-mono text-sm text-cyan-100 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all appearance-none ${props.className || ""}`}>
        {children}
      </select>
      {hint && <p className="text-[10px] font-mono text-cyan-700 mt-1">{hint}</p>}
    </div>
  );
}

export function Btn({ children, variant = "primary", size = "md", ...props }: { children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost" | "purple"; size?: "sm" | "md" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex items-center justify-center gap-2 font-mono font-medium rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm" };
  const variants = {
    primary: "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-400/60",
    secondary: "border border-cyan-800/40 bg-transparent text-cyan-400 hover:bg-cyan-500/5 hover:border-cyan-600/50",
    danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
    ghost: "border border-transparent text-cyan-500 hover:bg-cyan-500/5",
    purple: "border border-purple-400/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:border-purple-400/60",
  };
  return <button {...props} className={`${base} ${sizes[size]} ${variants[variant]} ${props.className || ""}`}>{children}</button>;
}

export function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl border border-cyan-900/30 bg-cyan-500/5 flex items-center justify-center mx-auto mb-3">
        <Icon className="h-6 w-6 text-cyan-700" />
      </div>
      <p className="text-sm font-mono text-cyan-600">{text}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      <p className="text-xs font-mono text-cyan-600 mt-3">Loading...</p>
    </div>
  );
}

export function RefreshBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-2 rounded-xl border border-cyan-800/30 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all">
      <RefreshCw className="h-4 w-4 text-cyan-500" />
    </button>
  );
}
