import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  ShieldAlert,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import logoUrl from "@assets/waste-logo_1753322218969.webp";

const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginTenant {
  id: string;
  name: string;
}

interface LoginFormProps {
  onLogin: (
    name: string,
    role?: string,
    tenant_id?: string,
    tenant_name?: string,
    store_code?: string,
    token?: string
  ) => void;
}

function LoginShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0] flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-sm rounded-xl border-2 border-[#2a2a2a] bg-[#111] p-6 shadow-nb-md">
        <div className="mb-6 flex items-center gap-3">
          <img src={logoUrl} alt="AWAS" className="h-10 w-10 rounded-lg border-2 border-[#FFE500] shadow-nb-yellow object-contain" />
          <div>
            <p className="text-xs font-black tracking-widest text-[#FFE500] uppercase">AWAS</p>
            <p className="text-[10px] text-[#555]">Waste Control System</p>
          </div>
        </div>
        <div className="mb-6 space-y-1">
          <h2 className="text-xl font-black text-white">{title}</h2>
          <p className="text-xs text-[#666]">{subtitle}</p>
        </div>
        {children}
      </section>
    </div>
  );
}

function StatusPanel({
  tone,
  title,
  description,
  children,
  onBack,
}: {
  tone: "success" | "warning" | "danger";
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
  onBack?: () => void;
}) {
  const toneMap = {
    success: {
      icon: <CheckCircle2 className="h-6 w-6 text-[#4ADE80]" />,
      badge: "text-[#4ADE80]",
      shell: "bg-[#4ADE80]/10 border-[#4ADE80]/20",
    },
    warning: {
      icon: <ShieldAlert className="h-6 w-6 text-[#F59E0B]" />,
      badge: "text-[#F59E0B]",
      shell: "bg-[#F59E0B]/10 border-[#F59E0B]/20",
    },
    danger: {
      icon: <AlertCircle className="h-6 w-6 text-[#F87171]" />,
      badge: "text-[#F87171]",
      shell: "bg-[#F87171]/10 border-[#F87171]/20",
    },
  }[tone];

  return (
    <LoginShell title={title} subtitle="Status akun dan akses login ditampilkan di sini.">
      <div className="space-y-5">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${toneMap.shell}`}
        >
          {toneMap.icon}
        </div>

        <div className="space-y-2">
          <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${toneMap.badge}`}>
            Status Akun
          </p>
          <div className="text-sm leading-7 text-[#D6DEE9]">{description}</div>
        </div>

        {children}

        {onBack && (
          <Button variant="outline" className="w-full justify-center" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Kembali ke login
          </Button>
        )}
      </div>
    </LoginShell>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-[#666]">
      {children}
    </label>
  );
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loginResult, setLoginResult] = useState<any>(null);
  const [pendingState, setPendingState] = useState<{ email: string; name: string } | null>(null);
  const [rejectedState, setRejectedState] = useState<{ email: string } | null>(null);
  const [tenants, setTenants] = useState<LoginTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [tenantsLoading, setTenantsLoading] = useState(true);

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
      return;
    }

    if (googleAuth === "pending") {
      setPendingState({
        email: params.get("email") || "",
        name: params.get("name") || "",
      });
      window.history.replaceState({}, "", "/");
      return;
    }

    if (googleAuth === "rejected") {
      setRejectedState({ email: params.get("email") || "" });
      window.history.replaceState({}, "", "/");
      return;
    }

    if (googleAuth === "error") {
      setError(params.get("message") || "Login Google gagal.");
      window.history.replaceState({}, "", "/");
    }
  }, [onLogin]);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/login")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data.tenants) ? data.tenants : [];
        setTenants(list);
        if (list.length === 1) {
          setSelectedTenantId(list[0].id);
        }
      })
      .catch(() => {
        if (active) {
          setError("Gagal ambil daftar store. Coba refresh halaman.");
        }
      })
      .finally(() => {
        if (active) {
          setTenantsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const handleSubmit = async (data: LoginFormData) => {
    if (tenants.length > 0 && !selectedTenantId) {
      setError("Pilih store dulu sebelum login.");
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
        setError(json.error || "Login gagal.");
        form.setValue("password", "");
        return;
      }

      setLoginResult(json);
      setShowConfirm(true);
    } catch {
      setError("Tidak bisa terhubung ke server. Cek koneksi dan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    if (!selectedTenantId) {
      setError("Pilih store dulu sebelum login dengan Google.");
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

  if (pendingState) {
    return (
      <StatusPanel
        tone="warning"
        title="Menunggu Persetujuan"
        description={
          <>
            <p className="mb-2 text-white">
              Akun Google untuk <span className="font-semibold">{pendingState.name || "User"}</span>{" "}
              sudah terdaftar.
            </p>
            <p className="text-[#93A0B4]">
              Email <span className="text-white">{pendingState.email}</span> masih menunggu approval
              dari super admin sebelum bisa dipakai login.
            </p>
          </>
        }
        onBack={() => setPendingState(null)}
      />
    );
  }

  if (rejectedState) {
    return (
      <StatusPanel
        tone="danger"
        title="Akses Ditolak"
        description={
          <p className="text-[#93A0B4]">
            Email <span className="text-white">{rejectedState.email}</span> belum disetujui untuk
            mengakses aplikasi ini. Hubungi super admin jika ini seharusnya aktif.
          </p>
        }
        onBack={() => setRejectedState(null)}
      />
    );
  }

  if (showConfirm && loginResult) {
    const { user } = loginResult;

    return (
      <StatusPanel
        tone="success"
        title="Login Berhasil"
        description={
          <div className="space-y-2 text-sm">
            <p className="text-white">
              Masuk sebagai <span className="font-semibold">{user.username}</span>
            </p>
            <p className="text-[#93A0B4]">Role: {user.role === "super_admin" ? "Super Admin" : "Admin Store"}</p>
            {user.tenant_name ? (
              <p className="text-[#93A0B4]">Store: {user.tenant_name}</p>
            ) : (
              <p className="text-[#93A0B4]">Akses: Semua Store</p>
            )}
          </div>
        }
      >
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setShowConfirm(false);
              setLoginResult(null);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
          <Button className="flex-1" onClick={handleConfirmLogin}>
            Lanjut Masuk
          </Button>
        </div>
      </StatusPanel>
    );
  }

  return (
    <LoginShell title="Masuk ke aplikasi" subtitle="Pilih store dan masuk.">
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border-2 border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2.5 text-xs text-[#fca5a5]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ef4444]" />
            <span>{error}</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
            <div>
              <FieldLabel>Store</FieldLabel>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                disabled={isSubmitting || tenantsLoading}
                className="h-11 w-full rounded-lg border-2 border-[#2a2a2a] bg-[#0d0d0d] px-3 text-sm text-[#f0f0f0] outline-none transition focus:border-[#FFE500] disabled:opacity-50"
              >
                <option value="">{tenantsLoading ? "Memuat store..." : "Pilih store"}</option>
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
                  <FieldLabel>Username</FieldLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#555]" />
                      <Input
                        {...field}
                        type="text"
                        disabled={isSubmitting}
                        autoComplete="username"
                        placeholder="Masukkan username"
                        className="h-11 rounded-lg border-2 border-[#2a2a2a] bg-[#0d0d0d] pl-9 text-sm text-[#f0f0f0] placeholder:text-[#444] focus:border-[#FFE500] focus-visible:ring-0 focus-visible:ring-offset-0 normal-case"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-[10px] text-[#ef4444]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FieldLabel>Password</FieldLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#555]" />
                      <Input
                        {...field}
                        type="password"
                        disabled={isSubmitting}
                        autoComplete="current-password"
                        placeholder="Masukkan password"
                        className="h-11 rounded-lg border-2 border-[#2a2a2a] bg-[#0d0d0d] pl-9 text-sm text-[#f0f0f0] placeholder:text-[#444] focus:border-[#FFE500] focus-visible:ring-0 focus-visible:ring-offset-0 normal-case"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-[10px] text-[#ef4444]" />
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-lg border-2 border-[#000] bg-[#FFE500] text-sm font-black text-black shadow-nb transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-md active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa...
                </span>
              ) : "Masuk"}
            </button>
          </form>
        </Form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#222]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#444]">atau</span>
          <div className="h-px flex-1 bg-[#222]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSubmitting || tenantsLoading}
          className="h-11 w-full rounded-lg border-2 border-[#2a2a2a] bg-[#141414] text-sm font-bold text-[#ccc] shadow-nb-sm transition-all hover:border-[#444] hover:text-white hover:-translate-x-px hover:-translate-y-px hover:shadow-nb active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09A6.96 6.96 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335" />
          </svg>
          Masuk dengan Google
        </button>

        <div className="flex items-center justify-between border-t-2 border-[#1a1a1a] pt-3 text-[10px] text-[#444] font-mono">
          <span>AWAS v4.0.0</span>
          <span className="text-[#FFE500]/50">NEO BRUTALISM</span>
        </div>
      </div>
    </LoginShell>
  );
}
