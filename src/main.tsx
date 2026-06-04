import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Auto recover when lazy chunk fails to load after deployment updates.
const CHUNK_RELOAD_FLAG = "waste_app_chunk_reload_once";
const DEPLOYMENT_RELOAD_FLAG = "waste_app_force_reload_version";
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

const clearServiceWorkersAndCaches = async () => {
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

async function ensureLatestDeployment(): Promise<boolean> {
  if (import.meta.env.DEV) return true;

  try {
    const response = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    if (!response.ok) return true;

    const data = (await response.json()) as { version?: string };
    const deployedVersion = data.version;
    if (!deployedVersion || deployedVersion === __APP_VERSION__) {
      sessionStorage.removeItem(DEPLOYMENT_RELOAD_FLAG);
      return true;
    }

    if (sessionStorage.getItem(DEPLOYMENT_RELOAD_FLAG) === deployedVersion) {
      return true;
    }

    sessionStorage.setItem(DEPLOYMENT_RELOAD_FLAG, deployedVersion);
    await clearServiceWorkersAndCaches();

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("_v", deployedVersion);
    window.location.replace(nextUrl.toString());
    return false;
  } catch (err) {
    console.warn("Version check failed:", err);
    return true;
  }
}

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

async function bootstrap() {
  const shouldRender = await ensureLatestDeployment();
  if (!shouldRender) return;

  createRoot(document.getElementById("root")!).render(<App />);

  if (import.meta.env.DEV) {
    clearServiceWorkersAndCaches();
  } else if ("requestIdleCallback" in window) {
    requestIdleCallback(registerSW);
  } else {
    setTimeout(registerSW, 3000);
  }
}

bootstrap();
