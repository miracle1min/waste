import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { AlertCircle, Lock, Loader2, User, CheckCircle2 } from "lucide-react";
import logoUrl from "@assets/waste-logo_1753322218969.webp";

const loginSchema = z.object({
  username: z.string().min(1, "Username jangan kosong dong"),
  password: z.string().min(1, "Password jangan kosong"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onLogin: (name: string, role?: string, tenant_id?: string, tenant_name?: string, store_code?: string) => void;
}

/* ── Animated Background ── */
function CyberBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(0, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;

        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 255, ${p.opacity})`; ctx.fill();

        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 255, ${p.opacity * 0.15})`; ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.06 * (1 - dist / 120)})`; ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0" />;
}

/* ── Glitch Text ── */
function GlitchText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="cyber-glitch-1 absolute top-0 left-0 w-full" aria-hidden="true">{text}</span>
      <span className="cyber-glitch-2 absolute top-0 left-0 w-full" aria-hidden="true">{text}</span>
      <span className="relative">{text}</span>
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
    <span className="text-cyan-400/70 text-sm font-mono">
      {displayText}
      <span className="animate-pulse text-cyan-300">▊</span>
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

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const handleSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.username, password: data.password }),
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
    const { user, tenant } = loginResult;
    onLogin(
      user.username,
      user.role,
      user.tenant_id === "ALL" ? "" : user.tenant_id,
      tenant?.name || "",
      tenant?.store_code || ""
    );
  };

  /* ── Confirmation Screen ── */
  if (showConfirm && loginResult) {
    const { user, tenant } = loginResult;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 overflow-hidden">
        <CyberBackground />
        <div className="fixed inset-0 z-[1] pointer-events-none opacity-[0.03]" style={{backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,255,0.1) 2px,rgba(0,255,255,0.1) 4px)"}} />

        <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="relative rounded-2xl border border-cyan-500/30 bg-gray-950/80 backdrop-blur-xl p-8 shadow-[0_0_40px_rgba(0,255,255,0.1)]">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-400 rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-400 rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-400 rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-400 rounded-br-2xl" />

            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full border-2 border-green-400/50 flex items-center justify-center bg-green-500/10 shadow-[0_0_30px_rgba(0,255,128,0.2)]">
                    <CheckCircle2 className="h-10 w-10 text-green-400" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-green-400/20 animate-ping" />
                </div>
              </div>

              <div>
                <p className="text-xs font-mono text-green-400/60 tracking-[0.3em] uppercase">Login Berhasil</p>
                <p className="text-cyan-400/70 text-sm font-mono mt-3">Lo masuk sebagai:</p>
                <p className="text-2xl font-bold mt-2 font-mono tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400">
                  {user.username.toUpperCase()}
                </p>
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-mono text-cyan-500/60">
                    Role: <span className="text-cyan-300">{user.role === 'super_admin' ? '👑 Super Admin' : '👤 Admin Store'}</span>
                  </p>
                  {tenant && (
                    <p className="text-xs font-mono text-cyan-500/60">
                      Store: <span className="text-cyan-300">{tenant.name}</span>
                    </p>
                  )}
                  {user.role === 'super_admin' && !tenant && (
                    <p className="text-xs font-mono text-cyan-500/60">
                      Akses: <span className="text-cyan-300">Semua Store</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowConfirm(false); setLoginResult(null); }}
                  className="flex-1 h-12 rounded-lg border border-cyan-800/50 bg-transparent text-cyan-400 font-mono text-sm hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all duration-300"
                >
                  ← Balik
                </button>
                <button
                  onClick={handleConfirmLogin}
                  className="flex-1 h-12 rounded-lg border border-cyan-400/50 bg-cyan-500/10 text-cyan-200 font-bold font-mono text-sm hover:bg-cyan-500/20 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all duration-300 active:scale-95"
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
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 overflow-hidden">
      <CyberBackground />
      <div className="fixed inset-0 z-[1] pointer-events-none opacity-[0.03]" style={{backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,255,0.1) 2px,rgba(0,255,255,0.1) 4px)"}} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[100px] z-0" />

      <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="relative rounded-2xl border border-cyan-500/20 bg-gray-950/80 backdrop-blur-xl shadow-[0_0_50px_rgba(0,255,255,0.08)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400/60 rounded-tl-2xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400/60 rounded-tr-2xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400/60 rounded-bl-2xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400/60 rounded-br-2xl" />

          <div className="p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl scale-150" />
                  <img src={logoUrl} alt="Logo" className="relative h-24 w-24 object-contain drop-shadow-[0_0_15px_rgba(0,255,255,0.4)]" />
                </div>
              </div>

              <div>
                <div className="text-xs font-mono text-cyan-500/50 tracking-[0.4em] uppercase mb-2">
                  // akses sistem
                </div>
                <h1 className="text-4xl font-black tracking-wider">
                  <GlitchText text="AWAS" className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500" />
                </h1>
                <p className="text-cyan-400/50 text-xs font-mono mt-2 tracking-widest">
                  APLIKASI WASTE ALWAYS SIMPLE
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-cyan-500/30" />
                <span className="text-cyan-500/40 text-[10px] font-mono">◆</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-cyan-500/30" />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <span className="text-red-300 text-sm font-mono">{error}</span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <div className="text-[10px] font-mono text-cyan-600 tracking-wider uppercase mb-1.5 ml-1">
                        ▸ Username
                      </div>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-500" />
                          <Input
                            {...field}
                            type="text"
                            placeholder="Ketik username lo..."
                            disabled={isSubmitting}
                            autoComplete="username"
                            className="h-12 pl-11 bg-black/40 backdrop-blur-sm border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 placeholder:text-cyan-700/50 focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,255,255,0.3)] focus:ring-0 focus:ring-offset-0 hover:border-cyan-400/60 transition-all duration-300"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs font-mono" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="text-[10px] font-mono text-cyan-600 tracking-wider uppercase mb-1.5 ml-1">
                        ▸ Password
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-500" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="••••••••"
                            disabled={isSubmitting}
                            autoComplete="current-password"
                            className="h-12 pl-11 bg-black/40 backdrop-blur-sm border-cyan-900/50 rounded-lg font-mono text-sm text-cyan-100 placeholder:text-cyan-700/50 focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,255,255,0.3)] focus:ring-0 focus:ring-offset-0 hover:border-cyan-400/60 transition-all duration-300"
                            onKeyDown={(e) => { if (e.key === "Enter") form.handleSubmit(handleSubmit)(); }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs font-mono" />
                    </FormItem>
                  )}
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="relative w-full h-12 rounded-lg font-bold font-mono text-sm tracking-wider uppercase overflow-hidden border border-cyan-400/50 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 text-cyan-200 transition-all duration-300 hover:bg-gradient-to-r hover:from-cyan-500/20 hover:via-blue-500/20 hover:to-purple-500/20 hover:shadow-[0_0_25px_rgba(0,255,255,0.25)] hover:border-cyan-300/60 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
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

            <div className="text-center min-h-[20px]">
              <TypewriterText
                texts={[
                  "Masukin kredensial buat lanjut",
                  "Waste tracking simpel abis ☕",
                  "Sistem siap. Gas aja...",
                ]}
                speed={60}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-cyan-500/20" />
              <span className="text-[10px] font-mono text-cyan-700/50">By DirgaX | Jgn lupa ☕</span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-cyan-500/20" />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        </div>

        <div className="mt-3 flex justify-between items-center px-2">
          <span className="text-[9px] font-mono text-cyan-800/40">SYS.v4.0.0</span>
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-800/40">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(0,255,128,0.8)]" /> ONLINE
          </span>
        </div>
      </div>

      <style>{`
        @keyframes glitch1 {
          0%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
          20% { clip-path: inset(20% 0 60% 0); transform: translate(-2px, -1px); }
          40% { clip-path: inset(60% 0 10% 0); transform: translate(2px, 1px); }
          60% { clip-path: inset(40% 0 30% 0); transform: translate(-1px, 2px); }
          80% { clip-path: inset(10% 0 80% 0); transform: translate(1px, -2px); }
        }
        @keyframes glitch2 {
          0%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
          20% { clip-path: inset(70% 0 10% 0); transform: translate(2px, 1px); }
          40% { clip-path: inset(10% 0 70% 0); transform: translate(-2px, -1px); }
          60% { clip-path: inset(30% 0 40% 0); transform: translate(1px, -2px); }
          80% { clip-path: inset(80% 0 5% 0); transform: translate(-1px, 2px); }
        }
        .cyber-glitch-1 { animation: glitch1 3s infinite; color: #ff00ff; opacity: 0.7; }
        .cyber-glitch-2 { animation: glitch2 3s infinite; color: #00ffff; opacity: 0.7; }
      `}</style>
    </div>
  );
}
