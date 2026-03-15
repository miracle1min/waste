import { useState } from "react";
import { useVersionCheck } from "@/hooks/useVersionCheck";

export function UpdateBanner() {
  const { updateAvailable, refresh } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 shadow-lg">
        <div className="flex items-center justify-center gap-3 max-w-screen-xl mx-auto">
          <span className="text-lg">🔄</span>
          <span className="text-sm font-medium">
            Versi terbaru tersedia!
          </span>
          <button
            onClick={refresh}
            className="ml-2 px-3 py-1 text-xs font-semibold bg-white text-blue-700 rounded-md hover:bg-blue-50 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="ml-auto p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
