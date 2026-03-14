import { useAuth } from "@/hooks/useAuth";
import { DesktopSidebar } from "@/components/ui/desktop-sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { qcName, tenantName, isSuperAdmin, logout, isLoggingOut } = useAuth();

  const handleLogout = () => {
    logout();
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar - hidden on mobile, shown on desktop */}
      <DesktopSidebar
        qcName={qcName}
        tenantName={tenantName}
        isSuperAdmin={isSuperAdmin}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      {/* Main content area */}
      <div className="flex-1 lg:ml-[240px] min-h-screen">
        {children}
      </div>
    </div>
  );
}
