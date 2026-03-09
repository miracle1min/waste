import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { LoginForm } from "@/components/ui/login-form";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import NotFound from "@/pages/not-found";
import ModeSelector from "@/pages/mode-selector";
import ProductDestruction from "@/pages/product-destruction";
import AutoWaste from "@/pages/auto-waste";
import Dashboard from "@/pages/dashboard";
import AdminPanel from "@/pages/admin-panel";

function UserRouter() {
  return (
    <Switch>
      <Route path="/" component={ModeSelector} />
      <Route path="/manual-waste" component={ProductDestruction} />
      <Route path="/auto-waste" component={AutoWaste} />
      <Route path="/dashboard" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={AdminPanel} />
      <Route path="/dashboard" component={Dashboard} />
      <Route component={AdminPanel} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { isSuperAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <Toaster />
        {isSuperAdmin ? <AdminRouter /> : <UserRouter />}
      </main>
    </div>
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
          <Analytics />
          <SpeedInsights />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
