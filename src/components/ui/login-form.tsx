import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { AlertCircle, Lock, Loader2, User, CheckCircle2, Clock, ShieldX, ArrowLeft } from "lucide-react";
import logoUrl from "@assets/waste-logo_1753322218969.webp";

const loginSchema = z.object({
  username: z.string().min(1, "Username jangan kosong dong"),
  password: z.string().min(1, "Password jangan kosong"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginTenant {
  id: string;
  name: string;
}

interface LoginFormProps {
  onLogin: (name: string, role?: string, tenant_id?: string, tenant_name?: string, store_code?: string, token?: string) => void;
}



/* ── Soft Gradient Background ── */
function CyberBackground() {
  return (
    <div className="fixed inset-0 z-0 bg-[#F8FAFC]">
      <div className="absolute inset-0 opacity-100" style={{
        backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(14,165,233,0.12), transparent 30rem), linear-gradient(180deg, #f8fafc 0%, #eef5fb 100%)',
      }} />
    </div>
  );
}

/* ── Gradient Text (replaces GlitchText) ── */
function GlitchText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`relative inline-block text-slate-950 ${className}`}>
      {text}
    </span>
  );
}

/* ── Typewriter ── */
function TypewriterText({ texts }: { texts: string[]; speed?: number }) {
  return (
    <span className="text-slate-500 text-sm">{texts[0]}</span>
  );
}

