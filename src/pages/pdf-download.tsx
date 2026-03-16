import { useState } from "react";
import { FileDown, Calendar, Download, Loader2, AlertCircle, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api-client";

export default function PdfDownload() {
  const { tenantName, storeCode } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/export-pdf?start=${startDate}&end=${endDate}`, {
        headers: { "Accept": "application/pdf" }
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal generate PDF");
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waste-report-${startDate}-to-${endDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Gagal download PDF");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 border-b border-cyan-900/30 bg-[hsl(220,45%,8%)]/95 backdrop-blur-md lg:hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <FileDown className="w-5 h-5 text-cyan-400" />
          <h1 className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">PDF Download</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 lg:p-8 space-y-5">
        {/* Desktop title */}
        <div className="hidden lg:flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">PDF Download</h2>
          <span className="text-sm text-slate-500">Export laporan waste</span>
        </div>

        {/* Illustration */}
        <div className="bg-[hsl(220,40%,10%)] border border-cyan-900/30 rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-blue-500/15 border border-cyan-500/20 flex items-center justify-center">
            <FileText className="w-8 h-8 text-cyan-400" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-bold text-white">Laporan Waste</h3>
            <p className="text-xs text-slate-400 mt-1">
              {tenantName && <span className="text-cyan-500/70">{tenantName}</span>}
              {storeCode && <span className="text-slate-500"> • {storeCode}</span>}
            </p>
          </div>
        </div>

        {/* Date range */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Dari
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[hsl(220,40%,12%)] border border-cyan-900/30 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Sampai
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[hsl(220,40%,12%)] border border-cyan-900/30 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-base font-bold bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Download PDF
            </>
          )}
        </button>

        <p className="text-center text-[10px] text-slate-600">
          PDF akan di-generate berdasarkan data waste yang sudah disubmit
        </p>
      </div>
    </div>
  );
}
