import { useAuthContext as useAuth } from "@/contexts/AuthContext";
import { DesktopSidebar } from "@/components/ui/desktop-sidebar";
import { MobileBottomNav } from "@/components/ui/mobile-bottom-nav";

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
    <div className="min-h-screen flex bg-[#0a0a0a] text-[#f0f0f0]">
      <DesktopSidebar
        qcName={qcName}
        tenantName={tenantName}
        isSuperAdmin={isSuperAdmin}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <div className="flex-1 lg:ml-[240px] min-h-screen flex flex-col bg-[#0a0a0a] overflow-x-hidden">
        {children}
        <div className="h-[calc(88px+env(safe-area-inset-bottom))] lg:hidden" />
      </div>

      {!isSuperAdmin && <MobileBottomNav />}
    </div>
  );
}
