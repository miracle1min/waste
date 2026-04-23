import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Auto recover when lazy chunk fails to load after deployment updates.
const CHUNK_RELOAD_FLAG = "waste_app_chunk_reload_once";
const CHUNK_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "ChunkLoadError",
];

window.addEventListener("unhandledrejection", (event) => {
  const reason = String((event as PromiseRejectionEvent).reason || "");
  const isChunkError = CHUNK_ERROR_PATTERNS.some((pattern) => reason.includes(pattern));
  if (!isChunkError) return;

  const alreadyRetried = sessionStorage.getItem(CHUNK_RELOAD_FLAG) === "1";
  if (alreadyRetried) return;

  sessionStorage.setItem(CHUNK_RELOAD_FLAG, "1");
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);

// In development, stale SW cache can leave the page black. Clear old SW/caches.
const cleanupDevServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.warn("SW cleanup failed:", err);
  }
};

const registerSW = () => {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "activated") {
            console.log("New version available. Refresh to update.");
          }
        });
      });
    })
    .catch((err) => console.warn("SW registration failed:", err));
};

if (import.meta.env.DEV) {
  cleanupDevServiceWorker();
} else if ("requestIdleCallback" in window) {
  requestIdleCallback(registerSW);
} else {
  setTimeout(registerSW, 3000);
}
