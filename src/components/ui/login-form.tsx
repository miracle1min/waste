import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock, Loader2, User, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import logoUrl from "@assets/waste-logo_1753322218969.webp";

const QC_OPTIONS = [
  { value: "JOHAN CLAUS THENU", label: "JOHAN CLAUS THENU" },
  { value: "M. RIZKI RAMDANI", label: "M. RIZKI RAMDANI" },
  { value: "LUISA RIKE FERNANDA", label: "LUISA RIKE FERNANDA" },
  { value: "PAJAR HIDAYAT", label: "PAJAR HIDAYAT" },
];

const loginSchema = z.object({
  qcName: z.string().min(1, "Pilih nama QC terlebih dahulu"),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onLogin: (qcName: string) => void;
}

// Typewriter effect component with repeat
function TypewriterText({ text, speed = 50 }: { text: string; speed?: number }) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isDeleting && currentIndex < text.length) {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      } else if (!isDeleting && currentIndex === text.length) {
        setTimeout(() => setIsDeleting(true), 1500);
      } else if (isDeleting && displayText.length > 0) {
        setDisplayText(prev => prev.slice(0, -1));
      } else if (isDeleting && displayText.length === 0) {
        setIsDeleting(false);
        setCurrentIndex(0);
      }
    }, isDeleting ? speed / 2 : speed);

    return () => clearTimeout(timeout);
  }, [currentIndex, text, speed, isDeleting, displayText]);

  return (
    <span className="inline-block">
      {displayText}
      <span className="animate-pulse ml-1">|</span>
    </span>
  );
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmedName, setConfirmedName] = useState("");

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      qcName: "",
      password: "",
    },
  });

  const handleSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setError(null);

    await new Promise(resolve => setTimeout(resolve, 500));

    if (data.password === "CKRBUL123") {
      setConfirmedName(data.qcName);
      setShowConfirm(true);
    } else {
      setError("Password salah. Silakan coba lagi.");
      form.setValue("password", "");
    }

    setIsSubmitting(false);
  };

  const handleConfirmLogin = () => {
    onLogin(confirmedName);
  };

  // Confirmation screen
  if (showConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Konfirmasi Login</h2>
              <p className="text-muted-foreground mt-2">Kamu akan masuk sebagai:</p>
              <p className="text-2xl font-bold mt-3 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                {confirmedName}
              </p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-11"
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmedName("");
                }}
              >
                Kembali
              </Button>
              <Button 
                className="flex-1 h-11 bg-green-600 hover:bg-green-700"
                onClick={handleConfirmLogin}
              >
                Ya, Masuk!
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src={logoUrl} 
              alt="Waste Management Logo" 
              className="h-24 w-24 sm:h-28 sm:w-28 object-contain"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              AWAS
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Aplikasi Waste Always Simple
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="qcName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Nama QC
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Pilih nama kamu" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {QC_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Masukkan password"
                        disabled={isSubmitting}
                        className="h-11"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            form.handleSubmit(handleSubmit)();
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  "Masuk"
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-muted-foreground min-h-[20px]">
            <p>
              <TypewriterText text="Pilih nama kamu dan masukkan password" speed={60} />
            </p>
          </div>
        </CardContent>
        
        <div className="px-6 pb-6">
          <div className="text-center text-xs text-muted-foreground border-t pt-4">
            <p className="font-medium">By Kang Pajar | Jangan Lupa ☕</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
