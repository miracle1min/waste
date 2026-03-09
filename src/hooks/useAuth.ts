import { useState, useEffect, useCallback } from "react";

interface AuthUser {
  id: string;
  tenant_id: string;
  username: string;
  role: string;
}

interface AuthTenant {
  id: string;
  name: string;
  store_code: string;
  status: string;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [qcName, setQcName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");
  const [tenantName, setTenantName] = useState<string>("");
  const [storeCode, setStoreCode] = useState<string>("");

  useEffect(() => {
    checkAuthStatus();

    const handleUserActivity = () => {
      if (isAuthenticated) {
        extendSession();
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    let activityTimeout: NodeJS.Timeout;

    const throttledActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(handleUserActivity, 60000);
    };

    events.forEach(event => {
      document.addEventListener(event, throttledActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledActivity, true);
      });
      clearTimeout(activityTimeout);
    };
  }, [isAuthenticated]);

  const checkAuthStatus = () => {
    try {
      const authenticated = localStorage.getItem("waste_app_authenticated");
      const loginTime = localStorage.getItem("waste_app_login_time");
      const storedQcName = localStorage.getItem("waste_app_qc_name");
      const storedRole = localStorage.getItem("waste_app_role");
      const storedTenantId = localStorage.getItem("waste_app_tenant_id");
      const storedTenantName = localStorage.getItem("waste_app_tenant_name");
      const storedStoreCode = localStorage.getItem("waste_app_store_code");

      if (authenticated === "true" && loginTime) {
        const loginTimestamp = parseInt(loginTime);
        const currentTime = Date.now();
        const sessionDuration = 8 * 60 * 60 * 1000;

        if (currentTime - loginTimestamp < sessionDuration) {
          setIsAuthenticated(true);
          setQcName(storedQcName || "");
          setUserRole(storedRole || "");
          setTenantId(storedTenantId || "");
          setTenantName(storedTenantName || "");
          setStoreCode(storedStoreCode || "");
        } else {
          logout();
        }
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = (name: string, role?: string, tenant_id?: string, tenant_name?: string, store_code?: string) => {
    localStorage.setItem("waste_app_authenticated", "true");
    localStorage.setItem("waste_app_login_time", Date.now().toString());
    localStorage.setItem("waste_app_qc_name", name);
    localStorage.setItem("waste_app_role", role || "admin");
    localStorage.setItem("waste_app_tenant_id", tenant_id || "");
    localStorage.setItem("waste_app_tenant_name", tenant_name || "");
    localStorage.setItem("waste_app_store_code", store_code || "");
    setQcName(name);
    setUserRole(role || "admin");
    setTenantId(tenant_id || "");
    setTenantName(tenant_name || "");
    setStoreCode(store_code || "");
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsLoggingOut(true);
    localStorage.removeItem("waste_app_authenticated");
    localStorage.removeItem("waste_app_login_time");
    localStorage.removeItem("waste_app_qc_name");
    localStorage.removeItem("waste_app_role");
    localStorage.removeItem("waste_app_tenant_id");
    localStorage.removeItem("waste_app_tenant_name");
    localStorage.removeItem("waste_app_store_code");
    setQcName("");
    setUserRole("");
    setTenantId("");
    setTenantName("");
    setStoreCode("");
    setIsAuthenticated(false);
  };

  const extendSession = useCallback(() => {
    if (isAuthenticated) {
      localStorage.setItem("waste_app_login_time", Date.now().toString());
    }
  }, [isAuthenticated]);

  const isSuperAdmin = userRole === "super_admin";

  return {
    isAuthenticated,
    isLoading,
    isLoggingOut,
    qcName,
    userRole,
    tenantId,
    tenantName,
    storeCode,
    isSuperAdmin,
    login,
    logout,
    extendSession,
    checkAuthStatus,
  };
}
