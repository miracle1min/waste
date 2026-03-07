import { useState, useEffect, useCallback } from "react";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [qcName, setQcName] = useState<string>("");

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
      
      if (authenticated === "true" && loginTime) {
        const loginTimestamp = parseInt(loginTime);
        const currentTime = Date.now();
        const sessionDuration = 8 * 60 * 60 * 1000;
        
        if (currentTime - loginTimestamp < sessionDuration) {
          setIsAuthenticated(true);
          setQcName(storedQcName || "");
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

  const login = (name: string) => {
    localStorage.setItem("waste_app_authenticated", "true");
    localStorage.setItem("waste_app_login_time", Date.now().toString());
    localStorage.setItem("waste_app_qc_name", name);
    setQcName(name);
    setIsAuthenticated(true);
  };

  const logout = () => {
    console.log("Logout function called, clearing localStorage");
    setIsLoggingOut(true);
    localStorage.removeItem("waste_app_authenticated");
    localStorage.removeItem("waste_app_login_time");
    localStorage.removeItem("waste_app_qc_name");
    setQcName("");
    setIsAuthenticated(false);
    console.log("Logout completed");
  };

  const extendSession = useCallback(() => {
    if (isAuthenticated) {
      localStorage.setItem("waste_app_login_time", Date.now().toString());
    }
  }, [isAuthenticated]);

  return {
    isAuthenticated,
    isLoading,
    isLoggingOut,
    qcName,
    login,
    logout,
    extendSession,
    checkAuthStatus
  };
}
