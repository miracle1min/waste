import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker for PWA — deferred to avoid blocking main thread
const registerSW = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('🔄 New version available - refresh for update');
              }
            });
          }
        });
      })
      .catch((err) => console.warn('SW registration failed:', err));
  }
};
if ('requestIdleCallback' in window) {
  requestIdleCallback(registerSW);
} else {
  setTimeout(registerSW, 3000);
}
