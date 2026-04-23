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
    <div className="min-h-screen bg-[#111318] text-[#E7ECF3]">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-10 sm:px-6">
        <section className="w-full rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,#181C23_0%,#14181F_100%)] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.5)] sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <img src={logoUrl} alt="AWAS Logo" className="h-12 w-12 rounded-2xl object-contain" />
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-[#8FA4BF]">AWAS</p>
              <p className="text-xs text-[#93A0B4]">Waste Control System</p>
            </div>
          </div>

          <div className="mb-7 space-y-1.5">
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
            <p className="text-sm text-[#93A0B4]">{subtitle}</p>
          </div>

          {children}
        </section>
        </div>
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
    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8BA0]">
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
    <LoginShell
      title="Masuk ke aplikasi"
      subtitle="Pilih store dan masuk."
    >
      <div className="space-y-5">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#F87171]/20 bg-[#F87171]/10 px-4 py-3 text-sm text-[#FFC0C0]">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#F87171]" />
            <span>{error}</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <FieldLabel>Store</FieldLabel>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                disabled={isSubmitting || tenantsLoading}
                className="flex h-12 w-full rounded-[14px] border border-white/8 bg-[#10141A] px-4 text-sm text-[#E7ECF3] outline-none transition focus:border-[#4FD1FF]/40"
              >
                <option value="">{tenantsLoading ? "Memuat store..." : "Pilih store"}</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
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
                      <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718299]" />
                      <Input
                        {...field}
                        type="text"
                        disabled={isSubmitting}
                        autoComplete="username"
                        placeholder="Masukkan username"
                        className="h-12 rounded-[14px] border-white/8 bg-[#10141A] pl-11 text-sm normal-case"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs text-[#F87171]" />
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
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718299]" />
                      <Input
                        {...field}
                        type="password"
                        disabled={isSubmitting}
                        autoComplete="current-password"
                        placeholder="Masukkan password"
                        className="h-12 rounded-[14px] border-white/8 bg-[#10141A] pl-11 text-sm normal-case"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs text-[#F87171]" />
                </FormItem>
              )}
            />

            <Button type="submit" className="h-12 w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memeriksa akun...
                </>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>
        </Form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/8" />
          <span className="text-xs uppercase tracking-[0.18em] text-[#6F7C8D]">atau</span>
          <div className="h-px flex-1 bg-white/8" />
        </div>

        <Button
          type="button"
          variant="secondary"
          className="h-12 w-full"
          onClick={handleGoogleLogin}
          disabled={isSubmitting || tenantsLoading}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09A6.96 6.96 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              fill="#EA4335"
            />
          </svg>
          Masuk dengan Google
        </Button>

        <div className="flex items-center justify-between border-t border-white/8 pt-4 text-xs text-[#758499]">
          <span>UI dark minimal</span>
          <span>v4.0.0</span>
        </div>
      </div>
    </LoginShell>
  );
}
