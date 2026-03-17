import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { AlertCircle, Lock, Loader2, User, CheckCircle2, Store } from "lucide-react";
import logoUrl from "@assets/waste-logo_1753322218969.webp";

const loginSchema = z.object({
  tenant_id: z.string().optional(),
  username: z.string().min(1, "Username jangan kosong dong"),
  password: z.string().min(1, "Password jangan kosong"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onLogin: (name: string, role?: string, tenant_id?: string, tenant_name?: string, store_code?: string, token?: string) => void;
}

interface TenantOption {
  id: string;
  name: string;
}

/* ── Soft Gradient Background ── */
function CyberBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      {/* Large blue orb */}
      <div
        className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full opacity-[0.05]"
        style={{
          background: "radial-gradient(circle, #4FD1FF 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "floatOrb1 12s ease-in-out infinite",
        }}
      />
      {/* Purple orb */}
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]"
        style={{
          background: "radial-gradient(circle, #9F7AEA 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "floatOrb2 15s ease-in-out infinite",
        }}
      />
      {/* Small accent orb */}
      <div
        className="absolute top-2/3 left-1/5 w-[250px] h-[250px] rounded-full opacity-[0.04]"
        style={{
          background: "radial-gradient(circle, #4FD1FF 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "floatOrb3 10s ease-in-out infinite",
        }}
      />
    </div>
  );
}

/* ── Gradient Text (replaces GlitchText) ── */
function GlitchText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`relative inline-block bg-gradient-to-r from-[#4FD1FF] via-[#7C9FFF] to-[#9F7AEA] bg-clip-text text-transparent ${className}`}>
      {text}
    </span>
  );
}

/* ── Typewriter ── */
function TypewriterText({ texts, speed = 80 }: { texts: string[]; speed?: number }) {
  const [displayText, setDisplayText] = useState("");
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = texts[textIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting && charIndex < current.length) {
        setDisplayText(current.slice(0, charIndex + 1));
        setCharIndex((c) => c + 1);
      } else if (!isDeleting && charIndex === current.length) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (isDeleting && displayText.length > 0) {
        setDisplayText((t) => t.slice(0, -1));
      } else if (isDeleting && displayText.length === 0) {
        setIsDeleting(false);
        setCharIndex(0);
        setTextIndex((i) => (i + 1) % texts.length);
      }
    }, isDeleting ? speed / 2 : speed);
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, displayText, textIndex, texts, speed]);

  return (
    <span className="text-[#4FD1FF]/60 text-sm">
      {displayText}
      <span className="animate-pulse text-[#4FD1FF]">▊</span>
    </span>
  );
}