/* ── Main Login Form ── */
export function LoginForm({ onLogin }: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loginResult, setLoginResult] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [pendingState, setPendingState] = useState<{ email: string; name: string } | null>(null);
  const [rejectedState, setRejectedState] = useState<{ email: string } | null>(null);
  const [tenants, setTenants] = useState<LoginTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [tenantsLoading, setTenantsLoading] = useState(true);

  // Handle Google OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleAuth = params.get("google_auth");

    if (googleAuth === "success") {
      const token = params.get("token") || "";
      const username = params.get("username") || "";
      const role = params.get("role") || "";
      const tenant_id = params.get("tenant_id") || "";
      const tenant_name = params.get("tenant_name") || "";
      const display_name = params.get("display_name") || "";

      if (token) {
        localStorage.setItem("waste_app_token", token);
      }
      window.history.replaceState({}, "", "/");
      onLogin(display_name || username, role, tenant_id, tenant_name, "", token);
    } else if (googleAuth === "pending") {
      const email = params.get("email") || "";
      const name = params.get("name") || "";
      setPendingState({ email, name });
      window.history.replaceState({}, "", "/");
    } else if (googleAuth === "rejected") {
      const email = params.get("email") || "";
      setRejectedState({ email });
      window.history.replaceState({}, "", "/");
    } else if (googleAuth === "error") {
      const message = params.get("message") || "Login Google gagal.";
      setError(message);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/login")
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data.tenants) ? data.tenants : [];
        setTenants(list);
        if (list.length === 1) setSelectedTenantId(list[0].id);
      })
      .catch(() => {
        if (alive) setError("Gagal ambil daftar resto. Coba refresh halaman.");
      })
      .finally(() => {
        if (alive) setTenantsLoading(false);
      });
    return () => { alive = false; };
  }, []);

  // Show "just updated" info banner if force-refreshed by deploy
  const [justUpdated, setJustUpdated] = useState(() => {
    const flag = localStorage.getItem("waste_app_just_updated");
    if (flag) {
      localStorage.removeItem("waste_app_just_updated");
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (justUpdated) {
      const t = setTimeout(() => setJustUpdated(false), 8000);
      return () => clearTimeout(t);
    }
  }, [justUpdated]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);


  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const handleSubmit = async (data: LoginFormData) => {
    if (tenants.length > 0 && !selectedTenantId) {
      setError("Pilih resto dulu sebelum login.");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          tenant_id: selectedTenantId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Login gagal, coba lagi");
        form.setValue("password", "");
      } else {
        setLoginResult(json);
        setShowConfirm(true);
      }
    } catch (err) {
      setError("Ga bisa konek ke server, cek internet lo");
    }
    setIsSubmitting(false);
  };

  const handleGoogleLogin = () => {
    if (!selectedTenantId) {
      setError("Pilih resto dulu sebelum login dengan Google.");
      return;
    }
    window.location.href = `/api/auth/google?tenant_id=${encodeURIComponent(selectedTenantId)}`;
  };

  const handleConfirmLogin = () => {
    const { user, token } = loginResult;
    onLogin(
      user.username,
      user.role,
      user.tenant_id === "ALL" ? "" : user.tenant_id,
      user.tenant_name || "",
      "",
      token || ""
    );
  };

  /* ── Pending Approval Screen ── */
  if (pendingState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1C22] p-4 overflow-hidden">
        <CyberBackground />
        <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="relative rounded-[24px] bg-gradient-to-br from-[#23262F] to-[#1F2128] border border-[rgba(79,209,255,0.06)] p-8 shadow-[8px_8px_20px_rgba(0,0,0,0.5),-4px_-4px_12px_rgba(255,255,255,0.05)]">
            <div className="text-center space-y-6">
              {/* Animated clock icon */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full flex items-center justify-center bg-[#F59E0B]/10 shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)]">
                    <Clock className="h-10 w-10 text-[#F59E0B]" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-[#F59E0B]/70 tracking-[0.3em] uppercase">Menunggu Persetujuan</p>
                <p className="text-[#E5E7EB] text-lg font-bold mt-3">
                  Halo, {pendingState.name || "User"}! 👋
                </p>
                <p className="text-[#9CA3AF] text-sm mt-2 leading-relaxed">
                  Akun Google kamu sudah terdaftar dengan email:
                </p>
                <p className="text-[#4FD1FF] text-sm font-medium mt-1">
                  {pendingState.email}
                </p>
              </div>

              {/* Info box */}
              <div className="rounded-[12px] bg-[#F59E0B]/5 border border-[#F59E0B]/20 p-4 text-left space-y-2">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-[#F59E0B] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[#E5E7EB] text-sm font-medium">Perlu persetujuan Super Admin</p>
                    <p className="text-[#9CA3AF] text-xs mt-1 leading-relaxed">
                      Pendaftaran kamu sedang menunggu persetujuan dari Super Admin. 
                      Kamu akan bisa login setelah akunmu di-approve.
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#4ADE80] shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
                  <span className="text-[10px] text-[#9CA3AF]">Daftar</span>
                </div>
                <div className="w-8 h-px bg-[#F59E0B]/40" />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#F59E0B] animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                  <span className="text-[10px] text-[#F59E0B]">Review</span>
                </div>
                <div className="w-8 h-px bg-[#6B7280]/40" />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#6B7280]/40" />
                  <span className="text-[10px] text-[#9CA3AF]">Aktif</span>
                </div>
              </div>

              <button
                onClick={() => setPendingState(null)}
                className="w-full h-12 rounded-[12px] font-semibold text-sm tracking-wide bg-[#23262F] border border-[rgba(79,209,255,0.06)] text-[#4FD1FF] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:-translate-y-0.5 active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] active:scale-[0.97] transition-all duration-200 ease-in-out"
              >
                <span className="flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" /> Kembali ke Login
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Rejected Screen ── */
  if (rejectedState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1C22] p-4 overflow-hidden">
        <CyberBackground />
        <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="relative rounded-[24px] bg-gradient-to-br from-[#23262F] to-[#1F2128] border border-[rgba(79,209,255,0.06)] p-8 shadow-[8px_8px_20px_rgba(0,0,0,0.5),-4px_-4px_12px_rgba(255,255,255,0.05)]">
            <div className="text-center space-y-6">
              {/* Rejected icon */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full flex items-center justify-center bg-[#F87171]/10 shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)]">
                    <ShieldX className="h-10 w-10 text-[#F87171]" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-[#F87171]/70 tracking-[0.3em] uppercase">Akses Ditolak</p>
                <p className="text-[#9CA3AF] text-sm mt-3 leading-relaxed">
                  Pendaftaran untuk email berikut telah ditolak oleh Super Admin:
                </p>
                <p className="text-[#F87171] text-sm font-medium mt-1">
                  {rejectedState.email}
                </p>
              </div>

              {/* Info box */}
              <div className="rounded-[12px] bg-[#F87171]/5 border border-[#F87171]/20 p-4 text-left space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldX className="h-4 w-4 text-[#F87171] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[#E5E7EB] text-sm font-medium">Akun tidak disetujui</p>
                    <p className="text-[#9CA3AF] text-xs mt-1 leading-relaxed">
                      Hubungi Super Admin jika kamu merasa ini adalah kesalahan, atau coba daftar ulang dengan akun Google yang berbeda.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setRejectedState(null)}
                className="w-full h-12 rounded-[12px] font-semibold text-sm tracking-wide bg-[#23262F] border border-[rgba(79,209,255,0.06)] text-[#4FD1FF] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:-translate-y-0.5 active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] active:scale-[0.97] transition-all duration-200 ease-in-out"
              >
                <span className="flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" /> Kembali ke Login
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Confirmation Screen ── */
  if (showConfirm && loginResult) {
    const { user } = loginResult;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1C22] p-4 overflow-hidden">
        <CyberBackground />

        <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="relative rounded-[24px] bg-gradient-to-br from-[#23262F] to-[#1F2128] border border-[rgba(79,209,255,0.06)] p-8 shadow-[8px_8px_20px_rgba(0,0,0,0.5),-4px_-4px_12px_rgba(255,255,255,0.05)]">

            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full flex items-center justify-center bg-[#4ADE80]/10 shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)]">
                    <CheckCircle2 className="h-10 w-10 text-[#4ADE80]" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-[#4ADE80]/70 tracking-[0.3em] uppercase">Login Berhasil</p>
                <p className="text-[#9CA3AF] text-sm mt-3">Lo masuk sebagai:</p>
                <p className="text-2xl font-bold mt-2 tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#4FD1FF] via-[#7C9FFF] to-[#9F7AEA]">
                  {user.username.toUpperCase()}
                </p>
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-[#9CA3AF]">
                    Role: <span className="text-[#E5E7EB]">{user.role === 'super_admin' ? '👑 Super Admin' : '🔍 QC / Quality Control'}</span>
                  </p>
                  {user.tenant_name && (
                    <p className="text-xs text-[#9CA3AF]">
                      Resto: <span className="text-[#E5E7EB]">{user.tenant_name}</span>
                    </p>
                  )}
                  {user.role === 'super_admin' && !user.tenant_name && (
                    <p className="text-xs text-[#9CA3AF]">
                      Akses: <span className="text-[#E5E7EB]">Semua Store</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowConfirm(false); setLoginResult(null); }}
                  className="flex-1 h-12 rounded-[12px] bg-[#23262F] border border-[rgba(79,209,255,0.06)] text-[#9CA3AF] font-medium text-sm shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:-translate-y-0.5 active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] active:scale-[0.97] transition-all duration-200 ease-in-out"
                >
                  ← Balik
                </button>
                <button
                  onClick={handleConfirmLogin}
                  className="flex-1 h-12 rounded-[12px] bg-[#23262F] border border-[rgba(79,209,255,0.06)] text-[#4FD1FF] font-bold text-sm shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:-translate-y-0.5 active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] active:scale-[0.97] transition-all duration-200 ease-in-out"
                >
                  Gas Masuk! →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Login Screen ── */
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1C22] p-4 overflow-hidden">
      <CyberBackground />

      <div className={`relative z-10 w-full max-w-md lg:max-w-lg transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="relative rounded-[24px] bg-gradient-to-br from-[#23262F] to-[#1F2128] border border-[rgba(79,209,255,0.06)] shadow-[8px_8px_20px_rgba(0,0,0,0.5),-4px_-4px_12px_rgba(255,255,255,0.05)] overflow-hidden">
          {/* Subtle inner highlight */}
          <div className="absolute top-0 left-0 w-full h-full rounded-[24px] bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

          <div className="p-8 lg:p-10 space-y-6 relative">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <img src={logoUrl} alt="Logo" width={112} height={112} className="relative h-24 w-24 lg:h-28 lg:w-28 object-contain drop-shadow-[0_4px_12px_rgba(79,209,255,0.15)]" />
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-[#9CA3AF] tracking-[0.3em] uppercase mb-2">
                  Akses Sistem
                </div>
                <h1 className="text-4xl lg:text-5xl font-black tracking-wider">
                  <GlitchText text="AWAS" />
                </h1>
                <p className="text-[#9CA3AF] text-xs mt-2 tracking-widest">
                  APLIKASI WASTE ALWAYS SIMPLE
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[rgba(79,209,255,0.08)]" />
                <span className="text-[#4FD1FF]/30 text-[10px]">◆</span>
                <div className="flex-1 h-px bg-[rgba(79,209,255,0.08)]" />
              </div>
            </div>

            {justUpdated && (
              <div className="rounded-[12px] border border-[#4FD1FF]/20 bg-[#4FD1FF]/10 p-3 flex items-center gap-2 animate-in fade-in duration-300">
                <CheckCircle2 className="h-4 w-4 text-[#4FD1FF] flex-shrink-0" />
                <span className="text-[#4FD1FF] text-sm">Aplikasi berhasil di-update! Silakan login kembali.</span>
              </div>
            )}

            {error && (
              <div className="rounded-[12px] border border-[#F87171]/20 bg-[#F87171]/10 p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#F87171] flex-shrink-0" />
                <span className="text-[#F87171] text-sm">{error}</span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div>
                  <div className="text-[10px] font-medium text-[#9CA3AF] tracking-wider uppercase mb-1.5 ml-1">
                    Resto
                  </div>
                  <select
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    disabled={isSubmitting || tenantsLoading}
                    className="w-full h-12 px-4 bg-[#1A1C22] border border-[rgba(79,209,255,0.06)] rounded-[12px] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] text-sm text-[#E5E7EB] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:border-[#4FD1FF]/30 focus:ring-offset-0 hover:border-[#4FD1FF]/20 transition-all duration-200"
                  >
                    <option value="">{tenantsLoading ? "Memuat resto..." : "Pilih resto..."}</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                    ))}
                  </select>
                </div>

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <div className="text-[10px] font-medium text-[#9CA3AF] tracking-wider uppercase mb-1.5 ml-1">
                        Username
                      </div>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4FD1FF]/60" />
                          <Input
                            {...field}
                            type="text"
                            placeholder="Ketik username lo..."
                            disabled={isSubmitting}
                            autoComplete="username"
                            className="h-12 pl-11 bg-[#1A1C22] border-[rgba(79,209,255,0.06)] rounded-[12px] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] text-sm text-[#E5E7EB] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:border-[#4FD1FF]/30 focus:ring-offset-0 hover:border-[#4FD1FF]/20 transition-all duration-200"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[#F87171] text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="text-[10px] font-medium text-[#9CA3AF] tracking-wider uppercase mb-1.5 ml-1">
                        Password
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4FD1FF]/60" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="••••••••"
                            disabled={isSubmitting}
                            autoComplete="current-password"
                            className="h-12 pl-11 bg-[#1A1C22] border-[rgba(79,209,255,0.06)] rounded-[12px] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] text-sm text-[#E5E7EB] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:border-[#4FD1FF]/30 focus:ring-offset-0 hover:border-[#4FD1FF]/20 transition-all duration-200"
                            onKeyDown={(e) => { if (e.key === "Enter") form.handleSubmit(handleSubmit)(); }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[#F87171] text-xs" />
                    </FormItem>
                  )}
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-[12px] font-semibold text-sm tracking-wide uppercase bg-[#23262F] border border-[rgba(79,209,255,0.06)] text-[#4FD1FF] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:-translate-y-0.5 active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] active:scale-[0.97] transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Lagi ngecek...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">MASUK →</span>
                  )}
                </button>
              </form>
            </Form>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[rgba(79,209,255,0.08)]" />
              <span className="text-[#9CA3AF] text-xs">atau</span>
              <div className="flex-1 h-px bg-[rgba(79,209,255,0.08)]" />
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full h-12 rounded-[12px] font-semibold text-sm tracking-wide bg-[#2A2D37] border border-[rgba(79,209,255,0.06)] text-[#E5E7EB] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.45),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:-translate-y-0.5 active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] active:scale-[0.97] transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-3">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Masuk dengan Google
              </span>
            </button>

            <div className="text-center min-h-[20px]">
              <TypewriterText
                texts={[
                  "Pilih resto, masukin kredensial",
                  "Waste tracking simpel abis ☕",
                  "Sistem siap. Gas aja...",
                ]}
                speed={60}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-[rgba(79,209,255,0.08)]" />
              <span className="text-[10px] text-[#9CA3AF]">By DirgaX | Jgn lupa ☕</span>
              <div className="flex-1 h-px bg-[rgba(79,209,255,0.08)]" />
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-between items-center px-2">
          <span className="text-[9px] text-[#9CA3AF]">SYS.v4.0.0</span>
          <span className="flex items-center gap-1.5 text-[9px] text-[#9CA3AF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80] shadow-[0_0_4px_rgba(74,222,128,0.6)]" /> ONLINE
          </span>
        </div>
      </div>
    </div>
  );
}
