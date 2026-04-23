import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { LoginForm } from "@/components/ui/login-form";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import React, { Suspense } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";
import { AppLayout } from "@/components/ui/app-layout";

const Analytics = React.lazy(() => import("@vercel/analytics/react").then((m) => ({ default: m.Analytics })));
const SpeedInsights = React.lazy(() => import("@vercel/speed-insights/react").then((m) => ({ default: m.SpeedInsights })));

const NotFound = React.lazy(() => import("@/pages/not-found"));
const AutoWaste = React.lazy(() => import("@/pages/auto-waste"));
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const AdminPanel = React.lazy(() => import("@/pages/admin-panel"));
const PdfDownload = React.lazy(() => import("@/pages/pdf-download"));
const Profile = React.lazy(() => import("@/pages/profile"));
const AiAssistant = React.lazy(() => import("@/pages/ai-assistant"));

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, message: error?.message || "Terjadi error tak terduga." };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App crashed:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171B22] p-6 text-center space-y-4">
            <h2 className="text-xl font-semibold text-white">Aplikasi perlu dimuat ulang</h2>
            <p className="text-sm text-[#9CA3AF]">
              {this.state.message || "Halaman mengalami gangguan saat memuat data."}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full rounded-xl bg-[#26364A] py-2.5 text-sm font-medium text-white hover:brightness-110 transition"
            >
              Refresh Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function UserRouter() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" text="Memuat halaman..." />}>
      <Switch>
        <Route path="/" component={AutoWaste} />
        <Route path="/auto-waste" component={AutoWaste} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/pdf" component={PdfDownload} />
        <Route path="/profile" component={Profile} />
        <Route path="/ai" component={AiAssistant} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AdminRouter() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" text="Memuat halaman..." />}>
      <Switch>
        <Route path="/" component={AdminPanel} />
        <Route path="/dashboard" component={Dashboard} />
        <Route component={AdminPanel} />
      </Switch>
    </Suspense>
  );
}

function AuthenticatedApp() {
  const { isSuperAdmin } = useAuthContext();

  return (
    <AppLayout>
      <main>
        <Toaster />
        {isSuperAdmin ? <AdminRouter /> : <UserRouter />}
      </main>
    </AppLayout>
  );
}

function LogoutScreen({ reason }: { reason?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 animate-in fade-in duration-500">
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 animate-pulse" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center border border-yellow-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Logging out...</h2>
          {reason && (
            <p className="text-sm text-gray-400 max-w-xs mx-auto">{reason}</p>
          )}
        </div>

        <div className="w-48 mx-auto h-1 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"
            style={{
              animation: "logoutProgress 1.5s ease-in-out forwards",
            }}
          />
        </div>

        <p className="text-xs text-gray-500">Redirecting ke halaman login...</p>
      </div>

      <style>{`
        @keyframes logoutProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, isLoggingOut, logoutReason, login } = useAuthContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Lagi loading..." />
      </div>
    );
  }

  if (isLoggingOut) {
    return (
      <>
        <LogoutScreen reason={logoutReason} />
        <Toaster />
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {isAuthenticated ? (
          <AuthenticatedApp />
        ) : (
          <LoginForm onLogin={login} />
        )}
        <PWAInstallPrompt />
        <Suspense fallback={null}>
          <Analytics />
          <SpeedInsights />
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="product-destruction-theme">
      <AuthProvider>
        <AppErrorBoundary>
          <AppContent />
        </AppErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
