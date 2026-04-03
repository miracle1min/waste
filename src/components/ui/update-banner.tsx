import { useVersionCheck } from "@/hooks/useVersionCheck";

export function UpdateBanner() {
  const { updateAvailable, countdown, forceRefresh } = useVersionCheck();

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 animate-in fade-in duration-300">
      <div className="mx-4 max-w-sm w-full rounded-[20px] bg-[#23262F] border border-[rgba(79,209,255,0.15)] shadow-[6px_6px_12px_rgba(0,0,0,0.45),_-2px_-2px_8px_rgba(255,255,255,0.04)] p-6 text-center space-y-5">
        {/* Animated icon */}
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#4FD1FF]/20 to-[#9F7AEA]/20 animate-pulse" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#2A2D37] to-[#1E2028] flex items-center justify-center border border-[rgba(79,209,255,0.2)]">
            <span className="text-3xl">🚀</span>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-[#E5E7EB]">
            Update Tersedia!
          </h2>
          <p className="text-sm text-[#9CA3AF] leading-relaxed">
            Versi terbaru sudah di-deploy. Kamu akan otomatis logout dan refresh dalam{" "}
            <span className="font-mono font-bold text-[#4FD1FF] text-base">
              {countdown}
            </span>{" "}
            detik.
          </p>
        </div>

        {/* Countdown progress bar */}
        <div className="w-full h-1.5 bg-[#1E2028] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / 10) * 100}%` }}
          />
        </div>

        <button
          onClick={forceRefresh}
          className="w-full py-2.5 px-4 text-sm font-semibold rounded-[12px] bg-gradient-to-r from-[#4FD1FF] to-[#9F7AEA] text-white hover:opacity-90 transition-opacity shadow-[4px_4px_8px_rgba(0,0,0,0.3)]"
        >
          Refresh Sekarang
        </button>

        <p className="text-xs text-[#6B7280]">
          Semua sesi akan di-reset. Silakan login ulang setelah refresh.
        </p>
      </div>
    </div>
  );
}
