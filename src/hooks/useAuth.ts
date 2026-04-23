import { useState, useEffect, useCallback, useRef } from "react";

// FIX: Lazy load toast to avoid circular dependency issues
function showToast(title: string, description: string, variant: string = "destructive", duration: number = 4000) {
  try {
    import("@/hooks/use-toast").then(({ toast }) => {
      toast({ title, description, variant: variant as any, duration });
    });
  } catch {}
}

// ========================
// GLOBAL AUTH EVENT SYSTEM
// ========================

/** 
 * Custom event yang bisa di-dispatch dari mana aja (api-client, queryClient, dll)
 * untuk trigger auto-logout + redirect ke login page.
 */
export const AUTH_EXPIRED_EVENT = "auth:session-expired";

export interface AuthExpiredDetail {
  reason: "session_timeout" | "api_401" | "api_403" | "token_missing" | "manual";
  message?: string;
}

/** Dispatch dari mana aja untuk trigger global logout */
export function dispatchAuthExpired(detail: AuthExpiredDetail) {
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail }));
}

// ========================
// AUTH HOOK
// ========================

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

const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_CHECK_INTERVAL = 30 * 1000;      // Check every 30 seconds
const ACTIVITY_THROTTLE = 60 * 1000;           // Extend session max every 60s
const WARNING_BEFORE_EXPIRE = 5 * 60 * 1000;  // Warn 5 minutes before expiry

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [qcName, setQcName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");
  const [tenantName, setTenantName] = useState<string>("");
  const [storeCode, setStoreCode] = useState<string>("");
  const [logoutReason, setLogoutReason] = useState<string>("");

  // Refs to prevent duplicate handling
  const isHandlingExpiry = useRef(false);
  const warningShown = useRef(false);
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Check remaining session time ──
  const getSessionRemaining = useCallback((): number => {
    const loginTime = localStorage.getItem("waste_app_login_time");
    if (!loginTime) return 0;
    const elapsed = Date.now() - parseInt(loginTime);
    return Math.max(SESSION_DURATION - elapsed, 0);
  }, []);

  // ── Core logout (clears everything) ──
  const performLogout = useCallback((reason?: string) => {
    if (isHandlingExpiry.current) return;
    isHandlingExpiry.current = true;

    setIsLoggingOut(true);
    if (reason) setLogoutReason(reason);

    // Clear all session data
    const keys = [
      "waste_app_authenticated",
      "waste_app_login_time",
      "waste_app_token",
      "waste_app_qc_name",
      "waste_app_role",
      "waste_app_tenant_id",
      "waste_app_tenant_name",
      "waste_app_store_code",
    ];
    keys.forEach(k => localStorage.removeItem(k));

    // Clear session check interval
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current);
      sessionCheckRef.current = null;
    }

    // Reset state
    setQcName("");
    setUserRole("");
    setTenantId("");
    setTenantName("");
    setStoreCode("");

    // Small delay for logout animation, then set unauthenticated
    setTimeout(() => {
      setIsAuthenticated(false);
      setIsLoggingOut(false);
      setLogoutReason("");
      isHandlingExpiry.current = false;
      warningShown.current = false;
    }, 1500);
  }, []);

  // ── Public logout (manual) ──
  const logout = useCallback(() => {
    performLogout("Kamu berhasil logout.");
  }, [performLogout]);

  // ── Listen for global auth expired events ──
  useEffect(() => {
    const handleAuthExpired = (e: Event) => {
      const detail = (e as CustomEvent<AuthExpiredDetail>).detail;
      const messages: Record<string, string> = {
        session_timeout: "Sesi kamu sudah expired. Silakan login ulang.",
        api_401: "Sesi tidak valid. Silakan login ulang.",
        api_403: "Akses ditolak. Silakan login ulang.",
        token_missing: "Token autentikasi hilang. Silakan login ulang.",
        manual: "Logout berhasil.",
      };
      const msg = detail?.message || messages[detail?.reason] || "Sesi berakhir.";

      // FIX #18: Use lazy import instead of top-level import
      try {
        showToast("Sesi Berakhir", msg, "destructive", 4000);
      } catch {}

      // Perform logout after brief delay (let toast show)
      setTimeout(() => performLogout(msg), 800);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [performLogout]);

  // ── Periodic session check ──
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkSession = () => {
      const remaining = getSessionRemaining();
      const token = localStorage.getItem("waste_app_token");

      // Token gone? Logout immediately
      if (!token) {
        dispatchAuthExpired({ reason: "token_missing" });
        return;
      }

      // Session fully expired? Auto logout
      if (remaining <= 0) {
        dispatchAuthExpired({ reason: "session_timeout" });
        return;
      }

      // Warning: 5 minutes before expiry
      if (remaining <= WARNING_BEFORE_EXPIRE && !warningShown.current) {
        warningShown.current = true;
        const minutesLeft = Math.ceil(remaining / 60000);
        // FIX #18: Use lazy import instead of top-level import
        try {
          showToast("Sesi Hampir Habis", `Sisa ${minutesLeft} menit lagi. Gerakin mouse/klik untuk perpanjang sesi.`, "destructive", 10000);
        } catch {}
      }

      // Reset warning if session got extended (activity reset the timer)
      if (remaining > WARNING_BEFORE_EXPIRE) {
        warningShown.current = false;
      }
    };

    // Run immediately and then every 30s
    checkSession();
    sessionCheckRef.current = setInterval(checkSession, SESSION_CHECK_INTERVAL);

    return () => {
      if (sessionCheckRef.current) {
        clearInterval(sessionCheckRef.current);
        sessionCheckRef.current = null;
      }
    };
  }, [isAuthenticated, getSessionRemaining]);

  // ── Activity listener to extend session ──
  useEffect(() => {
    if (!isAuthenticated) return;

    let activityTimeout: ReturnType<typeof setTimeout>;

    const handleUserActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        if (localStorage.getItem("waste_app_authenticated") === "true") {
          localStorage.setItem("waste_app_login_time", Date.now().toString());
          warningShown.current = false; // Reset warning since session extended
        }
      }, ACTIVITY_THROTTLE);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
      clearTimeout(activityTimeout);
    };
  }, [isAuthenticated]);

  // ── Listen for storage changes from other tabs ──
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Another tab logged out
      if (e.key === "waste_app_authenticated" && e.newValue !== "true") {
        performLogout("Kamu logout dari tab lain.");
      }
      // Another tab removed token
      if (e.key === "waste_app_token" && !e.newValue) {
        performLogout("Sesi berakhir dari tab lain.");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [performLogout]);

  // ── Initial auth check ──
  const checkAuthStatus = useCallback(() => {
    try {
      const authenticated = localStorage.getItem("waste_app_authenticated");
      const loginTime = localStorage.getItem("waste_app_login_time");
      const token = localStorage.getItem("waste_app_token");
      const storedQcName = localStorage.getItem("waste_app_qc_name");
      const storedRole = localStorage.getItem("waste_app_role");
      const storedTenantId = localStorage.getItem("waste_app_tenant_id");
      const storedTenantName = localStorage.getItem("waste_app_tenant_name");
      const storedStoreCode = localStorage.getItem("waste_app_store_code");

      if (authenticated === "true" && loginTime && token) {
        const remaining = SESSION_DURATION - (Date.now() - parseInt(loginTime));

        if (remaining > 0) {
          setIsAuthenticated(true);
          setQcName(storedQcName || "");
          setUserRole(storedRole || "");
          setTenantId(storedTenantId || "");
          setTenantName(storedTenantName || "");
          setStoreCode(storedStoreCode || "");
        } else {
          performLogout("Sesi kamu sudah expired. Silakan login ulang.");
        }
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      performLogout("Terjadi error autentikasi.");
    } finally {
      setIsLoading(false);
    }
  }, [performLogout]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // ── Login ──
  const login = (name: string, role?: string, tenant_id?: string, tenant_name?: string, store_code?: string, token?: string) => {
    localStorage.setItem("waste_app_authenticated", "true");
    localStorage.setItem("waste_app_login_time", Date.now().toString());
    if (token) {
      localStorage.setItem("waste_app_token", token);
    }
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
    isHandlingExpiry.current = false;
    warningShown.current = false;
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
    logoutReason,
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
