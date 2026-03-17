import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (isStandalone) return;

    // Check if user dismissed before (respect for 7 days)
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < sevenDays) return;
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isiOS);

    if (isiOS) {
      // iOS doesn't fire beforeinstallprompt, show manual guide after 3s
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android / Desktop Chrome
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after short delay
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  }, []);

  if (!showBanner) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] animate-in fade-in duration-300"
        onClick={handleDismiss}
      />

      {/* Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-in slide-in-from-bottom duration-500">
        <div className="max-w-md mx-auto bg-[#23262F] border border-[rgba(79,209,255,0.08)] rounded-[20px] shadow-[8px_8px_20px_rgba(0,0,0,0.5),-4px_-4px_12px_rgba(255,255,255,0.05)] p-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-[14px] bg-gradient-to-br from-[#4FD1FF] to-[#9F7AEA] flex items-center justify-center flex-shrink-0 shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)]">
              <span className="text-2xl">♻️</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[#E5E7EB] font-bold text-lg leading-tight">
                Install BA WASTE
              </h3>
              <p className="text-[#9CA3AF] text-sm mt-1">
                Akses lebih cepat langsung dari home screen — tanpa buka browser!
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-[#6B7280] hover:text-[#E5E7EB] transition-colors p-1 -mt-1 -mr-1"
              aria-label="Tutup"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Features */}
          <div className="flex gap-4 mt-4 text-xs text-[#9CA3AF]">
            <span className="flex items-center gap-1.5">
              <span className="text-[#4FD1FF]">⚡</span> Lebih Cepat
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[#4ADE80]">📱</span> Fullscreen
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[#9F7AEA]">🔔</span> Notifikasi
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            {isIOS ? (
              <button
                onClick={() => setShowIOSGuide(true)}
                className="flex-1 py-3 px-4 rounded-[14px] font-semibold text-sm bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] text-white hover:opacity-90 transition-all duration-200 active:scale-[0.97] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)]"
              >
                Cara Install →
              </button>
            ) : (
              <button
                onClick={handleInstall}
                className="flex-1 py-3 px-4 rounded-[14px] font-semibold text-sm bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] text-white hover:opacity-90 transition-all duration-200 active:scale-[0.97] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)]"
              >
                Install Sekarang
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="py-3 px-4 rounded-[14px] font-medium text-sm text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-[#2A2D37] transition-all duration-200"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>

      {/* iOS Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="bg-[#23262F] border border-[rgba(79,209,255,0.08)] rounded-[20px] shadow-[8px_8px_20px_rgba(0,0,0,0.5),-4px_-4px_12px_rgba(255,255,255,0.05)] max-w-sm w-full p-6">
            <h3 className="text-[#E5E7EB] font-bold text-lg mb-4 text-center">
              📱 Cara Install di iPhone/iPad
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-[#4FD1FF]/15 text-[#4FD1FF] flex items-center justify-center flex-shrink-0 font-bold text-sm">1</span>
                <p className="text-[#E5E7EB] text-sm pt-1">
                  Tap ikon <strong className="text-white">Share</strong> (kotak dengan panah ke atas) di toolbar Safari
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-[#4FD1FF]/15 text-[#4FD1FF] flex items-center justify-center flex-shrink-0 font-bold text-sm">2</span>
                <p className="text-[#E5E7EB] text-sm pt-1">
                  Scroll ke bawah, tap <strong className="text-white">"Add to Home Screen"</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-[#4FD1FF]/15 text-[#4FD1FF] flex items-center justify-center flex-shrink-0 font-bold text-sm">3</span>
                <p className="text-[#E5E7EB] text-sm pt-1">
                  Tap <strong className="text-white">"Add"</strong> di pojok kanan atas — selesai! 🎉
                </p>
              </div>
            </div>
            <button
              onClick={() => { setShowIOSGuide(false); handleDismiss(); }}
              className="w-full mt-5 py-3 rounded-[14px] font-semibold text-sm bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] text-white hover:opacity-90 transition-all duration-200 shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)]"
            >
              Oke, Mengerti!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
