import { useState, useEffect, useCallback } from "react";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  useEffect(() => {
    checkAuthStatus();
    
    // Set up activity listener to extend session
    const handleUserActivity = () => {
      if (isAuthenticated) {
        extendSession();
      }
    };

    // Track user activity (mouse moves, key presses, clicks)
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    let activityTimeout: NodeJS.Timeout;

    const throttledActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(handleUserActivity, 60000); // Extend session every minute of activity
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
      
      if (authenticated === "true" && loginTime) {
        const loginTimestamp = parseInt(loginTime);
        const currentTime = Date.now();
        
        // Session expires after 8 hours (8 * 60 * 60 * 1000 ms)
        const sessionDuration = 8 * 60 * 60 * 1000;
        
        if (currentTime - loginTimestamp < sessionDuration) {
          setIsAuthenticated(true);
        } else {
          // Session expired, clear storage
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

  const login = () => {
    localStorage.setItem("waste_app_authenticated", "true");
    localStorage.setItem("waste_app_login_time", Date.now().toString());
    setIsAuthenticated(true);
  };

  const logout = () => {
    console.log("Logout function called, clearing localStorage");
    setIsLoggingOut(true);
    localStorage.removeItem("waste_app_authenticated");
    localStorage.removeItem("waste_app_login_time");
    console.log("Setting isAuthenticated to false");
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
    login,
    logout,
    extendSession,
    checkAuthStatus
  };
}