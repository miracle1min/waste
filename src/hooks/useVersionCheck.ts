declare const __APP_VERSION__: string;

import { useState, useEffect, useCallback } from "react";

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const refresh = useCallback(() => {
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
    };
  }, []);

  return { updateAvailable, refresh };
}
