import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { LoginForm } from "@/components/ui/login-form";
import { useAuth } from "@/hooks/useAuth";
import React, { Suspense } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";
import { UpdateBanner } from "@/components/ui/update-banner";
import { AppLayout } from "@/components/ui/app-layout";

const NotFound = React.lazy(() => import("@/pages/not-found"));
const AutoWaste = React.lazy(() => import("@/pages/auto-waste"));
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const AdminPanel = React.lazy(() => import("@/pages/admin-panel"));
const PdfDownload = React.lazy(() => import("@/pages/pdf-download"));
const Profile = React.lazy(() => import("@/pages/profile"));

function UserRouter() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" text="Memuat halaman..." />}>
      <Switch>
        <Route path="/" component={AutoWaste} />
        <Route path="/auto-waste" component={AutoWaste} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/pdf" component={PdfDownload} />
        <Route path="/profile" component={Profile} />
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
  const { isSuperAdmin } = useAuth();

  return (
    <AppLayout>
      <main>
        <Toaster />
        <UpdateBanner />
        {isSuperAdmin ? <AdminRouter /> : <UserRouter />}
      </main>
    </AppLayout>
  );
}

function App() {
  const { isAuthenticated, isLoading, isLoggingOut, login } = useAuth();

  if (isLoading) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="product-destruction-theme">
        <div className="min-h-screen flex items-center justify-center bg-background">
          <LoadingSpinner size="lg" text="Lagi loading..." />
        </div>
      </ThemeProvider>
    );
  }

  if (isLoggingOut) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="product-destruction-theme">
        <div className="min-h-screen flex items-center justify-center bg-background">
          <LoadingSpinner size="lg" text="Keluar dari aplikasi..." />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="product-destruction-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {isAuthenticated ? (
            <AuthenticatedApp />
          ) : (
            <LoginForm onLogin={login} />
          )}
          <PWAInstallPrompt />
          <Analytics />
          <SpeedInsights />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