/* ── Main Login Form ── */
export function LoginForm({ onLogin }: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loginResult, setLoginResult] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Menyambungkan ke server...");

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
      onLogin(username, role, tenant_id, tenant_name, "", token);
    } else if (googleAuth === "error") {
      const message = params.get("message") || "Login Google gagal.";
      setError(message);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Fetch tenants list for dropdown — with cache & loading messages
  useEffect(() => {
    (async () => {
      // Try cache first for instant display
      try {
        const cached = localStorage.getItem("waste_tenants_cache");
        if (cached) {
          const { tenants: cachedTenants, ts } = JSON.parse(cached);
          if (Date.now() - ts < 5 * 60 * 1000) { // 5 min cache
            setTenants(cachedTenants);
            setLoadingTenants(false);
          }
        }
      } catch {}

      // Fetch fresh data
      const msgTimer = setTimeout(() => setLoadingMsg("Membangunkan database..."), 2000);
      const msgTimer2 = setTimeout(() => setLoadingMsg("Hampir selesai, tunggu ya..."), 5000);
      try {
        const res = await fetch("/api/auth/login");
        const data = await res.json();
        if (data.tenants) {
          setTenants(data.tenants);
          localStorage.setItem("waste_tenants_cache", JSON.stringify({ tenants: data.tenants, ts: Date.now() }));
        }
      } catch (err) {
        console.error("Failed to fetch tenants:", err);
      } finally {
        clearTimeout(msgTimer);
        clearTimeout(msgTimer2);
        setLoadingTenants(false);
      }
    })();
  }, []);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { tenant_id: "", username: "", password: "" },
  });

  const handleSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          tenant_id: data.tenant_id || undefined,
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
                  <div className="absolute inset-0 rounded-full border-2 border-[#4ADE80]/20 animate-ping" />
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
                  <img src={logoUrl} alt="Logo" className="relative h-24 w-24 lg:h-28 lg:w-28 object-contain drop-shadow-[0_4px_12px_rgba(79,209,255,0.15)]" />
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-[#9CA3AF] tracking-[0.3em] uppercase mb-2">
                  Akses Sistem
                </div>
                <h1 className="text-4xl lg:text-5xl font-black tracking-wider">
                  <GlitchText text="AWAS" />
                </h1>
                <p className="text-[#6B7280] text-xs mt-2 tracking-widest">
                  APLIKASI WASTE ALWAYS SIMPLE
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[rgba(79,209,255,0.08)]" />
                <span className="text-[#4FD1FF]/30 text-[10px]">◆</span>
                <div className="flex-1 h-px bg-[rgba(79,209,255,0.08)]" />
              </div>
            </div>

            {error && (
              <div className="rounded-[12px] border border-[#F87171]/20 bg-[#F87171]/10 p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#F87171] flex-shrink-0" />
                <span className="text-[#F87171] text-sm">{error}</span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                {/* Tenant / Store Selector */}
                <FormField
                  control={form.control}
                  name="tenant_id"
                  render={({ field }) => (
                    <FormItem>
                      <div className="text-[10px] font-medium text-[#9CA3AF] tracking-wider uppercase mb-1.5 ml-1">
                        Pilih Resto
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4FD1FF]/60" />
                          {loadingTenants && tenants.length === 0 ? (
                            <div className="w-full h-12 pl-11 pr-4 bg-[#1A1C22] border border-[rgba(79,209,255,0.06)] rounded-[12px] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4FD1FF]" />
                                  <span className="text-xs text-[#9CA3AF]">{loadingMsg}</span>
                                </div>
                                <div className="mt-1.5 h-1 w-full bg-[#2A2D37] rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] rounded-full animate-pulse" style={{ width: '60%' }} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <select
                                {...field}
                                disabled={loadingTenants}
                                className="w-full h-12 pl-11 pr-4 bg-[#1A1C22] border border-[rgba(79,209,255,0.06)] rounded-[12px] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] text-sm text-[#E5E7EB] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:border-[#4FD1FF]/30 focus:outline-none hover:border-[#4FD1FF]/20 transition-all duration-200 appearance-none cursor-pointer"
                              >
                                <option value="" className="bg-[#23262F] text-[#9CA3AF]">
                                  — Pilih Resto —
                                </option>
                                {tenants.map((t) => (
                                  <option key={t.id} value={t.id} className="bg-[#23262F] text-[#E5E7EB]">
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="h-4 w-4 text-[#4FD1FF]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage className="text-[#F87171] text-xs" />
                    </FormItem>
                  )}
                />

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
                            className="h-12 pl-11 bg-[#1A1C22] border-[rgba(79,209,255,0.06)] rounded-[12px] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] text-sm text-[#E5E7EB] placeholder:text-[#6B7280] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:border-[#4FD1FF]/30 focus:ring-offset-0 hover:border-[#4FD1FF]/20 transition-all duration-200"
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
                            className="h-12 pl-11 bg-[#1A1C22] border-[rgba(79,209,255,0.06)] rounded-[12px] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] text-sm text-[#E5E7EB] placeholder:text-[#6B7280] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:border-[#4FD1FF]/30 focus:ring-offset-0 hover:border-[#4FD1FF]/20 transition-all duration-200"
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
              <span className="text-[#6B7280] text-xs">atau</span>
              <div className="flex-1 h-px bg-[rgba(79,209,255,0.08)]" />
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              disabled={loadingTenants}
              onClick={() => {
                const selectedTenantId = form.getValues("tenant_id") || "";
                window.location.href = `/api/auth/google?tenant_id=${encodeURIComponent(selectedTenantId)}`;
              }}
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

            <div className="text-center">
              <p className="text-[10px] text-[#6B7280]">Super Admin? Kosongin aja resto-nya</p>
            </div>

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
              <span className="text-[10px] text-[#6B7280]">By DirgaX | Jgn lupa ☕</span>
              <div className="flex-1 h-px bg-[rgba(79,209,255,0.08)]" />
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-between items-center px-2">
          <span className="text-[9px] text-[#6B7280]">SYS.v4.0.0</span>
          <span className="flex items-center gap-1.5 text-[9px] text-[#6B7280]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80] shadow-[0_0_4px_rgba(74,222,128,0.6)]" /> ONLINE
          </span>
        </div>
      </div>

      <style>{`
        @keyframes floatOrb1 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -20px); }
          66% { transform: translate(-20px, 15px); }
        }
        @keyframes floatOrb2 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-25px, 20px); }
          66% { transform: translate(15px, -25px); }
        }
        @keyframes floatOrb3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -15px); }
        }
      `}</style>
    </div>
  );
}
