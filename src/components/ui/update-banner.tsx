import { useState } from "react";
import { useVersionCheck } from "@/hooks/useVersionCheck";

export function UpdateBanner() {
  const { updateAvailable, refresh } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
      <div className="bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] text-white px-4 py-3 shadow-[6px_6px_12px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-center gap-3 max-w-screen-xl mx-auto">
          <span className="text-lg">🔄</span>
          <span className="text-sm font-medium">
            Versi terbaru tersedia!
          </span>
          <button
            onClick={refresh}
            className="ml-2 px-3 py-1 text-xs font-semibold bg-white/20 text-white rounded-[10px] hover:bg-white/30 transition-colors backdrop-blur-sm"
          >
            Refresh
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="ml-auto p-1 hover:bg-white/20 rounded-[8px] transition-colors"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
