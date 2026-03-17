import React from "react";
import { Loader2, RefreshCw } from "lucide-react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
 return <div className={`rounded-2xl border border-[#4FD1FF]/10 bg-[#1A1C22]/40 backdrop-blur-sm ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = "", action }: { children: React.ReactNode; className?: string; action?: React.ReactNode }) {
 return (
 <div className={`px-4 py-3 sm:px-5 sm:py-4 border-b border-[#4FD1FF]/10 flex items-center justify-between ${className}`}>
 <div>{children}</div>
 {action && <div>{action}</div>}
 </div>
 );
}

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

export function Input({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
 return (
 <div>
 <label className="block text-[11px] font-sans text-[#4FD1FF]/80 mb-1.5">{label}</label>
 <input {...props} className={`w-full h-11 px-3.5 bg-[#1A1C22]/60 border border-[#4FD1FF]/15 rounded-xl font-sans text-sm text-[#E5E7EB] placeholder:text-[#6B7280] focus:border-[#4FD1FF]/30/60 focus:ring-1 focus:ring-[#4FD1FF]/15 focus:outline-none transition-all ${props.className || ""}`} />
 {hint && <p className="text-[10px] font-sans text-[#4FD1FF]/60 mt-1">{hint}</p>}
 </div>
 );
}

export function Select({ label, hint, children, ...props }: { label: string; hint?: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
 return (
 <div>
 <label className="block text-[11px] font-sans text-[#4FD1FF]/80 mb-1.5">{label}</label>
 <select {...props} className={`w-full h-11 px-3.5 bg-[#1A1C22]/60 border border-[#4FD1FF]/15 rounded-xl font-sans text-sm text-[#E5E7EB] focus:border-[#4FD1FF]/30/60 focus:ring-1 focus:ring-[#4FD1FF]/15 focus:outline-none transition-all appearance-none ${props.className || ""}`}>
 {children}
 </select>
 {hint && <p className="text-[10px] font-sans text-[#4FD1FF]/60 mt-1">{hint}</p>}
 </div>
 );
}

export function Btn({ children, variant = "primary", size = "md", ...props }: { children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost" | "purple"; size?: "sm" | "md" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
 const base = "inline-flex items-center justify-center gap-2 font-sans font-medium rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]";
 const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm" };
 const variants = {
 primary: "border border-[#4FD1FF]/30 bg-[#4FD1FF]/8 text-[#E5E7EB] hover:bg-[#4FD1FF]/15 hover:border-[#4FD1FF]/40",
 secondary: "border border-[#4FD1FF]/15 bg-transparent text-[#4FD1FF] hover:bg-[#4FD1FF]/8 hover:border-[#4FD1FF]/30",
 danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
 ghost: "border border-transparent text-[#4FD1FF]/80 hover:bg-[#4FD1FF]/8",
 purple: "border border-purple-400/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:border-purple-400/60",
 };
 return <button {...props} className={`${base} ${sizes[size]} ${variants[variant]} ${props.className || ""}`}>{children}</button>;
}

export function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
 return (
 <div className="text-center py-16">
 <div className="w-14 h-14 rounded-2xl border border-[#4FD1FF]/10 bg-[#4FD1FF]/8 flex items-center justify-center mx-auto mb-3">
 <Icon className="h-6 w-6 text-[#4FD1FF]/60" />
 </div>
 <p className="text-sm font-sans text-[#4FD1FF]/60">{text}</p>
 </div>
 );
}

export function LoadingState() {
 return (
 <div className="flex flex-col items-center justify-center py-16">
 <Loader2 className="h-6 w-6 animate-spin text-[#4FD1FF]" />
 <p className="text-xs font-sans text-[#4FD1FF]/60 mt-3">Loading...</p>
 </div>
 );
}

export function RefreshBtn({ onClick }: { onClick: () => void }) {
 return (
 <button onClick={onClick} className="p-2 rounded-xl border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/30 hover:bg-[#4FD1FF]/8 transition-all">
 <RefreshCw className="h-4 w-4 text-[#4FD1FF]/80" />
 </button>
 );
}
