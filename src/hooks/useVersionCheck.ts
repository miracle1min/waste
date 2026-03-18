declare const __APP_VERSION__: string;

import { useState, useEffect, useCallback, useRef } from "react";

const COUNTDOWN_SECONDS = 10;

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const forceRefresh = useCallback(() => {
    // Clear all auth data to force re-login
    const authKeys = [
      "waste_app_authenticated",
      "waste_app_login_time",
      "waste_app_token",
      "waste_app_qc_name",
      "waste_app_role",
      "waste_app_tenant_id",
      "waste_app_tenant_name",
      "waste_app_store_code",
    ];
    authKeys.forEach(k => localStorage.removeItem(k));

    // Store a flag so login page shows "updated" message
    localStorage.setItem("waste_app_just_updated", "true");

    // Hard reload — bypass cache
    window.location.reload();
  }, []);

  useEffect(() => {
    const currentVersion = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
    if (!currentVersion) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkVersion = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.version && data.version !== currentVersion) {
          setUpdateAvailable(true);

          // Start countdown for auto-refresh
          if (!countdownRef.current) {
            let remaining = COUNTDOWN_SECONDS;
            setCountdown(remaining);
            countdownRef.current = setInterval(() => {
              remaining -= 1;
              setCountdown(remaining);
              if (remaining <= 0) {
                if (countdownRef.current) clearInterval(countdownRef.current);
                // Force logout + refresh
                const authKeys = [
                  "waste_app_authenticated",
                  "waste_app_login_time",
                  "waste_app_token",
                  "waste_app_qc_name",
                  "waste_app_role",
                  "waste_app_tenant_id",
                  "waste_app_tenant_name",
                  "waste_app_store_code",
                ];
                authKeys.forEach(k => localStorage.removeItem(k));
                localStorage.setItem("waste_app_just_updated", "true");
                window.location.reload();
              }
            }, 1000);
          }

          // Stop polling — we already know there's an update
          if (intervalId) clearInterval(intervalId);
        }
      } catch {
        // silently ignore
      }
    };

    const timeoutId = setTimeout(() => {
      checkVersion();
      intervalId = setInterval(checkVersion, 30_000);
    }, 10_000);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return { updateAvailable, countdown, forceRefresh };
}
